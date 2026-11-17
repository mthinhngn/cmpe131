import unittest
from agent_service.research_agent import ResearchAgent, ReviewSummary


class Model:
    def with_structured_output(self, schema):
        assert schema is ReviewSummary
        return self

    def invoke(self, messages):
        return ReviewSummary(summary='Students describe clear explanations; evidence is limited.', themes=['clarity'])


class ReviewResearchTests(unittest.TestCase):
    def test_course_reviews_search_both_sites_without_known_instructors(self):
        queries = []
        def search(query, deadline):
            queries.append(query)
            if 'site:reddit.com' in query:
                return [{'url': 'https://www.reddit.com/r/SJSU/comments/1', 'title': 'CMPE142', 'content': 'Students discuss projects.'},
                        {'url': 'https://reddit.com/r/other/comments/2', 'title': 'CMPE 188', 'content': 'Different university'},
                        {'url': 'https://reddit.com/r/SJSU/comments/3', 'title': 'CMPE 1880', 'content': 'Different course'}]
            return [{'url': 'https://www.ratemyprofessors.com/professor/1', 'title': 'SJSU course reviews', 'content': 'CMPE 188: students discuss assignments.'}]
        result = ResearchAgent(search=search).course_reviews(['CMPE 142', 'CMPE 188'])
        self.assertEqual(len(queries), 2)
        self.assertIn('site:reddit.com', queries[0])
        self.assertIn('site:ratemyprofessors.com', queries[1])
        self.assertEqual(result['status'], 'ok')
        self.assertEqual([len(row['sources']) for row in result['courses']], [1, 1])
        self.assertTrue(all(row['sample_size'] == 'thin' for row in result['courses']))

    def test_course_review_source_exclusion_and_private_query_validation(self):
        queries = []
        agent = ResearchAgent(search=lambda query, _: queries.append(query) or [])
        self.assertEqual(agent.course_reviews(['CMPE 142'], ['reddit'])['status'], 'empty')
        self.assertEqual(len(queries), 1)
        self.assertNotIn('ratemyprofessors', queries[0])
        with self.assertRaises(ValueError):
            agent.course_reviews(['My private transcript says CMPE 142'])

    def test_course_research_uses_public_code_and_official_sources(self):
        queries = []
        def search(query, deadline):
            queries.append(query)
            return [{'url': 'https://catalog.sjsu.edu/course/188', 'title': 'CMPE 188', 'content': 'Machine learning topics'},
                    {'url': 'https://sjsu.edu.evil.org/course', 'title': 'CMPE 188', 'content': 'Wrong host'},
                    {'url': 'https://www.sjsu.edu/other', 'title': 'CMPE 1880', 'content': 'Wrong course'}]
        result = ResearchAgent(search=search).course_research('CMPE 188')
        self.assertEqual(queries, ['SJSU CMPE 188 course description topics site:sjsu.edu'])
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(len(result['sources']), 1)
        self.assertEqual(result['sources'][0]['excerpt'], 'Machine learning topics')
        self.assertTrue(result['sources'][0]['fetched_at'])

    def test_course_research_rejects_private_queries_and_reports_empty_results(self):
        agent = ResearchAgent(search=lambda *_: [])
        with self.assertRaises(ValueError):
            agent.course_research('My transcript says I failed CMPE 188')
        self.assertEqual(agent.course_research('CMPE 188')['status'], 'empty')

    def test_empty_evidence_does_not_call_model(self):
        value = ResearchAgent(search=lambda *_: []).review_research('HIST 15', 'spring-2027', ['Jane Doe'])
        self.assertEqual(value['status'], 'empty')
        self.assertEqual(value['instructors'][0]['sample_size'], 'none')

    def test_only_attributed_sources_are_summarized(self):
        rows = [{'url': 'https://www.reddit.com/r/SJSU/comments/1', 'title': 'Jane Doe HIST 15', 'content': 'Students discuss clear explanations.'},
                {'url': 'https://example.com/injected', 'title': 'Jane Doe HIST 15', 'content': 'Unrequested domain'},
                {'url': 'https://reddit.com/r/SJSU/comments/2', 'title': 'Someone Else', 'content': 'No instructor attribution'}]
        agent = ResearchAgent(search=lambda *_: rows, model=Model())
        value = agent.review_research('HIST 15', 'spring-2027', ['Jane Doe', 'Other Person'], ['reddit'])
        self.assertEqual(value['status'], 'ok')
        self.assertEqual(len(value['instructors'][0]['sources']), 1)
        self.assertEqual(value['instructors'][1]['sample_size'], 'none')

    def test_private_query_is_rejected(self):
        with self.assertRaises(ValueError):
            ResearchAgent(search=lambda *_: []).review_research('My private transcript', 'spring-2027', ['Jane Doe'])
