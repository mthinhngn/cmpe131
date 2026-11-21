"""Scorer + report for the requirement-answers-for-10-majors eval.

Labels per case:
  correct      complete and correct list / yes-no / rule / gap / clarification, backed by evidence
  wrong        any incorrect course, section, seat, membership or policy claim (incl. incomplete lists
               presented as the answer, silently picking one meaning of an ambiguous name, stating a
               needs_review conflict value as fact, or a list for a term that has no data)
  unverified   the content is right but no evidence in the response payload backs it
  no_answer    data could answer, but the agent declined or gave a generic failure
  system_error timeout, HTTP error, 5xx, or agent status=failed

Course lists are scored by code (missing/extra) deterministically. Everything else, and every list
with a discrepancy, goes to an LLM judge that must cite evidence IDs taken from the agent response
payload (citations[].evidence_id, or url:<url> for a URL printed in the reply). The judge model is
NOT the runtime under test (gpt-4.1): default gpt-5.4-mini, override with REQ10_JUDGE_MODEL.

Usage:
  py -m agent_service.evals.req10_score --run tmp/req10-runs/practice-... [--run <held-out run dir>]
Writes <run>/scores.jsonl and <run>/report.{json,md}; with two runs (practice + held_out) it also
writes the combined report with the practice-held-out gap next to the first run.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from agent_service.evals import req10_data as D  # noqa: E402

LABELS = ['correct', 'wrong', 'unverified', 'no_answer', 'system_error']
JUDGE_MODEL = os.getenv('REQ10_JUDGE_MODEL', 'gpt-5.4-mini')
URL_RE = re.compile(r'https?://[^\s)\]>"\'`]+')
SLASH_RE = re.compile(r'\s*/\s*(\d{1,3}[A-Z]{0,3})\b')


def known_subjects() -> set[str]:
    subjects = {c.split()[0] for c in D.course_facts()}
    for r in D.records():
        inc, exc = D.rule_codes(r)
        subjects |= {c.split()[0] for c in inc + exc}
    return subjects - {'US', 'UD', 'GE', 'PE', 'WID', 'AREA'}


def extract_codes(text: str, subjects: set[str]) -> list[str]:
    out = []
    for m in D.CODE_RE.finditer(text or ''):
        subj, num = m.group(1), m.group(2)
        if subj not in subjects:
            continue
        for code in [f'{subj} {num}'] + [f'{subj} {n}' for n in SLASH_RE.findall(text[m.end():m.end() + 40])[:6]]:
            if code not in out:
                out.append(code)
    return out


def recompute(case: dict) -> dict:
    """Recompute section-derived expectations from the live DB (used on term-snapshot drift)."""
    der, exp = case['derivation'], dict(case['expected'])
    if der.get('type') in ('designation_set', 'program_set'):
        s = D.derive(der)
        exp.update(codes=s['required'], allowed_codes=s['allowed'], sections=s['sections'])
    elif der.get('type') == 'course_fact' and exp.get('offered') is not None:
        s = D.derive(der)
        exp.update(offered='yes' if s.get('offered') else 'no', class_numbers=s.get('class_numbers', []))
    return exp


def evidence_items(response: dict) -> tuple[list[dict], set[str]]:
    items, ids = [], set()
    for c in response.get('citations') or []:
        eid = c.get('evidence_id')
        if eid:
            items.append({'id': eid, 'title': c.get('title'), 'url': c.get('url'), 'fetched_at': c.get('fetched_at')})
            ids.add(eid)
    for u in URL_RE.findall(response.get('reply') or ''):
        u = u.rstrip('.,;:')
        key = f'url:{u}'
        if key not in ids:
            items.append({'id': key, 'url': u})
            ids.add(key)
    return items, ids


JUDGE_SYSTEM = """You grade one answer from a university course-planning assistant against a frozen ground truth.
Ground truth comes from official SJSU catalog requirement records and the imported class schedule; it is authoritative.
Return ONLY a JSON object with keys:
  "label": one of "correct", "wrong", "unverified", "no_answer"
  "wrong_claims": list of short strings (each incorrect course/section/seat/membership/policy claim; empty if none)
  "extra_codes_claimed": list of course codes from DETERMINISTIC.extra that the answer presents as satisfying/belonging to the asked requirement or as matching the asked term/filter (NOT codes merely mentioned as context, prerequisites, or explicitly excluded)
  "missing_is_disclosed": true if the answer explicitly says its list is partial/truncated, else false
  "evidence_ids": list of IDs copied exactly from EVIDENCE that support the answer's key claims (empty if none apply)
  "reason": one or two sentences
