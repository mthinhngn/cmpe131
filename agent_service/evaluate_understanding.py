"""Opt-in paid evaluation of the request understanding interface, when implemented."""
import argparse
import importlib
import json
import os
from pathlib import Path
from .evaluate_conversations import models, Usage


def score_results(rows):
    expected_needs = found_needs = reply_correct = reply_total = 0
    by_repeat = {}
    misses = []
    for row in rows:
        expect, predicted = row['expected'], row.get('predicted', {})
        needs = set(expect.get('needs', []))
        missing = sorted(needs - set(predicted.get('needs', [])))
        expected_needs += len(needs)
        found_needs += len(needs) - len(missing)
        failures = ['missing need: ' + need for need in missing]
        counts = by_repeat.setdefault(str(row['repeat']), {'reply_correct': 0, 'reply_total': 0})
        if 'reply_to_open' in expect:
            correct = predicted.get('reply_to_open') == expect['reply_to_open']
            reply_total += 1
            reply_correct += int(correct)
            counts['reply_total'] += 1
            counts['reply_correct'] += int(correct)
            if not correct:
                failures.append('incorrect reply_to_open')
        if row.get('error'):
            failures.append('runtime: ' + row['error'])
        row.update(passed=not failures, failures=failures)
        if failures:
            misses.append({**row, 'expected_reply_to_open': expect.get('reply_to_open'),
                           'predicted_reply_to_open': predicted.get('reply_to_open')})
    for counts in by_repeat.values():
        counts['reply_to_open_accuracy'] = counts['reply_correct'] / counts['reply_total'] if counts['reply_total'] else None
    report = {'need_recall': found_needs / expected_needs if expected_needs else None,
              'reply_to_open_accuracy': reply_correct / reply_total if reply_total else None,
              'reply_to_open_correct': reply_correct, 'reply_to_open_total': reply_total,
              'per_repeat': by_repeat, 'misses': misses, 'cases': rows}
    report['passed'] = (report['need_recall'] is not None and report['need_recall'] >= .97 and
                        report['reply_to_open_accuracy'] is not None and report['reply_to_open_accuracy'] >= .95)
    return report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cases', type=Path, default=Path(__file__).with_name('evals') / 'kimi_understanding.json')
    p.add_argument('--repeats', type=int, default=1)
    p.add_argument('--output', type=Path)
    args = p.parse_args()
    if args.repeats < 1:
        p.error('repeats must be positive')
    try:
        module = importlib.import_module('agent_service.understanding')
    except ModuleNotFoundError as exc:
        if exc.name != 'agent_service.understanding':
            raise
        print('understanding step not built yet')
        return 0
    os.environ.update(LANGFUSE_PUBLIC_KEY='', LANGFUSE_SECRET_KEY='', LANGFUSE_TRACING_ENABLED='false', LANGCHAIN_TRACING_V2='false')
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / '.env', encoding='utf-8-sig')
    usage = Usage()
    _, small = models(usage)
    judge = small.with_structured_output(module.RequestUnderstanding, method='function_calling')
    rows = []
    cases = json.loads(args.cases.read_text(encoding='utf-8'))
    if not cases:
        p.error('no cases selected')
    for repeat in range(args.repeats):
        for case in cases:
            error = None
            try:
                result = module.understand(case['message'], case['recent'], case['open_request'], judge)
                output = module.RequestUnderstanding.model_validate(result).model_dump() if result is not None else {}
            except Exception as exc:
                output, error = {}, type(exc).__name__
            rows.append({'id': case['id'], 'repeat': repeat, 'expected': case['expect'], 'predicted': output, 'error': error})
    report = {'kind': 'kimi_understanding', **score_results(rows),
              'input_tokens': usage.input_tokens, 'output_tokens': usage.output_tokens}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    return int(not report['passed'])


if __name__ == '__main__':
    raise SystemExit(main())
