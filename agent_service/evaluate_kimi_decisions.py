"""Live, synthetic decision-only eval. Never dispatches tools or writes a workspace.

Run: python -m agent_service.evaluate_kimi_decisions --label baseline --repeats 3
Artifacts capture the exact prompt/schema and synthetic model decisions for comparison.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from .course_action_agent import MODEL_ID
from .kimi_agent import PROMPT, HELP
from .kimi_contracts import KimiDecision

CASES = [
    ('swap_exact', 'swap math33LA with CMPE50', 'swap'),
    ('swap_paraphrase', 'Exchange the places of MATH 33LA and CMPE 50 in my plan.', 'swap'),
    ('swap_vi', 'Đổi học kỳ của MATH 33LA và CMPE 50 cho nhau.', 'swap'),
    ('replace', 'Replace CMPE 50 with CMPE 125.', 'replace'),
    ('move', 'Move CMPE 50 from semester 7 to semester 5.', 'move'),
    ('add', 'Add CMPE 125 to semester 5.', 'add'),
    ('remove_vi', 'Xóa CMPE 50 khỏi kế hoạch.', 'remove'),
    ('negation', 'Do not swap MATH 33LA and CMPE 50.', 'no_action'),
    ('feasibility', 'Can I swap MATH 33LA and CMPE 50?', 'no_action'),
    ('ambiguous', 'Move CMPE 50.', 'clarify'),
    ('conditional', 'Research CMPE 125 instructors for Fall 2026 on Reddit and only replace CMPE 50 if the workload is lighter.', 'research_first'),
    ('greeting', 'Hi!', 'answer'),
]
CONTEXT = dict(program_id='computer-engineering', page='/planner', selected_course_id=None,
               starting_term='fall-2026', semester_count=8, completed_course_ids=[],
               capabilities=['apply_plan_changes', 'set_course_sections'], selected_sections={},
               term_to_slot={'fall-2026': 1, 'spring-2027': 2},
               plan=[dict(course_id='fixture-math33la', code='MATH 33LA', semester_slot=6, status='planned'),
                     dict(course_id='fixture-cmpe50', code='CMPE 50', semester_slot=7, status='planned')])


def score(d, expected):
    mutation = bool(d.get('steps') or d.get('section_numbers') or d.get('course_queries') or d.get('group', 'none') != 'none')
    if expected == 'no_action':
        return d['kind'] in ('answer', 'read', 'clarify') and not mutation
    if expected == 'research_first':
        return d['kind'] in ('research', 'clarify') and not mutation
    if expected in ('answer', 'clarify'):
        return d['kind'] == expected and bool(d.get('reply'))
    if d['kind'] != 'course_action':
        return False
    operation = d.get('operation', d.get('group'))
    from .interpretation import ActionIntent
    steps = [ActionIntent.model_validate(s).execution_step() if 'source' in s or 'destination' in s else s for s in d.get('steps', [])]
    if expected in ('swap', 'replace'):
        # Explicit intent is measured before any normalize_group repair.
        queries = d.get('course_queries') or [s['course_query'] for s in steps]
        codes = [q.replace(' ', '').casefold() for q in queries]
        correct = set(codes) == {'math33la', 'cmpe50'} if expected == 'swap' else codes == ['cmpe50', 'cmpe125']
        return operation == expected and len(codes) == 2 and correct
    kind = {'move': 'move_course_in_plan', 'add': 'add_course_to_plan', 'remove': 'remove_course_from_plan'}[expected]
    code = 'cmpe125' if expected == 'add' else 'cmpe50'
    return (len(steps) == 1 and steps[0]['kind'] == kind and steps[0]['course_query'].replace(' ', '').casefold() == code
            and (expected == 'remove' or steps[0].get('semester_slot') == 5)
            and (expected != 'move' or steps[0].get('source_semester_slot') == 7))


def summarize(rows, cases, repeats):
    """Count each completed trial once; provider failures are not model failures."""
    measured = {(r['case'], r['repeat']): r for r in rows if not r.get('provider_error')}
    expected = {(name, repeat) for name, *_ in cases for repeat in range(repeats)}
    measured = {key: row for key, row in measured.items() if key in expected}
    return dict(passed=sum(bool(r['passed']) for r in measured.values()), total=len(measured),
                expected=len(expected), complete=expected == set(measured),
                provider_failures=sum(bool(r.get('provider_error')) for r in rows),
                by_case={name: dict(passed=sum(bool(r['passed']) for (case, _), r in measured.items() if case == name),
                                    total=sum(case == name for case, _ in measured)) for name, *_ in cases})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--label', required=True)
    parser.add_argument('--repeats', type=int, default=3)
    parser.add_argument('--delay', type=float, default=35)
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    load_dotenv(root / '.env', encoding='utf-8-sig')
    directory = root / 'tmp' / 'kimi-evals' / args.label
    directory.mkdir(parents=True, exist_ok=args.resume)
    schema = KimiDecision.model_json_schema()
    manifest = dict(model=MODEL_ID, temperature=0, repeats=args.repeats, prompt=PROMPT, schema=schema,
                    context=CONTEXT, cases=CASES, scope='decision only; execution not attempted')
    manifest['fingerprint'] = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
    manifest_path = directory / 'manifest.json'
    if args.resume:
        previous = json.loads(manifest_path.read_text(encoding='utf-8'))
        if previous['fingerprint'] != manifest['fingerprint']:
            raise ValueError('Prompt/schema/cases changed: use a new label, not resume.')
    else:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    model = ChatGroq(model=MODEL_ID, temperature=0, max_retries=0, timeout=35, max_tokens=2500)
    planner = model.with_structured_output(KimiDecision, method='function_calling', include_raw=True)
    rows = [json.loads(line) for line in (directory / 'results.jsonl').read_text(encoding='utf-8').splitlines()] if args.resume else []
    completed = {(r['case'], r['repeat']) for r in rows if not r.get('provider_error')}
    for repeat in range(args.repeats):
        for name, request, expected in CASES:
            if (name, repeat) in completed:
                continue
            started = time.monotonic()
            row = dict(case=name, repeat=repeat, execution='not_attempted')
            try:
                result = planner.invoke([SystemMessage(content=PROMPT),
                    SystemMessage(content=json.dumps(dict(context=CONTEXT, help=HELP, preferences={}, observations={}), ensure_ascii=False)),
                    HumanMessage(content=request)])
                parsed = result.get('parsed')
                row.update(decision=parsed.model_dump() if parsed else None,
                           validation_error=type(result['parsing_error']).__name__ if result.get('parsing_error') else None,
                           passed=bool(parsed and score(parsed.model_dump(), expected)),
                           usage=getattr(result.get('raw'), 'usage_metadata', None),
                           proposed_arguments=[c.get('args') for c in getattr(result.get('raw'), 'tool_calls', [])])
            except Exception as exc:
                # No exception bodies: provider errors may contain request/account details.
                row.update(passed=False, provider_error=type(exc).__name__)
                response = getattr(exc, 'response', None)
                if response is not None:
                    row['rate_limits'] = {k: v for k, v in response.headers.items()
                                          if k.lower().startswith(('retry-after', 'x-ratelimit'))}
            row['seconds'] = round(time.monotonic() - started, 3)
            rows.append(row)
            with (directory / 'results.jsonl').open('a', encoding='utf-8') as out:
                out.write(json.dumps(row, ensure_ascii=False) + '\n')
            print(json.dumps({k: v for k, v in row.items() if k not in ('decision', 'usage')}), flush=True)
            (directory / 'summary.json').write_text(json.dumps(summarize(rows, CASES, args.repeats), indent=2), encoding='utf-8')
            if row.get('provider_error'):
                print('Stopped: provider failure; baseline is incomplete.', flush=True)
                return
            time.sleep(args.delay)
    summary = summarize(rows, CASES, args.repeats)
    (directory / 'summary.json').write_text(json.dumps(summary), encoding='utf-8')
    print(summary)


if __name__ == '__main__':
    main()