Label rules:
- "wrong": any incorrect claim; a list presented as the answer that misses expected codes (unless missing_is_disclosed, then judge the rest) or adds codes as members; asserting a needs_review conflict value as fact or failing a required conflict disclosure; silently picking one meaning of an ambiguous requirement name; listing sections/offerings for a term with no data; claiming a nonexistent course exists, has a title, counts, or is offered; contradicting a program effect (e.g. saying PE is required when the record says waived).
- "no_answer": the data could answer but the assistant declined, deflected to an advisor/website without answering, or gave a generic failure. (For kind=gap, honestly saying the term has no data is CORRECT, not no_answer. For kind=clarify, asking which pattern/meaning is CORRECT.)
- "unverified": the content matches the ground truth but nothing in EVIDENCE supports it.
- "correct": complete and correct per EXPECTED, with at least one supporting evidence ID. Exception: for kind=gap and kind=clarify no evidence is required (there is nothing to cite); never use "unverified" for them.
Kinds: list = exact set of codes (allowed_codes may appear or not); rule = convey the quoted rule faithfully, include named codes, do not present an invented/exhaustive list beyond the record; conflict = rule/list plus disclose that sources differ (when required_disclosure is true) without stating either value as fact; yes_no = the stated yes/no facts; gap = say there is no data for that term (no invented sections); clarify = ask which meaning or present all candidates (see EXPECTED.answer for acceptable variants).
Paraphrase is fine; do not require verbatim quotes. Do not penalize extra helpful context that is accurate."""


def judge(case: dict, exp: dict, response: dict, det: dict, evidence: list[dict]) -> dict:
    key = os.getenv('OPENAI_API_KEY')
    if not key:
        from dotenv import load_dotenv
        load_dotenv(ROOT / '.env', encoding='utf-8-sig')
        load_dotenv(ROOT / 'agent_service/.env', encoding='utf-8-sig')
        key = os.getenv('OPENAI_API_KEY')
    if not key:
        raise RuntimeError('OPENAI_API_KEY is required for the judge')
    trimmed = {k: v for k, v in exp.items() if k not in ('term_sets', 'sections')}
    if exp.get('term_sets'):
        trimmed['term_sets_if_answer_lists_a_term'] = exp['term_sets']
    events = [{'node': e.get('node'), 'detail': str(e.get('detail', ''))[:300]} for e in (response.get('events') or [])][:40]
    user = json.dumps({
        'CASE': {'id': case['id'], 'workspace_major': case['major'], 'question_major': case.get('question_major'),
                 'case_type': case['case_type'], 'requirement_type': case['requirement_type'], 'question': case['question']},
        'EXPECTED': trimmed, 'DETERMINISTIC': det,
        'ANSWER': response.get('reply', ''), 'EVIDENCE': evidence, 'AGENT_EVENTS': events,
    }, ensure_ascii=False)
    body = {'model': JUDGE_MODEL, 'response_format': {'type': 'json_object'},
            'messages': [{'role': 'system', 'content': JUDGE_SYSTEM}, {'role': 'user', 'content': user}]}
    if JUDGE_MODEL.startswith(('gpt-5', 'o')):
        body['reasoning_effort'] = os.getenv('REQ10_JUDGE_EFFORT', 'low')
    else:
        body['temperature'] = 0
    last = None
    for _ in range(3):
        try:
            r = httpx.post('https://api.openai.com/v1/chat/completions', json=body, timeout=120,
                           headers={'Authorization': f'Bearer {key}'})
            data = r.json()
            if r.status_code == 429 and (data.get('error') or {}).get('code') in {
                'insufficient_quota', 'credit_balance_exhausted', 'project_spend_limit_exceeded',
                'organization_spend_limit_exceeded', 'organization_usage_limit_exceeded',
            }:
                return {'label': None, 'reason': 'judge billing limit', 'billing_error': data['error']['code'], '_usage': {}}
            r.raise_for_status()
            out = json.loads(data['choices'][0]['message']['content'])
            out['_usage'] = data.get('usage', {})
            out['_model'] = data.get('model', JUDGE_MODEL)
            return out
        except Exception as error:  # retry transient judge failures
            last = error
    return {'label': None, 'reason': f'judge failed: {type(last).__name__}: {last}', '_usage': {}}


def score_case(case: dict, raw: dict | None, subjects: set[str], drift: bool, use_judge: bool = True) -> dict:
    out = {'id': case['id'], 'major': case['major'], 'case_type': case['case_type'],
           'requirement_type': case['requirement_type'], 'kind': case['expected']['kind']}
    if raw is None:
        return {**out, 'label': None, 'reason': 'not run'}
    resp = raw.get('response') or {}
    out['elapsed_seconds'] = raw.get('elapsed_seconds')
    out['agent_metrics'] = resp.get('advisor_metrics')
    if raw.get('error') or raw.get('timeout') or not resp:
        return {**out, 'label': 'system_error', 'reason': raw.get('error') or 'timeout'}
    if resp.get('status') == 'failed':
        return {**out, 'label': 'system_error', 'reason': 'agent status failed: ' + (resp.get('reply') or '')[:200]}
    out['status'] = resp.get('status')
    exp = recompute(case) if drift else case['expected']
    reply = resp.get('reply') or ''
    found = extract_codes(reply, subjects)
    question_codes = set(extract_codes(case['question'], subjects))
    required = list(exp.get('codes') or [])
    allowed = set(exp.get('allowed_codes') or []) | question_codes
    if exp.get('term_sets'):
        for s in exp['term_sets'].values():
            allowed |= set(s['required']) | set(s['allowed'])
    forbidden = set(exp.get('forbidden_codes') or [])
    det = {'found_codes': found, 'missing': [c for c in required if c not in found],
           'extra': [c for c in found if c not in required and c not in allowed and c not in forbidden],
           'forbidden_mentioned': [c for c in found if c in forbidden], 'drift_recomputed': drift}
    if resp.get('status') == 'awaiting_action':
        det['unrequested_action'] = (resp.get('action') or {}).get('kind') or True
    evidence, valid_ids = evidence_items(resp)
    sourced = bool(valid_ids)
    out.update(det=det, sourced=sourced)
    clean_list = (exp['kind'] == 'list' and required and not det['missing'] and not det['extra']
                  and not det['forbidden_mentioned'] and not det.get('unrequested_action') and not (exp.get('conflict') or {}).get('required_disclosure'))
    if clean_list:
        return {**out, 'label': 'correct' if sourced else 'unverified', 'reason': 'exact code set', 'method': 'deterministic'}
    if not use_judge:
        return {**out, 'label': None, 'reason': 'needs judge', 'method': 'pending'}
    j = judge(case, exp, resp, det, evidence)
    label = j.get('label') if j.get('label') in LABELS[:4] else None
    cited = [e for e in (j.get('evidence_ids') or []) if e in valid_ids]
    reasons = [j.get('reason', '')]
    if label is None:
        return {**out, 'label': None, 'reason': j.get('reason'), 'method': 'judge_failed', 'judge': j}
    # deterministic guards on top of the judge
    if exp['kind'] == 'list' and det['missing'] and label == 'correct' and not j.get('missing_is_disclosed'):
        label, reasons = 'wrong', reasons + [f'missing codes {det["missing"]}']
    if j.get('extra_codes_claimed') and label in ('correct', 'unverified'):
        label, reasons = 'wrong', reasons + [f'extra codes claimed {j["extra_codes_claimed"]}']
    # an honest "no data for that term" or a clarifying question has nothing to cite
    if label == 'unverified' and exp['kind'] in ('gap', 'clarify') and not j.get('wrong_claims'):
        label, reasons = 'correct', reasons + ['gap/clarify needs no evidence']
    if label == 'correct' and not cited and exp['kind'] not in ('gap', 'clarify'):
        label, reasons = 'unverified', reasons + ['judge cited no valid evidence id']
    return {**out, 'label': label, 'reason': ' | '.join(r for r in reasons if r), 'method': 'judge',
            'judge': {k: j.get(k) for k in ('label', 'wrong_claims', 'extra_codes_claimed', 'missing_is_disclosed', 'evidence_ids', 'reason', '_model', '_usage', 'billing_error')},
            'cited_evidence': cited}


def same_instant(a, b):
    """Compare ISO timestamps to the millisecond ('...08.015Z' == '...08.015000'); None if unparseable."""
    from datetime import datetime
    try:
        pa, pb = (datetime.fromisoformat(x.replace('Z', '+00:00')).replace(tzinfo=None) for x in (a, b))
    except (AttributeError, TypeError, ValueError):
        return None
    return abs((pa - pb).total_seconds()) < 0.001


def table(rows: list[dict], key: str) -> list[dict]:
    groups = defaultdict(Counter)
    for r in rows:
        groups[r[key]][r['label'] or 'unscored'] += 1
    out = []
    for k in sorted(groups):
        c = groups[k]
        n = sum(c.values())
        out.append({key: k, 'n': n, **{l: c.get(l, 0) for l in LABELS + ['unscored']},
                    'accuracy': round(c.get('correct', 0) / n, 3) if n else None})
    return out


def summarize(rows: list[dict]) -> dict:
    c = Counter(r['label'] or 'unscored' for r in rows)
    n = len(rows)
    usage = Counter()
    for r in rows:
        for k, v in ((r.get('judge') or {}).get('_usage') or {}).items():
            if isinstance(v, (int, float)):
                usage[k] += v
    return {'n': n, 'labels': dict(c), 'accuracy': round(c.get('correct', 0) / n, 3) if n else None,
            'by_major': table(rows, 'major'), 'by_requirement_type': table(rows, 'requirement_type'),
            'by_case_type': table(rows, 'case_type'), 'judge_model': JUDGE_MODEL, 'judge_usage': dict(usage),
            'agent_metrics_total': {k: sum((r.get('agent_metrics') or {}).get(k, 0) or 0 for r in rows
                                           if isinstance((r.get('agent_metrics') or {}).get(k, 0), (int, float)))
                                    for k in ('model_rounds', 'tool_calls')}}


def md_table(rows: list[dict], key: str) -> str:
    cols = [key, 'n'] + LABELS + ['accuracy']
    lines = ['| ' + ' | '.join(cols) + ' |', '|' + '---|' * len(cols)]
    for r in rows:
        lines.append('| ' + ' | '.join(str(r.get(c, '')) for c in cols) + ' |')
    return '\n'.join(lines)


def score_run(run_dir: Path, use_judge=True) -> tuple[dict, list[dict]]:
    meta = json.loads((run_dir / 'run_meta.json').read_text(encoding='utf-8'))
    doc = json.loads((ROOT / meta['cases_file']).read_text(encoding='utf-8')) if not Path(meta['cases_file']).is_absolute() \
        else json.loads(Path(meta['cases_file']).read_text(encoding='utf-8'))
    raws = {}
    for line in (run_dir / 'raw_responses.jsonl').read_text(encoding='utf-8').splitlines():
        if line.strip():
            r = json.loads(line)
            raws[r['id']] = r
    drift = bool(meta.get('live_term_stamps')) and any(
        same_instant(meta['live_term_stamps'].get(t, {}).get('lastImportedAt'), v.get('lastImportedAt')) is False
        for t, v in meta['frozen_term_stamps'].items() if t in meta['live_term_stamps'])
    subjects = known_subjects()
    cases = [c for c in doc['cases'] if c['id'] in raws]
    rows = []
    judge_billing = None
    for case in cases:
        row = score_case(case, raws.get(case['id']), subjects, drift, use_judge)
        rows.append(row)
        judge_billing = (row.get('judge') or {}).get('billing_error')
        if judge_billing:
            break
    with (run_dir / 'scores.jsonl').open('w', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    summary = {'split': doc['split'], 'run_dir': str(run_dir), 'cases_in_split': len(doc['cases']), 'cases_run': len(raws),
               'term_snapshot_drift': drift, 'model_under_test': meta.get('model_under_test'),
               'judge_billing_error': judge_billing, **summarize(rows)}
    (run_dir / 'report.json').write_text(json.dumps(summary, indent=1), encoding='utf-8')
    md = [f"# req10 {doc['split']} - {len(rows)} scored of {len(doc['cases'])}",
          f"model under test: {summary['model_under_test']}; judge: {JUDGE_MODEL}; drift recomputed: {drift}",
          f"labels: {summary['labels']}; accuracy: {summary['accuracy']}", '',
          '## By major', md_table(summary['by_major'], 'major'), '',
          '## By requirement type', md_table(summary['by_requirement_type'], 'requirement_type'), '',
          '## By case type', md_table(summary['by_case_type'], 'case_type')]
    (run_dir / 'report.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
    return summary, rows


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', action='append', required=True, help='run directory (repeat for practice and held-out)')
    ap.add_argument('--no-judge', action='store_true', help='deterministic part only (judge-needed cases stay unscored)')
    args = ap.parse_args(argv)
    summaries = {}
    for run in args.run:
        s, _ = score_run(Path(run), use_judge=not args.no_judge)
        summaries[s['split']] = s
        print(json.dumps({k: s[k] for k in ('split', 'n', 'labels', 'accuracy', 'term_snapshot_drift')}))
        if s['judge_billing_error']:
            raise SystemExit(f"Stopped after {s['n']} scoring attempts: {s['judge_billing_error']}")
    if 'practice' in summaries and 'held_out' in summaries:
        p, h = summaries['practice'], summaries['held_out']
        gap = {'overall': round((p['accuracy'] or 0) - (h['accuracy'] or 0), 3), 'by_case_type': {}, 'by_major': {}}
        for dim, key in (('by_case_type', 'case_type'), ('by_major', 'major')):
            hp = {r[key]: r['accuracy'] for r in h[dim]}
            for r in p[dim]:
                if r[key] in hp and r['accuracy'] is not None and hp[r[key]] is not None:
                    gap[dim][r[key]] = round(r['accuracy'] - hp[r[key]], 3)
        combined = {'practice': {k: p[k] for k in ('n', 'labels', 'accuracy')},
                    'held_out': {k: h[k] for k in ('n', 'labels', 'accuracy')}, 'gap_practice_minus_held_out': gap}
        out = Path(args.run[0]) / 'combined_report.json'
        out.write_text(json.dumps(combined, indent=1), encoding='utf-8')
        print(json.dumps(combined['gap_practice_minus_held_out']))


if __name__ == '__main__':
    main()
