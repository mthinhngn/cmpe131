"""Ground-truth derivation for the "requirement answers for 10 majors" eval.

Independent of agent code by design: this module never imports agent_service
runtime modules. Expectations come from
  * the requirement record snapshot api/prisma/data/requirements/2026-2027/checked.json
  * read-only SQL against the catalog database (Course, UniversityCourseRecord,
    Term, UniversitySectionRecord evidence: attributes/openSeats/mode/days).

Section designation semantics (our own reading of the schedule "attributes" column):
  "GE: 3B+US1" -> tokens 3B, US1. Parents: 1A/1B/1C -> Area 1, 3A/3B -> Area 3,
  5A/5B/5C -> Area 5, UD tokens -> Upper Division GE, US tokens -> American Institutions.
  Ambiguous tokens are never required, only tolerated ("allowed"):
    bare "3" (GE: WID+3, GE: 3+US23) - Area 3 vs UD Area 3 unclear
    bare "US" (GE: 4+US) - which US area unclear
    "1Bor4" - 1B or 4
  "GWAR" attributes are on graduate courses; they are not the undergraduate GWAR record.
  Sections not seen in the latest import (lastSeenAt < Term.lastImportedAt) are tolerated only.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / 'api/prisma/data/requirements/2026-2027/checked.json'
CATALOG_YEAR = '2026-2027'

MAJORS = [
    'computer-engineering', 'software-engineering', 'electrical-engineering-bs', 'mechanical-engineering-bs',
    'civil-engineering-bs', 'aerospace-engineering-bs', 'nursing-bs',
    'business-administration-general-business-concentration-bs',
    'business-administration-finance-concentration-bs',
    'business-administration-accounting-concentration-bs',
]

# program_effects target ids use short keys; map them onto campus record keys.
EFFECT_TARGET_TO_CAMPUS_KEY = {
    'ge-1a': 'ge-area-1a', 'ge-1b': 'ge-area-1b', 'ge-1c': 'ge-area-1c', 'ge-2': 'ge-area-2',
    'ge-3b': 'ge-area-3b', 'ge-4': 'ge-area-4', 'ge-5a': 'ge-area-5a', 'ge-5b': 'ge-area-5b',
    'ge-5c': 'ge-area-5c', 'ud-2-5': 'ud-area-2-or-5', 'ud-3': 'ud-area-3', 'ud-4': 'ud-area-4',
    'pe': 'physical-education', 'wid': 'writing-in-the-disciplines', 'gwar': 'gwar',
    'us1': 'us1', 'us2': 'us2', 'us3': 'us3',
}

_DEFINITE = {
    '1A': {'ge-area-1a', 'ge-area-1'}, '1B': {'ge-area-1b', 'ge-area-1'}, '1C': {'ge-area-1c', 'ge-area-1'},
    '2': {'ge-area-2'}, '3A': {'ge-area-3a', 'ge-area-3'}, '3B': {'ge-area-3b', 'ge-area-3'},
    '4': {'ge-area-4'}, 'AREA 4': {'ge-area-4'}, '5A': {'ge-area-5a', 'ge-area-5'},
    '5B': {'ge-area-5b', 'ge-area-5'}, '5C': {'ge-area-5c', 'ge-area-5'}, '6': {'ge-area-6'},
    'UD 2/5': {'ud-area-2-or-5', 'upper-division-ge'}, 'UD 3': {'ud-area-3', 'upper-division-ge'},
    'UD 4': {'ud-area-4', 'upper-division-ge'}, 'WID': {'writing-in-the-disciplines'},
    'US1': {'us1', 'american-institutions'}, 'US23': {'us2', 'us3', 'american-institutions'},
    'E': {'legacy-area-e'}, 'US': {'american-institutions'},
}
_AMBIGUOUS = {
    '3': {'ge-area-3', 'ge-area-3a', 'ge-area-3b', 'ud-area-3', 'upper-division-ge'},
    'US': {'us1', 'us2', 'us3'},
    '1BOR4': {'ge-area-1b', 'ge-area-1', 'ge-area-4'},
}


def designations(attributes: str) -> tuple[set[str], set[str], list[str]]:
    """Return (definite keys, ambiguous keys, unparsed tokens) for one section attribute string."""
    text = (attributes or '').strip()
    definite, ambiguous, unparsed = set(), set(), []
    if not text:
        return definite, ambiguous, unparsed
    if text == 'PE: PhysEd':
        return {'physical-education'}, ambiguous, unparsed
    if text == 'WID':
        return {'writing-in-the-disciplines'}, ambiguous, unparsed
    if text == 'GWAR':
        return {'graduate-gwar-attribute'}, ambiguous, unparsed
    if text.startswith('AI:'):
        tokens = [text[3:].strip().upper()]
    elif text.startswith('GE:'):
        tokens = [t.strip().upper() for t in text[3:].split('+')]
    else:
        return definite, ambiguous, [text]
    for token in tokens:
        token = re.sub(r'\s+', ' ', token)
        if token == 'US3':
            definite |= {'us3', 'american-institutions'}
            continue
        hit = False
        if token in _DEFINITE:
            definite |= _DEFINITE[token]
            hit = True
        if token in _AMBIGUOUS:
            ambiguous |= _AMBIGUOUS[token]
            hit = True
        if not hit:
            unparsed.append(token)
    return definite, ambiguous - definite, unparsed


def database_url() -> str:
    from dotenv import load_dotenv
    load_dotenv(ROOT / 'api/.env')
    parts = urlsplit(os.environ['DATABASE_URL'])
    query = {k: v[-1] for k, v in parse_qs(parts.query).items() if k != 'schema'}
    return parts._replace(query=urlencode(query)).geturl()


def connect():
    import psycopg
    return psycopg.connect(database_url(), autocommit=True, connect_timeout=10,
                           options='-c default_transaction_read_only=on -c statement_timeout=30000')


@lru_cache(maxsize=1)
def snapshot() -> dict:
    return json.loads(SNAPSHOT.read_text(encoding='utf-8'))


def records() -> list[dict]:
    return snapshot()['records']


def record(scope: str, program: str | None, key: str) -> dict:
    for r in records():
        if r['scope'] == scope and r['program'] == program and r['requirement_key'] == key:
            return r
    raise KeyError((scope, program, key))


def logical_id(r: dict) -> str:
    if r['scope'] == 'campus':
        return f"campus:sjsu:{r['catalog_year']}:{r['requirement_key']}"
    return f"program:{r['program']}:{r['catalog_year']}:{r['requirement_key']}"


def walk(node: dict):
    yield node
    for child in node.get('children', []):
        yield from walk(child)


def rule_codes(r: dict) -> tuple[list[str], list[str]]:
    inc, exc = [], []
    for n in walk(r['rule']):
        for c in n.get('includes', []):
            if c['code'] not in inc:
                inc.append(c['code'])
        for c in n.get('exclusions', []):
            if c['code'] not in exc:
                exc.append(c['code'])
    return inc, exc


def has_open_part(r: dict) -> bool:
    return any(n['kind'] in ('open_rule', 'approval_required') for n in walk(r['rule']))


def is_closed(r: dict) -> bool:
    return r['catalog_list_coverage'] == 'complete' and not r.get('needs_review') and not has_open_part(r)


def source_urls(r: dict) -> list[str]:
    out = []
    for s in r['sources']:
        if s.get('url') and s['url'] not in out:
            out.append(s['url'])
    return out


CODE_RE = re.compile(r'\b([A-Z]{2,5}[0-9]?)\s?(\d{1,3}[A-Z]{0,3})\b')


def normalize_code(text: str) -> str | None:
    m = CODE_RE.fullmatch(text.strip().upper())
    return f'{m.group(1)} {m.group(2)}' if m else None


@lru_cache(maxsize=1)
def course_facts() -> dict:
    """code -> {course: bool, ucr_status, title}"""
    out: dict[str, dict] = {}
    with connect() as c:
        for (code,) in c.execute('SELECT code FROM "Course"'):
            out.setdefault(code, {'course': True, 'ucr_status': None, 'title': None})
        for code, status, title in c.execute(
                'SELECT c.code, u."catalogStatus", u.title FROM "UniversityCourseRecord" u JOIN "Course" c ON c.id=u."courseId" WHERE u."catalogYear"=%s',
                (CATALOG_YEAR,)):
            out.setdefault(code, {'course': True, 'ucr_status': None, 'title': None}).update(ucr_status=status, title=title)
    return out


def code_known(code: str) -> bool:
    if code in course_facts():
        return True
    for r in records():
        inc, exc = rule_codes(r)
        if code in inc or code in exc:
            return True
        if any(code in s.get('quote', '') for s in r['sources']):
            return True
    return False


@lru_cache(maxsize=1)
def term_stamps() -> dict:
    with connect() as c:
        rows = c.execute('SELECT id, "sourceUpdatedOn", "lastImportedAt", "sourceUrl" FROM "Term" ORDER BY id').fetchall()
    return {r[0]: {'sourceUpdatedOn': str(r[1]) if r[1] else None,
                   'lastImportedAt': r[2].isoformat() if r[2] else None, 'sourceUrl': r[3]} for r in rows}


def imported_terms() -> list[str]:
    return [t for t, s in term_stamps().items() if s['lastImportedAt']]


@lru_cache(maxsize=1)
def sections() -> list[dict]:
    out = []
    with connect() as c:
        rows = c.execute('''
            SELECT u."termId", u."classNumber", c.code, u.evidence, u."lastSeenAt", t."lastImportedAt"
            FROM "UniversitySectionRecord" u JOIN "Course" c ON c.id=u."courseId" JOIN "Term" t ON t.id=u."termId"
        ''').fetchall()
    for term, cls, code, ev, seen, imported in rows:
        definite, ambiguous, unparsed = designations(ev.get('attributes', ''))
        extra = [normalize_code(a.get('courseCode', '')) for a in (ev.get('additionalListings') or [])]
        out.append({
            'term': term, 'class_number': cls, 'code': code, 'section': ev.get('sectionNumber'),
            'mode': ev.get('mode'), 'days': ev.get('days') or '', 'open_seats': ev.get('openSeats'),
            'component': ev.get('component'), 'attributes': ev.get('attributes', ''),
            'definite': definite, 'ambiguous': ambiguous, 'unparsed': unparsed,
            'stale': seen is None or (imported is not None and seen < imported),
            'cancelled': bool(re.search(r'cancel(l)?ed', ev.get('notes') or '', re.I)),
            'cross_listed': [x for x in extra if x],
        })
    return out


def day_set(days: str) -> set[str]:
    out = set()
    for part in days.split('/'):
        part = part.strip().upper()
        if not part or part == 'TBA':
            continue
        out |= set(re.sub(r'[^MTWRFSU]', '', part))
    return out


def filter_match(section: dict, flt: dict | None) -> str:
    """'yes' (required), 'tolerated' (allowed), or 'no'."""
    if not flt:
        return 'yes'
    verdict = 'yes'
    if flt.get('open_seats'):
        seats = section['open_seats']
        if not isinstance(seats, int) or seats <= 0:
            return 'no'
    if 'mode' in flt and section['mode'] != flt['mode']:
        return 'no'
    if 'days_exact' in flt:
        want, have = set(flt['days_exact']), day_set(section['days'])
        if have == want:
            pass
        elif want <= have:
            verdict = 'tolerated'
        else:
            return 'no'
    if 'days_include' in flt:
        if not set(flt['days_include']) <= day_set(section['days']):
            return 'no'
    return verdict


def _section_hits(section: dict, reqs: list[str], combine: str) -> str:
    d, a = section['definite'], section['ambiguous']
    if combine == 'all':
        if all(r in d for r in reqs):
            return 'yes'
        if all(r in d or r in a for r in reqs):
            return 'tolerated'
        return 'no'
    if any(r in d for r in reqs):
        return 'yes'
    if any(r in a for r in reqs):
        return 'tolerated'
    return 'no'


def derive_set(spec: dict) -> dict:
    """Course-code set for a designation or program list in an imported term, with an optional filter."""
    term, flt = spec['term'], spec.get('filter')
    required, allowed, evidence = set(), set(), {}
    if spec['type'] == 'designation_set':
        reqs, combine = spec['requirements'], spec.get('combine') or 'any'
        member = lambda s: _section_hits(s, reqs, combine)  # noqa: E731
        pool = None
    elif spec['type'] == 'program_set':
        pool = set(spec.get('codes') or rule_codes(record('program', spec['program'], spec['requirement']))[0])
        member = lambda s: 'yes' if s['code'] in pool else 'no'  # noqa: E731
    else:
        raise ValueError(spec['type'])
    matching_codes = set()
    for s in sections():
        if s['term'] != term or s['cancelled']:
            continue
        m = member(s)
        if m == 'no':
            continue
        matching_codes.add(s['code'])
        f = filter_match(s, flt)
        if f == 'no':
            continue
        if m == 'yes' and f == 'yes' and not s['stale']:
            required.add(s['code'])
            evidence.setdefault(s['code'], []).append(s['class_number'])
        else:
            allowed.add(s['code'])
        allowed.update(s['cross_listed'])
    if flt and pool is None:
        # same course, filter satisfied only by a non-designated component section -> tolerated
        for s in sections():
            if s['term'] == term and s['code'] in matching_codes and filter_match(s, flt) != 'no':
                allowed.add(s['code'])
    allowed -= required
    return {'required': sorted(required), 'allowed': sorted(allowed),
            'sections': {k: sorted(v) for k, v in sorted(evidence.items())}}


def course_offering(code: str, term: str) -> dict:
    rows = [s for s in sections() if s['code'] == code and s['term'] == term and not s['cancelled']]
    live = [s for s in rows if not s['stale']]
    return {'offered': bool(live), 'stale_only': bool(rows) and not live,
            'class_numbers': sorted(s['class_number'] for s in live),
            'open_seats': {s['class_number']: s['open_seats'] for s in live}}


def derive(spec: dict) -> dict:
    """Recompute a section-dependent expectation (used by the scorer to detect drift)."""
    if spec['type'] in ('designation_set', 'program_set'):
        return derive_set(spec)
    if spec['type'] == 'course_fact':
        out = {'exists': code_known(spec['code'])}
        if spec.get('term'):
            out.update(course_offering(spec['code'], spec['term']))
        return out
    return {}


SQL_DOC = {
    'designation_set': 'SELECT u."termId", u."classNumber", c.code, u.evidence->>\'attributes\', u.evidence->\'openSeats\', '
                       'u.evidence->>\'mode\', u.evidence->>\'days\', u."lastSeenAt" >= t."lastImportedAt" AS current '
                       'FROM "UniversitySectionRecord" u JOIN "Course" c ON c.id=u."courseId" JOIN "Term" t ON t.id=u."termId" '
                       'WHERE u."termId"=:term  -- then parsed by req10_data.designations() and filter_match()',
    'program_set': 'checked.json rule includes (req10_data.rule_codes) INTERSECT the same section query by course code',
    'course_fact': 'SELECT code FROM "Course"; SELECT ... FROM "UniversityCourseRecord" WHERE "catalogYear"=\'2026-2027\'; '
                   'sections as above for the term',
    'record': 'api/prisma/data/requirements/2026-2027/checked.json record by (scope, program, requirement_key)',
}
