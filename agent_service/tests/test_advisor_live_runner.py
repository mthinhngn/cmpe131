import unittest
from unittest.mock import Mock, patch

from agent_service.evaluate_advisor_live import CASES, run_case
from agent_service.action_eval import ACTION_CASES
from types import SimpleNamespace


class LiveRunnerTests(unittest.TestCase):
    def test_action_cases_require_correct_dispatch_and_report_first_attempt(self):
        graph = Mock()
        action = {'kind': 'add_course_to_plan', 'course_code': 'HIST 15', 'semester_slot': 5}
        graph.invoke.return_value = {'__interrupt__': [SimpleNamespace(value={'action': action})],
                                    'advisor_metrics': {'mutation_proposals': 1, 'first_attempt_valid': True, 'model_rounds': 1}}
        with patch('langchain_openai.ChatOpenAI'), patch('agent_service.evaluate_advisor_live.create_kimi_graph', return_value=graph):
            result = run_case(ACTION_CASES[0])
            self.assertTrue(result['passed'], result)
            self.assertTrue(result['first_attempt_valid'])
            action['semester_slot'] = 7
            self.assertFalse(run_case(ACTION_CASES[0])['passed'])

    def test_verification_and_mutation_metrics_cannot_be_hidden_by_a_correct_reply(self):
        result = {'reply': 'HIST 15 has 3 units.', 'evidence': [{'tool': 'get_course'}],
                  'advisor_metrics': {'mutation_proposals': 1}, 'events': []}
        graph = Mock()
        graph.invoke.return_value = result
        with patch('langchain_openai.ChatOpenAI'), patch('agent_service.evaluate_advisor_live.create_kimi_graph', return_value=graph):
            report = run_case(CASES[1])
        self.assertFalse(report['passed'])
        self.assertIn('unauthorized mutation proposal or dispatch', report['failures'])
        self.assertIn('no verified final answer', report['failures'])

    def test_clarification_is_reported_but_does_not_pass_recommendation(self):
        case = CASES[2]
        graph = Mock()
        graph.invoke.return_value = {
            'reply': 'Which course interests you?',
            'evidence': [{'tool': tool} for tool in case['required_tools']],
            'advisor_metrics': {'user_clarifications': 1}, 'events': []}
        with patch('langchain_openai.ChatOpenAI'), patch('agent_service.evaluate_advisor_live.create_kimi_graph', return_value=graph):
            report = run_case(case)
        self.assertTrue(report['asked_user'])
        self.assertFalse(report['verified_answer'])
        self.assertFalse(report['passed'])
