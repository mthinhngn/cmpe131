"""Scripted graph coverage is a harness gate, never a live-model quality score."""
import json
import unittest
import copy
from agent_service.evaluate_advisor import CASES, run_case


class AdvisorEvalTests(unittest.TestCase):
    def test_offline_full_graph_cases(self):
        cases = json.loads(CASES.read_text(encoding='utf-8'))
        self.assertEqual(len(cases), 33)
        self.assertEqual(len({c['id'] for c in cases}), len(cases))
        for case in cases:
            with self.subTest(case=case['id']):
                result = run_case(case)
                self.assertTrue(result['passed'], result['failures'])

    def test_action_fields_and_proposal_tools_are_actually_scored(self):
        case = next(c for c in json.loads(CASES.read_text(encoding='utf-8')) if c['id'] == 'action_numbered')
        wrong = copy.deepcopy(case)
        wrong['expected_action']['semester_slot'] = 7
        self.assertIn('incorrect action field: semester_slot', run_case(wrong)['failures'])
        forbidden = copy.deepcopy(case)
        forbidden['forbidden_tools'] = ['propose_plan_change']
        self.assertIn('forbidden tool: propose_plan_change', run_case(forbidden)['failures'])
