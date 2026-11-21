"""Live runner for the requirement-answers-for-10-majors eval.

Each case runs as a FRESH GUEST through the Vite proxy (default http://localhost:5175),
exactly like ChatWidget: new cookie jar -> POST /api/v1/agent/session -> POST
/api/v1/agent/messages -> poll GET /api/v1/agent/requests/{id}?thread_id=...
(needs_context is answered with the same browser context; awaiting_action is recorded and
not executed, because these are read-only questions).

Usage (from the repo root):
  py -m agent_service.evals.req10_runner --split practice --ids req10-cmpe-program_list-01,...
  py -m agent_service.evals.req10_runner --split practice --limit 3
  py -m agent_service.evals.req10_runner --cases-file tmp/phase-d-private/requirements_10_majors_held_out.json
Outputs tmp/req10-runs/<split>-<UTC stamp>/{run_meta.json, raw_responses.jsonl}.
Never substitutes scripted results: a case that cannot run is recorded as a system error.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import httpx

ROOT = Path(__file__).resolve().parents[2]
SPLITS = {
    'practice': ROOT / 'agent_service/evals/requirements_10_majors_practice.json',
    'held_out': ROOT / 'tmp/phase-d-private/requirements_10_majors_held_out.json',
}
TERMINAL = {'completed', 'failed', 'awaiting_action'}


def browser_context(program_id: str) -> dict:
    """Fresh guest ChatWidget context (src/ChatWidget.tsx + agent-client.contextRevision)."""
    ctx = {'program_id': program_id, 'additional_program_ids': [], 'page': '/overview', 'selected_course_id': None,
           'completed_course_ids': [], 'plan': [], 'term_to_slot': {}, 'semester_count': 8, 'semester_slots': None,
           'starting_term': None, 'named_terms': [], 'capabilities': ['apply_plan_changes', 'set_course_sections'],
           'selected_sections': {}}
    revision = json.dumps({**ctx, 'capabilities': sorted(ctx['capabilities']), 'workspace_revision': 0},
                          separators=(',', ':'))
    return {**ctx, 'revision': revision}


def run_case(base: str, case: dict, timeout_s: float) -> dict:
    started = time.monotonic()
    out = {'id': case['id'], 'major': case['major'], 'question': case['question'],
           'started_at': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'http': [], 'polls': 0}
    headers = {'Origin': base, 'Referer': base + '/overview'}
    context = browser_context(case['major'])
    try:
        with httpx.Client(base_url=base, timeout=15, headers=headers) as client:  # new cookie jar per case
            r = client.post('/api/v1/agent/session', json={})
            out['http'].append(['session', r.status_code])
            r.raise_for_status()
            out['session_kind'] = r.json().get('kind')
            thread_id, request_id = str(uuid4()), str(uuid4())
            out.update(thread_id=thread_id, request_id=request_id)
            payload = {'thread_id': thread_id, 'request_id': request_id, 'message': case['question'],
                       'context': context, 'history': [], 'preferences': {}}
            r = client.post('/api/v1/agent/messages', json=payload)
            out['http'].append(['messages', r.status_code])
            r.raise_for_status()
            record = r.json()
            context_sent = False
            while record.get('status') not in TERMINAL:
                if time.monotonic() - started > timeout_s:
                    out['timeout'] = True
                    break
                if record.get('status') == 'needs_context' and not context_sent:
                    r = client.post(f'/api/v1/agent/requests/{request_id}/context', json={'thread_id': thread_id, 'context': context})
                    out['http'].append(['context', r.status_code])
                    r.raise_for_status()
                    record, context_sent = r.json(), True
                    continue
                time.sleep(1.0)
                r = client.get(f'/api/v1/agent/requests/{request_id}', params={'thread_id': thread_id})
                out['polls'] += 1
                if r.status_code != 200:
                    out['http'].append(['poll', r.status_code])
                    r.raise_for_status()
                record = r.json()
            out['response'] = record
    except httpx.HTTPStatusError as error:
        out['error'] = f'HTTP {error.response.status_code}: {error.response.text[:300]}'
        out['http_status'] = error.response.status_code
    except Exception as error:  # network failure, timeout, JSON error
        out['error'] = f'{type(error).__name__}: {str(error)[:300]}'
    out['elapsed_seconds'] = round(time.monotonic() - started, 2)
    return out


def preflight(base: str) -> dict:
    info = {}
    with httpx.Client(base_url=base, timeout=15) as client:
        for name, path in (('agent_health', '/api/v1/agent/health'), ('api_health', '/api/v1/health')):
            try:
                r = client.get(path)
                info[name] = r.json() if r.status_code == 200 else {'status_code': r.status_code}
            except Exception as error:
                info[name] = {'error': f'{type(error).__name__}: {error}'}
    return info


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--split', choices=sorted(SPLITS), default='practice')
    ap.add_argument('--cases-file')
    ap.add_argument('--ids', help='comma-separated case ids')
    ap.add_argument('--limit', type=int)
    ap.add_argument('--concurrency', type=int, default=1)
    ap.add_argument('--timeout', type=float, default=120)
    ap.add_argument('--base', default='http://localhost:5175')
    ap.add_argument('--out')
    ap.add_argument('--stop-after-errors', type=int, default=8, help='stop when this many consecutive cases hit 429/5xx/timeouts')
    args = ap.parse_args(argv)
    concurrency = max(1, min(4, args.concurrency))

    path = Path(args.cases_file) if args.cases_file else SPLITS[args.split]
    doc = json.loads(path.read_text(encoding='utf-8'))
    cases = doc['cases']
    if args.ids:
        wanted = [i.strip() for i in args.ids.split(',') if i.strip()]
        index = {c['id']: c for c in cases}
        missing = [i for i in wanted if i not in index]
        if missing:
            sys.exit(f'Unknown case ids: {missing}')
        cases = [index[i] for i in wanted]
    if args.limit:
        cases = cases[:args.limit]

    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    # held-out raw responses contain the private questions: keep them in the private folder
    default_root = ROOT / ('tmp/phase-d-private/runs' if doc['split'] == 'held_out' else 'tmp/req10-runs')
    out_dir = Path(args.out) if args.out else default_root / f'{doc["split"]}-{stamp}'
    out_dir.mkdir(parents=True, exist_ok=True)
    if (out_dir / 'raw_responses.jsonl').exists():
        ap.error('Choose an unused run directory.')
    pre = preflight(args.base)
    live_terms = {t['term']: {'sourceUpdatedOn': t.get('sourceUpdatedOn'), 'lastImportedAt': t.get('lastImportedAt')}
                  for t in (pre.get('api_health') or {}).get('scheduleTerms', [])}
    frozen_terms = {k: {'sourceUpdatedOn': v['sourceUpdatedOn'], 'lastImportedAt': v['lastImportedAt']} for k, v in doc['term_stamps'].items()}
    meta = {'split': doc['split'], 'cases_file': str(path.relative_to(ROOT)).replace('\\', '/') if path.is_relative_to(ROOT) else str(path),
            'cases_file_sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'base': args.base, 'started_at': stamp,
            'concurrency': concurrency, 'timeout_seconds': args.timeout, 'case_ids': [c['id'] for c in cases],
            'preflight': pre, 'frozen_term_stamps': frozen_terms, 'live_term_stamps': live_terms,
            'model_under_test': (pre.get('agent_health') or {}).get('model')}
    (out_dir / 'run_meta.json').write_text(json.dumps(meta, indent=1), encoding='utf-8')
    if (pre.get('agent_health') or {}).get('status') != 'ok':
        print('Agent health check failed; recording and aborting. Nothing was run.', file=sys.stderr)
        meta['aborted'] = 'agent health check failed'
        (out_dir / 'run_meta.json').write_text(json.dumps(meta, indent=1), encoding='utf-8')
        return 2

    raw_path = out_dir / 'raw_responses.jsonl'
    lock = threading.Lock()
    stop = threading.Event()
    consecutive = [0]
    done = []
    billing = []

    def worker(case):
        if stop.is_set():
            return None
        result = run_case(args.base, case, args.timeout)
        billing_error = ((result.get('response') or {}).get('advisor_metrics') or {}).get('billing_error')
        bad = result.get('timeout') or result.get('http_status') in (429, 500, 502, 503, 504) or (
            result.get('response', {}).get('status') == 'failed' and 'rate limit' in result.get('response', {}).get('reply', '').lower())
        with lock:
            if billing_error:
                billing.append(billing_error)
                stop.set()
            if result.get('timeout'):
                stop.set()
            consecutive[0] = consecutive[0] + 1 if bad else 0
            if consecutive[0] >= args.stop_after_errors:
                stop.set()
            with raw_path.open('a', encoding='utf-8') as f:
                f.write(json.dumps(result, ensure_ascii=False) + '\n')
            done.append(result['id'])
            status = result.get('response', {}).get('status') or result.get('error', 'error')
            print(f'[{len(done)}/{len(cases)}] {result["id"]} {status} {result["elapsed_seconds"]}s', flush=True)
        return result

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        for _ in as_completed([pool.submit(worker, c) for c in cases]):
            pass
    meta.update(finished_at=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'), completed_cases=len(done),
                stopped_early=stop.is_set(), not_run=[c['id'] for c in cases if c['id'] not in done],
                billing_error=billing[0] if billing else None)
    (out_dir / 'run_meta.json').write_text(json.dumps(meta, indent=1), encoding='utf-8')
    print(json.dumps({'out_dir': str(out_dir), 'ran': len(done), 'stopped_early': stop.is_set()}))
    return 3 if stop.is_set() else 0


if __name__ == '__main__':
    sys.exit(main())
