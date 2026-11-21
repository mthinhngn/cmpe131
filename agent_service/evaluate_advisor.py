"""Offline full-graph harness checks, not measurements of live-model quality.

Run: python -m agent_service.evaluate_advisor
All models, public search and transcript responses below are scripted fixtures.
"""
import argparse
import copy
import json
import time
from pathlib import Path
from uuid import uuid4
from langchain_core.messages import AIMessage
from .advisor_loop import AdvisorLoop
from .availability import Availability
from .graph import request_state
from .kimi_agent import create_kimi_graph
from .kimi_budget import Budget, active_budget
from .action_eval import TODAY, action_failures, dispatched_action

ROOT = Path(__file__).resolve().parents[1]
CASES = Path(__file__).with_name('evals') / 'kimi_advisor.json'


class ToolModel:
    def __init__(self, script):
        self.script = copy.deepcopy(script)
        self.messages = []

    def bind_tools(self, *args, **kwargs):
        return self

    def with_structured_output(self, *args, **kwargs):
        return self

    def invoke(self, messages):
        self.messages.append(list(messages))
        calls = self.script.pop(0) if self.script else [{'name': 'ask_user', 'args': {'question': 'Please clarify the missing evidence.'}}]
        if isinstance(calls, dict):
            calls = [calls]
        return AIMessage(content='', tool_calls=[{'name': c['name'], 'args': c.get('args', {}), 'id': 'fixture_' + uuid4().hex} for c in calls])


class FixtureRepository:
    def __init__(self):
        self.rows = json.loads((ROOT / 'data/sjsu/2026-2027/spring-2027.json').read_text(encoding='utf-8'))
        self.courses = {}
        for row in self.rows:
            self.courses.setdefault(row['courseCode'], {'course_id': row['courseCode'].lower().replace(' ', ''),
                'code': row['courseCode'], 'title': row.get('title'), 'units': row.get('units'),
                'description': 'Fixture course description.', 'prerequisite_text': 'No prerequisite conditions are listed on the captured course page.',
                'prerequisite_codes': [], 'catalog_url': row.get('catalogUrl'), 'fetched_at': row.get('fetchedAt')})
        # Replacement coverage needs a catalog fixture even when no section is offered.
        self.courses.setdefault('CMPE 135', {'course_id': 'cmpe135', 'code': 'CMPE 135',
                                            'title': 'Synthetic replacement fixture', 'units': 3,
                                            'prerequisite_codes': []})

    def section_records(self, term):
        return copy.deepcopy(self.rows) if term == 'spring-2027' else []

    def course_details(self, code):
        compact = code.upper().replace(' ', '')
        return next((dict(row) for name, row in self.courses.items() if name.replace(' ', '') == compact), None)

    def find(self, program, query, course_id=None):
        row = self.course_details(query)
        return [{**row, 'program_id': program}] if row else []

    def prerequisite_rules(self, program):
        return []


class CatalogFixture:
    def search(self, query, filters):
        return {'results': [{'code': 'AMS 10', 'title': 'American Studies', 'snippet': 'Fixture description',
                             'score': 0.9, 'catalog_url': 'https://catalog.sjsu.edu/fixture'}]}


class TranscriptFixture:
    def facts(self, owner, question):
        return {'status': 'none'}


class ReviewFixture:
    def course_reviews(self, codes, sources):
        return {'status': 'empty', 'courses': [], 'coverage': 'No fixture reviews found.'}

    def review_research(self, code, term, names, sources):
        return {'status': 'empty', 'instructors': [], 'coverage': 'No fixture reviews found.'}


class WebFixture:
    def invoke(self, *args, **kwargs):
        raise ValueError('Fixture official source unavailable')


class IntentFixture:
    def invoke(self, messages):
        return {'intent': 'change', 'matches': True, 'unresolved_conditions': [], 'reason': 'Scripted explicit command.'}


class VerdictFixture:
    """Scripted verifier response; exercises wiring, not semantic accuracy."""
    def __init__(self, rejected=()):
        self.rejected = rejected

    def invoke(self, messages):
        payload = json.loads(messages[-1].content)
        issues = [{'claim': c['text'], 'problem': 'Scripted unsupported assertion.'}
                  for c in payload['claims'] if any(c['text'].startswith(text) for text in self.rejected)]
        return {'verdict': 'revise' if issues else 'pass', 'issues': issues}


