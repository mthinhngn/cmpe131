"""Full advisor graph with deterministic providers; never makes model/network calls."""
import unittest
import json
from unittest.mock import Mock
from uuid import uuid4
from langchain_core.messages import AIMessage
from langgraph.types import Command
from agent_service.advisor_loop import AdvisorLoop, TOOLS
from agent_service.evidence import envelope, progress_callback, citations_for
from agent_service.kimi_contracts import KimiDecision
from agent_service.graph import request_state
from agent_service.kimi_agent import create_kimi_graph
from agent_service.verifier import verify, render_claims, Verdict, verify_action_request
from agent_service.kimi_budget import Budget, active_budget
from test_kimi import Repository, Model, ctx
from calendar_fixture import fixture_agent


def call(name, args):
    return AIMessage(content='', tool_calls=[{'name': name, 'args': args, 'id': str(uuid4())}])


class ToolModel:
    def __init__(self, *responses):
        self.responses = iter(responses)
        self.inputs = []

    def bind_tools(self, definitions, **kwargs):
        self.definitions = definitions
        return self

    def invoke(self, messages):
        self.inputs.append(list(messages))
        return next(self.responses)


class Availability:
    def __init__(self):
        self.calls = []

    def invoke(self, name, args, context):
        self.calls.append((name, args))
        if name == 'get_course':
            return {'courses': [{'code': args['code'], 'units': 3, 'description': 'Recorded description'}]}
        return {'code': 'HIST 15', 'sections': [{'class_number': '12345', 'open_seats': 5}],
                'source_url': 'https://www.sjsu.edu/classes/', 'fetched_at': '2026-11-16T10:00:00Z'}


