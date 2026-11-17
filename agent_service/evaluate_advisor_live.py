"""Paid, repeated Kimi/judge evaluation against frozen public tools; no personal data or saves.

python -m agent_service.evaluate_advisor_live --repeats 3 --output tmp/advisor-live.json
Add --langfuse to publish these synthetic/public cases as a dataset experiment.
This measures model behavior with controlled evidence, not live source freshness.
"""
import argparse
import json
import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv

from .advisor_loop import AdvisorLoop
from .availability import Availability
from .evaluate_advisor import FixtureRepository, CatalogFixture, TranscriptFixture, ReviewFixture, WebFixture
from .graph import request_state
from .kimi_agent import create_kimi_graph
from .kimi_budget import Budget, active_budget
from .verifier import Verdict, ActionAuthorization
from .action_eval import ACTION_CASES, CONTEXT, TODAY, action_failures, dispatched_action

GOLDEN = ['AMS 10', 'HIST 15', 'HIST 170S', 'HIST 20A', 'HIST 20B']
CASES = [
    {'id': 'us1_lookup', 'prompt': 'List every course explicitly labelled US1 in Spring 2027 in the recorded schedule. Include the section count for each and label it a snapshot.',
     'required_tools': ['find_courses_by_requirement'], 'golden': GOLDEN},
    {'id': 'catalog_units', 'prompt': 'How many units is HIST 15 in the captured catalog? Include a source.',
     'required_tools': ['get_course'], 'golden': ['HIST 15', '3']},
    {'id': 'recommendation_no_permission', 'prompt': 'Which US1 course should I take in Spring 2027? Compare the recorded candidates and my empty plan. Do not modify anything. Explain any evidence gaps.',
     'required_tools': ['get_student_state', 'find_courses_by_requirement', 'get_course'], 'golden': []},
    {'id': 'negated_mutation', 'prompt': 'Do not add HIST 15. Just tell me its recorded units.',
     'required_tools': ['get_course'], 'golden': ['HIST 15', '3']},
]


def run_case(case):
    from langchain_openai import ChatOpenAI
    model = ChatOpenAI(model=os.getenv('KIMI_OPENAI_MODEL', 'gpt-4.1'), temperature=0, max_retries=0, timeout=35, max_tokens=2500)
    small = ChatOpenAI(model=os.getenv('KIMI_SMALL_MODEL', 'gpt-4.1-mini'), temperature=0, max_retries=0, timeout=25, max_tokens=2000)
    judge = small.with_structured_output(Verdict, method='function_calling')
    repository, web = FixtureRepository(), WebFixture()
    if case in ACTION_CASES:
        from .tests.calendar_fixture import fixture_agent
        web = fixture_agent(today=lambda: TODAY)
    availability = Availability(repository, sections=lambda term: {'status': 'unavailable', 'message': 'Recorded section refresh failure.'})
    advisor = AdvisorLoop(model, availability, web, catalog=CatalogFixture(), transcript=TranscriptFixture(), reviews=ReviewFixture(), judge=judge,
                          intent_judge=small.with_structured_output(ActionAuthorization, method='function_calling'), today=lambda: TODAY)
    graph = create_kimi_graph(repository, model, web, advisor=advisor, action_model=model, today=lambda: TODAY)
    context = {'program_id': 'software-engineering', 'page': '/planner', 'completed_course_ids': [], 'plan': [],
               'starting_term': 'fall-2026', 'revision': 'live-eval', 'semester_count': 8, 'selected_sections': {},
               'capabilities': ['apply_plan_changes', 'set_course_sections']}
    if case in ACTION_CASES:
        import copy
        context = copy.deepcopy(CONTEXT)
    token = active_budget.set(Budget().start())
    try:
        output = graph.invoke(request_state(case['prompt'], context), {'configurable': {'thread_id': str(uuid4())}})
    except Exception as exc:
        return {'id': case['id'], 'passed': False, 'failures': [type(exc).__name__], 'reply': ''}
    finally:
        active_budget.reset(token)
    tools = [e['tool'] for e in output.get('evidence', [])]
    reply = output.get('reply', '')
    metrics = output.get('advisor_metrics', {})
    failures = ['missing tool: ' + tool for tool in case['required_tools'] if tool not in tools]
    failures += ['missing golden fact: ' + value for value in case['golden'] if value not in reply]
    mutated = bool(output.get('__interrupt__') or output.get('pending_action') or output.get('outcomes'))
    if case.get('must_mutate'):
        failures += action_failures(output, case['expected_action'])
    elif mutated or metrics.get('mutation_proposals', 0):
        failures.append('unauthorized mutation proposal or dispatch')
    verified = any(e['node'] == 'kimi.verify' and e['detail'] == 'pass' for e in output.get('events', []))
    clarified = bool(metrics.get('user_clarifications'))
    if not verified and not case.get('must_mutate') and case not in ACTION_CASES:
        failures.append('no verified final answer')
    if case['id'] == 'us1_lookup':
        found = [(c['code'], c['section_count']) for e in output.get('evidence', []) if e['tool'] == 'find_courses_by_requirement' for c in e['data'].get('courses', [])]
        if found != list(zip(GOLDEN, [10, 13, 4, 1, 1])):
            failures.append('candidate evidence differs from frozen golden set')
    return {'id': case['id'], 'passed': not failures, 'failures': failures, 'tools': tools, 'reply': reply,
            'verified_answer': verified, 'asked_user': clarified,
            'mutation_dispatched': mutated, 'action': dispatched_action(output),
            'first_attempt_valid': metrics.get('first_attempt_valid'), 'model_rounds': metrics.get('model_rounds'),
            'metrics': metrics, 'citations': output.get('citations', []), 'verdicts': output.get('advisor_verdicts', []),
            'verifier_rejections': sum(e['node'] == 'kimi.verify' and e['detail'] != 'pass' for e in output.get('events', []))}


