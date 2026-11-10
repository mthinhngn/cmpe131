"""Execute the 60-case matrix against the live structured-output model.

This measures first decisions and model responses to controlled observations, NOT
browser/API execution. Semantic final-message review is explicitly left pending.
No user workspace, external research or application mutation is accessed.
"""
import argparse
import copy
import hashlib
import json
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from .course_action_agent import MODEL_ID
from .kimi_agent import PROMPT, HELP
from .kimi_contracts import KimiDecision
from .evaluate_kimi_decisions import summarize

ROOT = Path(__file__).resolve().parents[1]
MATRIX = ROOT / 'agent_service/evals/kimi_acceptance_en.json'


def norm(value):
    return ''.join(str(value).lower().split())


def fixture(case, matrix):
    context = dict(display_name=matrix['fixture']['account_name'], program_id='computer-engineering',
                   page='/planner', selected_course_id=None, starting_term='fall-2026', semester_count=8,
                   completed_course_ids=[], capabilities=['apply_plan_changes', 'set_course_sections'],
                   selected_sections={}, term_to_slot={'fall-2026': 1, 'spring-2027': 2},
                   plan=[dict(course_id=norm(p['course']), code=p['course'], semester_slot=p['semester'],
                              status='planned') for p in matrix['fixture']['plan']])
    observations = []
    if case.get('fixture') == 'after_cmpe50_move':
        context['plan'][1]['semester_slot'] = 5
    if case.get('fixture') == 'ambiguous_names':
        observations = [{'courses': [{'code': 'CMPE 131', 'title': 'Software Engineering I'},
                                    {'code': 'CMPE 133', 'title': 'Software Engineering II'}]}]
    if case.get('fixture') == 'ambiguous_instructors':
        observations = [{'instructors': [{'name': 'Alex Lee', 'course': 'CMPE 131'},
                                        {'name': 'Sam Lee', 'course': 'CMPE 133'}]}]
    if case.get('fixture') == 'published_sections':
        context['selected_sections'] = {'fall-2026': ['13101', '13103']}
        observations = [{'sections': [dict(courseCode='CMPE 131', classNumber=n, component=c,
                                          term='fall-2026', times=t)
                                      for n, c, t in [('13101', 'LEC', '9:00AM-10:00AM'),
                                                      ('13102', 'LEC', '1:00PM-2:00PM'),
                                                      ('13103', 'LAB', '3:00PM-4:00PM')]]}]
    if 'mock_response' in case:
        observations = [{'task': case['prompt'], 'result': case['mock_response'], 'completed': True}]
    return dict(context=context, help=HELP, preferences={}, observations=observations)