class AdvisorTests(unittest.TestCase):
    def test_course_reviews_tool_executes_through_run_with_progress(self):
        research = Mock()
        research.course_reviews.return_value = {'status': 'empty', 'courses': []}
        model = ToolModel(call('course_reviews', {'codes': ['CMPE 142', 'CMPE 188']}),
                          call('ask_user', {'question': 'Which topic interests you?'}))
        loop = AdvisorLoop(model, Availability(), fixture_agent(), reviews=research)
        events = []
        token = progress_callback.set(events.append)
        try:
            result = loop.run(request_state('Compare CMPE 142 and CMPE 188', ctx()))
        finally:
            progress_callback.reset(token)
        research.course_reviews.assert_called_once_with(['CMPE 142', 'CMPE 188'], ['reddit', 'ratemyprofessors'])
        self.assertEqual(result['evidence'][0]['status'], 'empty')
        self.assertTrue(any(e['node'] == 'kimi.course_reviews' for e in events))

    def test_course_reviews_batch_public_codes_and_respect_saved_sources(self):
        research = Mock()
        research.course_reviews.return_value = {'status': 'empty', 'courses': []}
        loop = AdvisorLoop(ToolModel(), Availability(), fixture_agent(), reviews=research)
        state = {'app_context': {'completed_course_ids': ['private']},
                 'kimi_preferences': {'source': {'rmp': {'value': 'ratemyprofessors', 'active': True, 'polarity': 'avoid'}}}}
        loop.read('course_reviews', {'codes': ['CMPE 142', 'CMPE 188']}, state)
        research.course_reviews.assert_called_once_with(['CMPE 142', 'CMPE 188'], ['reddit'])

    def test_course_opinion_claims_need_public_sources_and_attribution(self):
        evidence = envelope(1, 'course_reviews', {'courses': [{'code': 'CMPE 142', 'sample_size': 'thin',
                            'sources': [{'url': 'https://reddit.com/r/SJSU/comments/1', 'excerpt': 'Projects are demanding.'}]}]}, kind='public_web')
        text = 'CMPE 142 students report demanding projects; this is a limited opinion sample.'
        self.assertEqual(verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence])['verdict'], 'pass')
        self.assertTrue(citations_for(evidence))
        evidence['data']['courses'][0]['sources'] = []
        self.assertEqual(verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence])['verdict'], 'revise')

    def test_course_research_resolves_code_without_sending_student_context(self):
        research = Mock()
        research.course_research.return_value = {'code': 'CMPE 188', 'status': 'ok', 'sources': []}
        loop = AdvisorLoop(ToolModel(), Availability(), fixture_agent(), reviews=research)
        data, kind, status = loop.read('course_research', {'code': 'CMPE 188'},
                                       {'app_context': {'completed_course_ids': ['private-course']}})
        research.course_research.assert_called_once_with('CMPE 188')
        self.assertEqual((kind, status), ('official_web', 'ok'))

    def test_course_research_requires_unique_catalog_match(self):
        availability, research = Mock(), Mock()
        availability.invoke.return_value = {'courses': []}
        loop = AdvisorLoop(ToolModel(), availability, fixture_agent(), reviews=research)
        with self.assertRaises(ValueError):
            loop.read('course_research', {'code': 'UNKNOWN 1'}, {'app_context': {}})
        research.course_research.assert_not_called()

    def test_course_research_schema_requires_one_code(self):
        schema = TOOLS['course_research'][0]
        self.assertEqual(schema.model_validate({'code': 'CMPE 188'}).model_dump(), {'code': 'CMPE 188'})
        with self.assertRaises(ValueError):
            schema.model_validate({'codes': ['CMPE 188']})

    def test_judge_issues_have_explicit_claim_and_problem_fields(self):
        schema = Verdict.model_json_schema()
        self.assertEqual(schema['$defs']['VerificationIssue']['required'], ['claim', 'problem'])
        evidence = envelope(1, 'get_course', {'code': 'HIST 15', 'units': 3})
        text = 'HIST 15 has 3 units.'
        judge = Mock()
        judge.invoke.return_value = {'verdict': 'revise', 'issues': [{'claim': text, 'problem': 'Example issue'}]}
        self.assertEqual(verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence], judge=judge)['issues'][0]['problem'], 'Example issue')
        judge.invoke.return_value = {'verdict': 'pass', 'issues': [{'issue': 'Wrong schema'}]}
        self.assertEqual(verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence], judge=judge)['verdict'], 'fail')

    def test_intent_check_receives_original_request_actions_and_conversation(self):
        decision = {'kind': 'course_action', 'group': 'none', 'steps': [
            {'kind': 'add_course_to_plan', 'course_query': 'CMPE 131',
             'destination': {'kind': 'relative_term', 'relation': 'current'}}]}
        history = [{'role': 'human', 'content': 'I want to plan CMPE 131.'}]
        judge = Mock()
        judge.invoke.return_value = {'intent': 'change', 'unresolved_conditions': [], 'matches': True, 'reason': 'The user requested this placement.'}
        message = 'Could you put that one into this term for me?'
        self.assertEqual(verify_action_request(message, decision, judge, history=history)['verdict'], 'pass')
        payload = json.loads(judge.invoke.call_args.args[0][1].content)
        self.assertEqual(payload['latest_user_message'], message)
        self.assertEqual(payload['proposed_actions'], decision)
        self.assertEqual(payload['conversation'], history)

    def test_intent_check_preserves_mismatch_feedback_and_fails_on_provider_errors(self):
        judge = Mock()
        expected = {'verdict': 'revise', 'issues': [{'claim': 'Move it to next term', 'problem': 'Source and destination are reversed.'}]}
        judge.invoke.return_value = {'intent': 'change', 'unresolved_conditions': [], 'matches': False, 'reason': 'Source and destination are reversed.'}
        self.assertEqual(verify_action_request('Move it to next term', {}, judge), expected)
        judge.invoke.side_effect = RuntimeError('private provider detail')
        result = verify_action_request('Move it', {}, judge)
        self.assertEqual(result['verdict'], 'fail')
        self.assertNotIn('private provider detail', str(result))
        self.assertEqual(verify_action_request('Move it', {}, None)['verdict'], 'fail')

    def test_unresolved_conditions_block_even_when_actions_match(self):
        judge = Mock()
        judge.invoke.return_value = {'intent': 'change', 'matches': True,
                                     'unresolved_conditions': ['Official offering not established.'],
                                     'reason': 'The request is conditional.'}
        result = verify_action_request('Add it if offered.', {}, judge)
        self.assertEqual(result['verdict'], 'revise')
        self.assertIn('Official offering not established.', result['issues'][0]['problem'])

    def test_batched_and_rag_sources_keep_individual_timestamps(self):
        for key in ('courses', 'results'):
            evidence = envelope(1, 'get_course', {key: [
                {'code': 'HIST 15', 'catalog_url': 'https://catalog.sjsu.edu/history', 'fetched_at': '2026-11-06'},
                {'code': 'AMS 10', 'catalog_url': 'https://catalog.sjsu.edu/ams', 'fetched_at': '2026-11-08'}]})
            citations = citations_for(evidence)
            self.assertEqual([c['fetched_at'] for c in citations], ['2026-11-06', '2026-11-08'])
            self.assertEqual([c['evidence_id'] for c in citations], ['ev_1', 'ev_1'])
            self.assertEqual(citations_for({**evidence, 'status': 'failed'}), [])
            self.assertEqual(citations_for({**evidence, 'source': {'kind': 'transcript'}}), [])

    def test_seeded_unsupported_relations_are_rejected_without_a_judge(self):
        evidence = envelope(1, 'get_course', {'courses': [{'code': 'HIST 15', 'units': 3,
            'satisfies': ['US1'], 'instructors': ['Real Instructor'], 'prerequisite_text': ''}]})
        for text in ('HIST 15 is taught by Invented Professor.', 'HIST 15 has no prerequisites.',
                     'HIST 15 satisfies US2.', 'HIST 15 has twelve open seats.',
                     'HIST 15 has units: 9.', 'HIST 15 reviews say it has a light workload.'):
            with self.subTest(text=text):
                self.assertNotEqual(verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence])['verdict'], 'pass')
        for text in ('HIST 15 satisfies US1.', 'HIST 15 is taught by Real Instructor.', 'HIST 15 has three units.'):
            self.assertEqual(verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence])['verdict'], 'pass')

    def test_unknown_fit_is_not_clear_and_missing_review_caveat_is_allowed(self):
        evidence = envelope(1, 'check_fit', {'code': 'HIST 15', 'schedule_status': 'unknown'})
        for text, expected in [('HIST 15 fits your plan.', 'revise'),
                               ('There is no evidence about workload in these results.', 'pass')]:
            self.assertEqual(verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence])['verdict'], expected)

    def test_personal_advice_requires_student_state_even_if_judge_passes(self):
        evidence = envelope(1, 'get_course', {'code': 'HIST 15', 'units': 3})
        judge = Mock()
        judge.invoke.return_value = {'verdict': 'pass', 'issues': []}
        text = 'HIST 15 has 3 units.'
        self.assertEqual(verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence], judge=judge,
                                question='Which course should I take?')['verdict'], 'revise')
        judge.invoke.assert_not_called()

    def test_should_i_take_requires_student_state_before_advice(self):
        evidence = envelope(1, 'get_course', {'code': 'HIST 15', 'description': 'American history'})
        text = 'HIST 15 is listed in the catalog.'
        judge = Mock()
        judge.invoke.return_value = {'verdict': 'pass', 'issues': []}
        result = verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence], judge=judge,
                        question='Should I take HIST 15 or AMS 10 next semester?')
        self.assertEqual(result['verdict'], 'revise')
        judge.invoke.assert_not_called()

    def test_conditional_advice_survives_rendering_with_unknown_fit(self):
        evidence = [envelope(1, 'get_student_state', {'completed_course_ids': []}, kind='browser'),
                    envelope(2, 'get_course', {'code': 'HIST 15', 'description': 'American history'}),
                    envelope(3, 'check_fit', {'code': 'HIST 15', 'schedule_status': 'unknown'})]
        claims = [{'text': 'I recommend HIST 15 if you want to study American history; timetable fit is unverified.',
                   'evidence_ids': ['ev_1', 'ev_2', 'ev_3']}]
        text, rendered = render_claims(claims, evidence)
        judge = Mock()
        judge.invoke.return_value = {'verdict': 'pass', 'issues': []}
        self.assertEqual(text, claims[0]['text'])
        self.assertEqual(verify(text, rendered, evidence, judge=judge,
                               question='Should I take HIST 15?')['verdict'], 'pass')
        judge.invoke.assert_called_once()

    def test_only_code_written_gap_claims_may_cite_unavailable_observations(self):
        e = envelope(1, 'get_sections', {}, status='failed')
        claim = {'kind': 'gap', 'text': e['gap_statement'], 'evidence_ids': ['ev_1']}
        self.assertEqual(verify(claim['text'], [claim], [e])['verdict'], 'pass')
        claim['text'] = 'HIST 15 has 999 open seats.'
        self.assertEqual(verify(claim['text'], [claim], [e])['verdict'], 'revise')

    def test_rendered_claims_attach_dates_and_use_code_written_gaps(self):
        evidence = [envelope(1, 'get_sections', {'code': 'HIST 15', 'sections': [{'open_seats': 5}], 'fetched_at': '2026-11-16T10:00:00Z'}),
                    envelope(2, 'get_sections', {}, status='failed')]
        draft, claims = render_claims([
            {'text': 'HIST 15 has five open seats.', 'evidence_ids': ['ev_1']},
            {'kind': 'gap', 'text': 'An invented positive assertion.', 'evidence_ids': ['ev_2']}], evidence)
        self.assertIn('2026-11-16T10:00:00Z', draft)
        self.assertNotIn('invented', draft)
        self.assertEqual(verify(draft, claims, evidence)['verdict'], 'pass')

    def test_judge_sees_failed_lookups_as_well_as_cited_facts(self):
        evidence = [envelope(1, 'get_course', {'code': 'HIST 15', 'units': 3}),
                    envelope(2, 'get_sections', {}, status='failed', error='Unavailable')]
        judge = Mock()
        judge.invoke.return_value = {'verdict': 'pass', 'issues': []}
        text = 'HIST 15 has 3 units.'
        verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], evidence, judge=judge)
        payload = json.loads(judge.invoke.call_args.args[0][1].content)
        self.assertEqual([e['status'] for e in payload['evidence']], ['ok', 'failed'])

    def test_progress_is_published_before_lookup_finishes(self):
        events = []
        token = progress_callback.set(events.append)
        model = ToolModel(call('get_course', {'code': 'HIST 15'}),
                          call('ask_user', {'question': 'Which term?'}))
        try:
            self.run_graph(model)
        finally:
            progress_callback.reset(token)
        self.assertEqual(events[0]['node'], 'kimi.thinking')
        self.assertIn('kimi.get_course', [e['node'] for e in events])
        self.assertIsNone(progress_callback.get())

    def run_graph(self, model, question='Tell me about HIST 15', judge=None):
        availability = Availability()
        loop = AdvisorLoop(model, availability, fixture_agent(), intent_judge=judge)
        graph = create_kimi_graph(Repository(), model, fixture_agent(), action_model=Model([]), advisor=loop)
        result = graph.invoke(request_state(question, ctx()), {'configurable': {'thread_id': str(uuid4())}})
        return result, availability

    def test_batch_details_return_flat_evidence_and_grounded_answer(self):
        model = ToolModel(call('get_course', {'codes': ['HIST 15', 'AMS 10']}),
                          call('final_answer', {'text': 'HIST 15 has 3 units.', 'claims': [{'text': 'HIST 15 has 3 units.', 'evidence_ids': ['ev_1']}]}))
        result, availability = self.run_graph(model)
        self.assertEqual(result['reply'], 'HIST 15 has 3 units.')
        self.assertEqual(len(result['evidence'][0]['data']['courses']), 2)
        self.assertEqual(availability.calls[0][1], {'code': 'HIST 15'})

    def test_duplicate_read_reuses_id_without_second_read(self):
        model = ToolModel(call('get_course', {'code': 'HIST 15'}), call('get_course', {'code': 'HIST 15'}),
                          call('final_answer', {'text': 'HIST 15 has 3 units.', 'claims': [{'text': 'HIST 15 has 3 units.', 'evidence_ids': ['ev_1']}]}))
        result, availability = self.run_graph(model)
        self.assertEqual(len(availability.calls), 1)
        self.assertEqual(len(result['evidence']), 1)

    def test_bad_final_gets_one_revision_then_safe_fallback(self):
        bad = {'text': 'HIST 15 has 99 units.', 'claims': [{'text': 'HIST 15 has 99 units.', 'evidence_ids': ['ev_1']}]}
        result, _ = self.run_graph(ToolModel(call('get_course', {'code': 'HIST 15'}), call('final_answer', bad), call('final_answer', bad)))
        self.assertNotIn('99', result['reply'])
        self.assertEqual([e['detail'] for e in result['events'] if e['node'] == 'kimi.verify'], ['revise', 'revise'])

    def test_recommendation_never_mutates_without_user_authorization(self):
        decision = {'kind': 'course_action', 'group': 'none', 'course_queries': [], 'steps': [{'kind': 'remove_course_from_plan', 'course_query': 'CMPE 131'}]}
        model = ToolModel(call('propose_plan_change', {k: v for k, v in decision.items() if k not in ('kind', 'reply')}), call('ask_user', {'question': 'Please request a specific plan change.'}))
        judge = Mock()
        judge.invoke.return_value = {'intent': 'discussion', 'unresolved_conditions': [], 'matches': False, 'reason': 'Advice does not authorize removal.'}
        result, _ = self.run_graph(model, 'Which course should I take?', judge=judge)
        self.assertNotIn('__interrupt__', result)
        self.assertFalse(result['steps'])

    def test_explicit_remove_uses_existing_interrupt_and_verified_ack(self):
        decision = {'kind': 'course_action', 'group': 'none', 'course_queries': [], 'steps': [{'kind': 'remove_course_from_plan', 'course_query': 'CMPE 131'}]}
        model = ToolModel(call('propose_plan_change', {k: v for k, v in decision.items() if k not in ('kind', 'reply')}))
        judge = Mock()
        judge.invoke.return_value = {'intent': 'change', 'unresolved_conditions': [], 'matches': True, 'reason': 'User requested removal.'}
        result, _ = self.run_graph(model, 'Remove CMPE 131', judge=judge)
        self.assertIn('__interrupt__', result)
        self.assertEqual(result['__interrupt__'][0].value['action']['kind'], 'remove_course_from_plan')

    def test_budget_counts_tools(self):
        token = active_budget.set(Budget(tool_calls=0).start())
        try:
            with self.assertRaisesRegex(ValueError, 'budget'):
                self.run_graph(ToolModel(call('get_course', {'code': 'HIST 15'})))
        finally:
            active_budget.reset(token)

    def test_quantities_cannot_move_between_courses(self):
        evidence = envelope(1, 'find_courses_by_requirement', {'courses': [{'code': 'HIST 20B', 'open_seats_total': 32}, {'code': 'AMS 10', 'open_seats_total': 205}], 'fetched_at': '2026-11-06'})
        text = 'HIST 20B has 205 seats as of 2026-11-06.'
        self.assertEqual(verify(text, [{'text': text, 'evidence_ids': ['ev_1']}], [evidence])['verdict'], 'revise')

    def test_false_save_and_undeclared_claim_are_rejected(self):
        self.assertEqual(verify('I saved your plan.', [], [])['verdict'], 'revise')
        e = envelope(1, 'get_course', {'code': 'HIST 15', 'units': 3})
        self.assertEqual(verify('HIST 15 has 3 units. No prerequisites.', [{'text': 'HIST 15 has 3 units.', 'evidence_ids': ['ev_1']}], [e])['verdict'], 'revise')



if __name__ == '__main__':
    unittest.main()
