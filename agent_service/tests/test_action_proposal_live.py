"""Opt-in paid proposal regression; never sends save acknowledgements or writes plans."""
import copy
import json
import os
import unittest
from pathlib import Path
from uuid import uuid4
from langchain_core.messages import ToolMessage
from agent_service.action_eval import ACTION_CASES, CONTEXT, TODAY, action_failures, dispatched_action
from agent_service.advisor_loop import AdvisorLoop
from agent_service.availability import Availability
from agent_service.catalog import CatalogRepository
from agent_service.graph import request_state
from agent_service.kimi_agent import create_kimi_graph
from agent_service.kimi_budget import Budget, active_budget
from agent_service.verifier import ActionAuthorization
from calendar_fixture import fixture_agent


class RecordingModel:
    def __init__(self, model):
        self.model, self.rounds = model, []

    def bind_tools(self, *args, **kwargs):
        self.model = self.model.bind_tools(*args, **kwargs)
        return self

    def invoke(self, messages):
        response = self.model.invoke(messages)
        self.rounds.append({'calls': response.tool_calls,
                            'feedback': [m.content for m in messages if isinstance(m, ToolMessage)]})
        return response


class NoActionModel:
    def with_structured_output(self, *args, **kwargs):
        return self

    def invoke(self, *args, **kwargs):
        raise AssertionError('Typed actions must not invoke another model')


@unittest.skipUnless(os.getenv('KIMI_TEST_LIVE_ACTION_PROPOSAL') == '1', 'Opt-in paid action proposal evaluation')
class ActionProposalLiveTests(unittest.TestCase):
    def test_proposals(self):
        from dotenv import load_dotenv
        from langchain_openai import ChatOpenAI
        load_dotenv(Path(__file__).resolve().parents[2] / '.env', encoding='utf-8-sig')
        reports = []
        target = Path(os.getenv('KIMI_ACTION_REPORT', 'tmp/action-proposal-live.json'))
        try:
            for repeat in range(int(os.getenv('KIMI_ACTION_REPEATS', '1'))):
                for case in ACTION_CASES:
                    with self.subTest(case=case['id'], repeat=repeat):
                        model = RecordingModel(ChatOpenAI(model=os.getenv('KIMI_OPENAI_MODEL', 'gpt-4.1'), temperature=0, max_retries=0, timeout=35))
                        judge = ChatOpenAI(model=os.getenv('KIMI_SMALL_MODEL', 'gpt-4.1-mini'), temperature=0, max_retries=0, timeout=25).with_structured_output(ActionAuthorization, method='function_calling')
                        repository, web = CatalogRepository(), fixture_agent(today=lambda: TODAY)
                        context = copy.deepcopy(CONTEXT)
                        for entry, code in zip(context['plan'], ['CMPE 131', 'CMPE 142']):
                            entry['course_id'] = repository.find(context['program_id'], code)[0]['course_id']
                        advisor = AdvisorLoop(model, Availability(repository), web, intent_judge=judge, today=lambda: TODAY)
                        graph = create_kimi_graph(repository, model, web, advisor=advisor, action_model=NoActionModel(), today=lambda: TODAY)
                        token = active_budget.set(Budget().start())
                        try:
                            result = graph.invoke(request_state(case['prompt'], context), {'configurable': {'thread_id': str(uuid4())}})
                            failures = action_failures(result, case['expected_action']) if case['must_mutate'] else (['unexpected mutation'] if dispatched_action(result) else [])
                            report = {'id': case['id'], 'repeat': repeat, 'failures': failures, 'passed': not failures,
                                      'action': dispatched_action(result), 'metrics': result.get('advisor_metrics', {}), 'rounds': model.rounds}
                        except Exception as exc:
                            report = {'id': case['id'], 'repeat': repeat, 'passed': False, 'failures': [type(exc).__name__], 'rounds': model.rounds}
                        reports.append(report)
                        print(case['id'], 'PASS' if report['passed'] else report['failures'], flush=True)
                        self.assertTrue(report['passed'], report['failures'])
        finally:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(reports, indent=2, ensure_ascii=False, default=str), encoding='utf-8')