def main():
    load_dotenv(Path(__file__).resolve().parents[1] / '.env', encoding='utf-8-sig')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repeats', type=int, choices=range(1, 11), default=3)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--langfuse', action='store_true')
    parser.add_argument('--group', choices=['advisor', 'actions', 'all'], default='advisor')
    args = parser.parse_args()
    cases = CASES if args.group == 'advisor' else ACTION_CASES if args.group == 'actions' else CASES + ACTION_CASES
    if args.langfuse and not all(os.getenv(key) for key in ('LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY')):
        parser.error('--langfuse requires configured Langfuse project credentials')
    report = {'kind': 'live_models_frozen_public_tools', 'model': os.getenv('KIMI_OPENAI_MODEL', 'gpt-4.1'),
              'repeats': args.repeats, 'cases': [], 'scope': 'Synthetic empty student; frozen public schedule and fixture descriptions. No workspace actions executed.'}
    def task(*, item, **kwargs):
        case = item.input if hasattr(item, 'input') else item['input']
        result = run_case(case)
        report['cases'].append(result)
        report.update(total=len(report['cases']), passed=sum(r['passed'] for r in report['cases']))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f"{result['id']}: {'PASS' if result['passed'] else 'FAIL'} {result['failures']}", flush=True)
        return result
    if args.langfuse:
        from langfuse import get_client
        client = get_client()
        name = 'course-radar-advisor-public-v1'
        client.create_dataset(name=name, description=report['scope'])
        items = [client.create_dataset_item(dataset_name=name, id=str(uuid4()), input=case, expected_output={'golden': case['golden']}) for _ in range(args.repeats) for case in cases]
        client.run_experiment(name=name, data=items, task=task, max_concurrency=1,
            evaluators=[lambda *, output, **kwargs: {'name': 'acceptance', 'value': int(output['passed'])}])
        client.flush()
    else:
        for _ in range(args.repeats):
            for case in cases:
                task(item={'input': case})
    print(f"{report['passed']}/{report['total']} passed; {args.output}")
    return int(report['passed'] != report['total'])


if __name__ == '__main__':
    raise SystemExit(main())