def score(case, decision, context):
    """Structural checks only; never mark unexecuted final requirements as passed."""
    d, e = decision, case['expected']
    from .interpretation import ActionIntent
    steps = [ActionIntent.model_validate(s).execution_step() if 'source' in s or 'destination' in s else s for s in d.get('steps', [])]
    mutation = bool(steps or d.get('section_numbers') or d.get('group', 'none') != 'none')
    checks = {}
    if case['category'] == 'return_failure':
        return {'terminal_response': d['kind'] in ('answer', 'clarify'),
                'no_repeated_mutation': not mutation, 'nonempty_reply': bool(d.get('reply', '').strip())}
    if e['clarification']:
        checks.update(clarification=d['kind'] == 'clarify', no_mutation=not mutation,
                      complete_question='?' in d.get('reply', '') and len(d.get('reply', '').split()) >= 4)
        return checks
    if e['agent'] == 'none':
        checks.update(direct=d['kind'] == 'answer', no_mutation=not mutation,
                      nonempty_reply=bool(d.get('reply', '').strip()))
        return checks
    if e['agent'] == 'research':
        checks.update(evidence_route=d['kind'] in ('read', 'research'), no_premature_mutation=not mutation)
        # Multi-course comparisons may retrieve one course at a time. Their full
        # arguments/conditions are assessed in end-to-end review, not fabricated here.
        checks['has_lookup'] = bool(d.get('query', '').strip())
        args = e['arguments']
        if args.get('sources'):
            checks['explicit_sources'] = set(args['sources']) <= set(d.get('research_sources', []))
        return checks
    checks['action_route'] = d['kind'] == 'course_action'
    op, args = e['operation'], e['arguments']
    kinds = {'add': 'add_course_to_plan', 'remove': 'remove_course_from_plan', 'move': 'move_course_in_plan'}
    queries = d.get('course_queries') or [s['course_query'] for s in steps]
    expected_courses = args.get('courses') or ([args['course']] if 'course' in args else [])
    if op == 'select_sections':
        queries = [d.get('query', '')]
        checks['sections'] = set(args['class_numbers']) <= set(d.get('section_numbers', []))
        checks['term'] = args['term'] == d.get('section_term')
        checks['no_plan_steps'] = not steps
        if args.get('preserve_required_components'):
            checks['retains_lab'] = '13103' in d.get('section_numbers', [])
    elif op in ('swap', 'replace'):
        checks['explicit_operation'] = d.get('group') == op
        checks['pair'] = len(queries) == 2
        if steps:
            checks['step_kinds'] = [s['kind'] for s in steps] == (
                [kinds['move'], kinds['move']] if op == 'swap' else [kinds['remove'], kinds['add']])
            if args.get('destinations'):
                checks['destinations'] = [s.get('semester_slot') for s in steps] == args['destinations']
            if args.get('destination'):
                checks['destination'] = steps[-1].get('semester_slot') == args['destination']
        # For named groups the executor derives slots from the unchanged fixture.
    else:
        operations = args.get('operations', [op])
        checks['step_kinds'] = [s['kind'] for s in steps] == [kinds[k] for k in operations]
        checks['independent_group'] = d.get('group', 'none') == 'none'
        if 'destination' in args:
            checks['destination'] = bool(steps) and all(s.get('semester_slot') == args['destination']
                for s in steps if s['kind'] in (kinds['add'], kinds['move']))
        if isinstance(args.get('source'), int):
            checks['source'] = bool(steps) and steps[0].get('source_semester_slot') == args['source']
    checks['courses_in_order'] = [norm(q) for q in queries] == [norm(q) for q in expected_courses]
    if args.get('preserve'):
        checks['preserve_others'] = not set(map(norm, queries)) & set(map(norm, args['preserve']))
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label', required=True)
    parser.add_argument('--repeats', type=int, default=3)
    parser.add_argument('--delay', type=float, default=30)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--max-tokens', type=int, default=900)
    args = parser.parse_args()
    if args.repeats < 1 or args.delay < 0 or args.max_tokens < 1 or Path(args.label).name != args.label:
        parser.error('Use a simple label, positive repeats and nonnegative delay.')
    matrix = json.loads(MATRIX.read_text(encoding='utf-8'))
    load_dotenv(ROOT / '.env', encoding='utf-8-sig')
    directory = ROOT / 'tmp/kimi-evals' / args.label
    directory.mkdir(parents=True, exist_ok=args.resume)
    manifest = dict(model=MODEL_ID, max_tokens=args.max_tokens, prompt=PROMPT, help=HELP, schema=KimiDecision.model_json_schema(),
                    matrix=matrix, repeats=args.repeats, temperature=0,
                    scope='Live first decisions and controlled-observation model responses; no graph/browser/API execution',
                    runner_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    manifest['fingerprint'] = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
    manifest_path = directory / 'manifest.json'
    if args.resume:
        if json.loads(manifest_path.read_text(encoding='utf-8'))['fingerprint'] != manifest['fingerprint']:
            raise ValueError('Inputs changed; use a new label.')
    else:
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    results = directory / 'results.jsonl'
    rows = [json.loads(line) for line in results.read_text(encoding='utf-8').splitlines()] if results.exists() else []
    done = {(r['case'], r['repeat']) for r in rows if not r.get('provider_error')}
    planner = ChatGroq(model=MODEL_ID, temperature=0, timeout=35, max_retries=0,
                       max_tokens=args.max_tokens).with_structured_output(KimiDecision, method='function_calling', include_raw=True)
    for repeat in range(args.repeats):
        for case in matrix['cases']:
            if (case['id'], repeat) in done:
                continue
            extra = fixture(case, matrix)
            messages = [SystemMessage(content=PROMPT), SystemMessage(content=json.dumps(extra))]
            messages += [HumanMessage(content=h['content']) if h['role'] == 'user' else AIMessage(content=h['content'])
                         for h in case.get('history', [])]
            messages += [HumanMessage(content=case['prompt'])]
            row = dict(case=case['id'], repeat=repeat, category=case['category'], execution='not_attempted',
                       mode='controlled_observation' if 'mock_response' in case else 'live_first_decision',
                       final_requirements=case['expected']['final_message_requirements'], final_review='pending')
            started = time.monotonic()
            try:
                result = planner.invoke(messages)
                parsed = result.get('parsed')
                decision = parsed.model_dump() if parsed else None
                checks = score(case, decision, extra['context']) if decision else {'valid_schema': False}
                row.update(decision=decision, checks=checks, passed=all(checks.values()),
                           validation_error=type(result['parsing_error']).__name__ if result.get('parsing_error') else None,
                           usage=getattr(result.get('raw'), 'usage_metadata', None))
            except Exception as exc:
                row.update(passed=False, provider_error=type(exc).__name__)
                response = getattr(exc, 'response', None)
                if response is not None:
                    row['status_code'] = response.status_code
                    row['rate_limits'] = {k: v for k, v in response.headers.items()
                                          if k.lower().startswith(('retry-after', 'x-ratelimit'))}
            row['seconds'] = round(time.monotonic() - started, 3)
            rows.append(row)
            with results.open('a', encoding='utf-8') as out:
                out.write(json.dumps(row) + '\n')
            summary = summarize(rows, [(c['id'],) for c in matrix['cases']], args.repeats)
            summary.update(scope=manifest['scope'], final_message_review='pending', application_execution='not_attempted')
            (directory / 'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
            print(json.dumps({k: v for k, v in row.items() if k not in ('decision', 'usage', 'final_requirements')}), flush=True)
            if row.get('provider_error'):
                print('Provider unavailable; stopped without treating unavailable trials as model failures. Resume with unchanged inputs.', flush=True)
                return 2
            if len(done) + 1 < len(matrix['cases']) * args.repeats:
                time.sleep(args.delay)
            done.add((case['id'], repeat))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