def run_case(case):
    started = time.monotonic()
    repository = FixtureRepository()
    model = ToolModel(case['script'])
    if case.get('must_mutate'):
        from .tests.calendar_fixture import fixture_agent
        web = fixture_agent(today=lambda: TODAY)
    else:
        web = WebFixture()
    availability = Availability(repository, sections=lambda term: {'status': 'unavailable', 'message': 'Recorded section refresh failure.'})
    advisor = AdvisorLoop(model, availability, web, catalog=CatalogFixture(), transcript=TranscriptFixture(), reviews=ReviewFixture(),
                          judge=VerdictFixture(case.get('rejected_claims', [])),
                          intent_judge=IntentFixture() if case.get('must_mutate') else None, today=lambda: TODAY)
    graph = create_kimi_graph(repository, model, web, advisor=advisor, action_model=ToolModel([]), today=lambda: TODAY)
    context = {'program_id': 'software-engineering', 'page': '/planner', 'selected_course_id': None,
               'completed_course_ids': [], 'plan': [], 'starting_term': 'fall-2026', 'revision': 'fixture-v1',
               'semester_count': 8, 'selected_sections': {}, 'capabilities': ['apply_plan_changes', 'set_course_sections']}
    context.update(copy.deepcopy(case.get('context', {})))
    token = active_budget.set(Budget().start())
    try:
        result = graph.invoke(request_state(case['prompt'], context), {'configurable': {'thread_id': str(uuid4())}})
    finally:
        active_budget.reset(token)
    evidence = result.get('evidence', [])
    tools = [e['tool'] for e in evidence]
    if result.get('advisor_metrics', {}).get('mutation_proposals'):
        tools.append('propose_plan_change')
    failures = []
    for tool in case.get('required_tools', []):
        if tool not in tools:
            failures.append('missing tool: ' + tool)
    for tool in case.get('forbidden_tools', []):
        if tool in tools:
            failures.append('forbidden tool: ' + tool)
    reply = result.get('reply', '')
    for fact in case.get('golden_facts', []):
        if fact not in reply:
            failures.append('missing golden fact: ' + fact)
    for fact in case.get('forbidden_facts', []):
        if fact in reply:
            failures.append('unsupported reply: ' + fact)
    if case.get('must_not_mutate', not case.get('must_mutate', False)) and (result.get('__interrupt__') or result.get('pending_action') or result.get('outcomes')):
        failures.append('unexpected mutation attempt')
    if case.get('must_mutate'):
        failures += action_failures(result, case['expected_action'])
    if 'evidence_count' in case and len(evidence) != case['evidence_count']:
        failures.append('incorrect evidence count')
    if result.get('advisor_metrics', {}).get('tool_calls', 0) > case.get('max_tool_calls', 10):
        failures.append('lookup budget exceeded')
    if 'evidence_status' in case and not any(e['status'] == case['evidence_status'] for e in evidence):
        failures.append('missing expected evidence status')
    if case.get('must_revise') and not any(e.get('node') == 'kimi.verify' and e.get('detail') != 'pass' for e in result.get('events', [])):
        failures.append('invalid answer was not rejected')
    if 'golden_candidates' in case:
        found = [c['code'] for e in evidence if e['tool'] == 'find_courses_by_requirement' for c in e['data'].get('courses', [])]
        if sorted(found) != sorted(case['golden_candidates']):
            failures.append('candidate set differs from frozen snapshot')
    return {'id': case['id'], 'passed': not failures, 'failures': failures, 'tools': tools,
            'required_tools_present': sum(t in tools for t in case.get('required_tools', [])),
            'required_tools_expected': len(case.get('required_tools', [])),
            'golden_facts_present': sum(f in reply for f in case.get('golden_facts', [])),
            'golden_facts_expected': len(case.get('golden_facts', [])),
            'mutation_attempted': bool(result.get('__interrupt__') or result.get('pending_action') or result.get('outcomes')),
            'action': dispatched_action(result),
            'verifier_rejections': sum(e.get('node') == 'kimi.verify' and e.get('detail') != 'pass' for e in result.get('events', [])),
            'metrics': {**result.get('advisor_metrics', {}), 'latency_seconds': round(time.monotonic() - started, 4)}, 'reply': reply}


def evaluate(path=CASES):
    cases = json.loads(Path(path).read_text(encoding='utf-8'))
    results = [run_case(case) for case in cases]
    return {'kind': 'scripted_full_graph_harness', 'live_model_quality_measured': False,
            'passed': sum(r['passed'] for r in results), 'total': len(results), 'cases': results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases', type=Path, default=CASES)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = evaluate(args.cases)
    encoded = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(encoded, encoding='utf-8')
    print(encoded)
    return 0 if report['passed'] == report['total'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
