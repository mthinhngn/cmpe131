"""Resume a fixed acceptance configuration through provider cooldowns.

Writes progress.json and failure-report.md beside the immutable run artifacts.
No application changes, account writes, or substituted model are performed.
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from . import evaluate_kimi_acceptance as evaluator


LOCATIONS = {
    'explicit_operation': 'Kimi decision: group field; agent_service/kimi_contracts.py (default none), before normalize_group in kimi_agent.py',
    'courses_in_order': 'Kimi decision: course_queries / steps.course_query / query',
    'retains_lab': 'Kimi section_numbers; section_actions.prepare_sections rejects missing required components',
    'complete_question': 'Kimi clarification reply before respond',
    'clarification': 'Kimi decision kind: expected clarify',
    'destination': 'Kimi steps.semester_slot (destination)',
    'destinations': 'Kimi reciprocal move destinations',
    'source': 'Kimi steps.source_semester_slot',
    'no_premature_mutation': 'Kimi first decision: condition not established before mutation proposal',
    'explicit_sources': 'Kimi research_sources: explicit source instruction',
    'no_repeated_mutation': 'Kimi response to controlled failure observation proposed another mutation',
    'terminal_response': 'Kimi response to controlled failure observation did not terminate with answer/clarify',
    'valid_schema': 'Structured output parsing / KimiDecision validation',
}


def now():
    return datetime.now(timezone.utc)


def read_rows(directory):
    path = directory / 'results.jsonl'
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()] if path.exists() else []


def report(directory):
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    rows = read_rows(directory)
    completed = {(r['case'], r['repeat']): r for r in rows if not r.get('provider_error')}
    lines = ['# Kimi acceptance run', '', f'Updated: {now().isoformat()}', '',
             f"Configuration: {manifest['model']}; max_tokens={manifest.get('max_tokens', 1800)}; repeats={manifest['repeats']}.", '',
             f"Completed trials: {len(completed)}/{60 * manifest['repeats']}; structural passes: "
             f"{sum(r['passed'] for r in completed.values())}; structural failures: "
             f"{sum(not r['passed'] for r in completed.values())}.", '',
             'Scope: live first decisions and controlled-observation responses. No graph, browser, API or database execution.',
             'Final-message semantic acceptance remains pending review. Provider failures are excluded from model-quality counts.', '',
             '| Case | Scenario | Passed / completed | Status |', '|---|---|---|---|']
    cases = manifest['matrix']['cases']
    for case in cases:
        trials = [r for (name, _), r in completed.items() if name == case['id']]
        status = 'not run' if not trials else ('FAIL' if any(not r['passed'] for r in trials) else 'structural PASS')
        scenario = case['prompt'].replace('|', '\\|').replace('\n', ' ')
        lines.append(f"| {case['id']} | {scenario} | {sum(r['passed'] for r in trials)}/{len(trials)} | {status} |")
    lines += ['', '## Failure details', '']
    for case in cases:
        failed = [r for (name, _), r in completed.items() if name == case['id'] and not r['passed']]
        if not failed:
            continue
        lines += [f"### {case['id']}: {case['prompt']}", '',
                  'Expected: ' + json.dumps(case['expected'], ensure_ascii=False), '']
        for row in failed:
            checks = [name for name, passed in row.get('checks', {}).items() if not passed]
            lines += [f"Trial {row['repeat'] + 1}; failed checks: {', '.join(checks)}.", '']
            for check in checks:
                lines.append('- ' + LOCATIONS.get(check, 'Kimi decision structural check: ' + check))
            lines += ['', 'Actual decision:', '', '```json', json.dumps(row.get('decision'), indent=2, ensure_ascii=False), '```', '']
    lines += ['## Provider interruptions', '', f"Recorded attempts: {sum(bool(r.get('provider_error')) for r in rows)}.",
              'See results.jsonl for status codes, Retry-After headers and trial identity. These attempts do not count as model failures.', '']
    (directory / 'failure-report.md').write_text('\n'.join(lines), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label', required=True)
    args = parser.parse_args()
    if Path(args.label).name != args.label:
        parser.error('Use a simple run label.')
    directory = evaluator.ROOT / 'tmp/kimi-evals' / args.label
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    progress_path = directory / 'progress.json'
    lock_path = directory / 'runner.lock'
    lock_fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.write(lock_fd, str(os.getpid()).encode())
    os.close(lock_fd)

    def progress(status, **extra):
        value = dict(status=status, pid=os.getpid(), updated_at=now().isoformat(), **extra)
        progress_path.write_text(json.dumps(value, indent=2), encoding='utf-8')
        print(json.dumps(value), flush=True)

    try:
        # Refresh an existing report and honor the most recent provider cooldown
        # before making even one new request after a restart.
        report(directory)
        rows = read_rows(directory)
        cooldown = 0
        if rows and rows[-1].get('status_code') == 429:
            cooldown = int(rows[-1].get('rate_limits', {}).get('retry-after', '60')) + 3
        while True:
            if cooldown:
                deadline = time.monotonic() + cooldown
                retry_at = (now() + timedelta(seconds=cooldown)).isoformat()
                while time.monotonic() < deadline:
                    progress('provider_cooldown', retry_at=retry_at,
                             remaining_seconds=round(deadline-time.monotonic()))
                    time.sleep(min(60, max(0, deadline-time.monotonic())))
            progress('running')
            sys.argv = ['evaluate_kimi_acceptance', '--label', args.label, '--repeats', str(manifest['repeats']),
                        '--delay', '35', '--max-tokens', str(manifest['max_tokens']), '--resume']
            status = evaluator.main()
            report(directory)
            if status == 0:
                progress('complete', report=str(directory / 'failure-report.md'))
                return
            row = read_rows(directory)[-1]
            if row.get('status_code') != 429:
                progress('stopped_provider_error', provider_error=row.get('provider_error'))
                return
            cooldown = int(row.get('rate_limits', {}).get('retry-after', '60')) + 3
    except Exception:
        progress('stopped_runner_error')
        raise
    finally:
        lock_path.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
