"""Eval accounting must distinguish provider availability from model quality."""
import unittest
from agent_service.evaluate_kimi_decisions import summarize

class EvaluationAccountingTests(unittest.TestCase):
    def test_typed_destination_is_scored(self):
        from agent_service.evaluate_kimi_decisions import score
        decision = dict(kind='course_action', steps=[dict(kind='move_course_in_plan', course_query='CMPE 50', source=dict(kind='numbered_semester', number=7), destination=dict(kind='numbered_semester', number=5), conditions=[])])
        self.assertTrue(score(decision, 'move'))
        decision['steps'][0]['destination']['number'] = 4
        self.assertFalse(score(decision, 'move'))

    def test_wrong_course_pairs_and_hidden_mutations_do_not_pass(self):
        from agent_service.evaluate_kimi_decisions import score
        self.assertFalse(score(dict(kind='course_action', group='swap', course_queries=['CMPE 131', 'CMPE 142']), 'swap'))
        self.assertFalse(score(dict(kind='course_action', group='replace', course_queries=['CMPE 125', 'CMPE 50']), 'replace'))
        self.assertFalse(score(dict(kind='answer', group='swap', course_queries=['MATH 33LA', 'CMPE 50']), 'no_action'))

    def test_incomplete_provider_failure_is_not_a_model_failure(self):
        rows = [dict(case='a', repeat=0, passed=False, provider_error='RateLimitError'),
                dict(case='a', repeat=0, passed=True)]
        result = summarize(rows, [('a', '', ''), ('b', '', '')], 1)
        self.assertEqual((result['passed'], result['total'], result['expected']), (1, 1, 2))
        self.assertFalse(result['complete'])
        self.assertEqual(result['provider_failures'], 1)

    def test_resume_duplicates_do_not_inflate_complete_trials(self):
        row = dict(case='a', repeat=0, passed=False)
        result = summarize([row, row], [('a', '', '')], 2)
        self.assertEqual(result['total'], 1)
        self.assertFalse(result['complete'])
        result = summarize([row, dict(case='a', repeat=1, passed=True)], [('a', '', '')], 2)
        self.assertTrue(result['complete'])
        self.assertEqual(result['by_case']['a'], dict(passed=1, total=2))


class AcceptanceMatrixTests(unittest.TestCase):
    def test_requested_category_counts_and_expectations(self):
        import json
        from collections import Counter
        from pathlib import Path
        matrix = json.loads((Path(__file__).resolve().parents[1] / 'evals/kimi_acceptance_en.json').read_text(encoding='utf-8'))
        cases = matrix['cases']
        self.assertEqual(Counter(c['category'] for c in cases), dict(research=11, action=19, mixed=10, direct=5, ambiguous=7, return_failure=8))
        self.assertEqual(len({c['id'] for c in cases}), 60)
        for case in cases:
            self.assertTrue(case['prompt'])
            self.assertEqual(set(case['expected']), {'agent', 'operation', 'arguments', 'clarification', 'final_message_requirements'})
            self.assertTrue(case['expected']['final_message_requirements'])
        failures = [c for c in cases if c['category'] == 'return_failure']
        self.assertTrue(all('mock_response' in c for c in failures))


class AcceptanceRunnerTests(unittest.TestCase):
    def setUp(self):
        import json
        from agent_service.evaluate_kimi_acceptance import MATRIX
        self.matrix = json.loads(MATRIX.read_text(encoding='utf-8'))
        self.cases = {c['id']: c for c in self.matrix['cases']}

    def checks(self, name, **decision):
        from agent_service.evaluate_kimi_acceptance import fixture, score
        from agent_service.kimi_contracts import KimiDecision
        from test_graph import intent
        decision["steps"] = [intent(s).model_dump() for s in decision.get("steps", [])]
        case = self.cases[name]
        decision.setdefault('group', 'none')
        decision.setdefault('course_queries', [])
        return score(case, KimiDecision(**decision).model_dump(), fixture(case, self.matrix)['context'])

    def test_wrong_destination_and_course_fail_despite_right_route(self):
        checks = self.checks('action_13', kind='course_action', steps=[dict(
            kind='move_course_in_plan', course_query='CMPE 131', source_semester_slot=7, semester_slot=6)])
        self.assertTrue(checks['action_route'])
        self.assertFalse(checks['destination'])
        self.assertFalse(checks['courses_in_order'])

    def test_reciprocal_steps_without_explicit_group_fail(self):
        checks = self.checks('action_10', kind='course_action', steps=[dict(
            kind='move_course_in_plan', course_query=c, source_semester_slot=s, semester_slot=t)
            for c, s, t in [('MATH 33LA', 6, 7), ('CMPE 50', 7, 6)]])
        self.assertFalse(checks['explicit_operation'])

    def test_return_failure_cannot_retry_mutation(self):
        checks = self.checks('return_failure_03', kind='course_action', steps=[dict(
            kind='add_course_to_plan', course_query='CMPE 133', semester_slot=5)])
        self.assertFalse(checks['no_repeated_mutation'])

    def test_conditional_action_cannot_skip_evidence(self):
        checks = self.checks('mixed_08', kind='course_action', group='replace',
                            course_queries=['CMPE 50', 'CMPE 125'])
        self.assertFalse(checks['no_premature_mutation'])

    def test_history_fixture_reflects_previous_move_without_mutating_matrix(self):
        from agent_service.evaluate_kimi_acceptance import fixture
        changed = fixture(self.cases['action_18'], self.matrix)
        original = fixture(self.cases['action_01'], self.matrix)
        self.assertEqual(changed['context']['plan'][1]['semester_slot'], 5)
        self.assertEqual(original['context']['plan'][1]['semester_slot'], 7)

    def test_section_case_requires_preserving_lab(self):
        checks = self.checks('action_19', kind='course_action', query='CMPE 131',
                            section_term='fall-2026', section_numbers=['13102'])
        self.assertFalse(checks['retains_lab'])
