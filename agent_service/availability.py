"""Exact catalog and schedule reads; no model or personal-state mutations."""
import copy
import re
from .web_contracts import parse_term, semester_slot
from .section_actions import patterns
from .plan_changes import prerequisite_issues


def parse_satisfies(value):
    text = re.sub(r'\s+', ' ', (value or '').strip().upper())
    if not text:
        return []
    text = re.sub(r'^(GE|AI):\s*', '', text).replace('AREA ', '')
    result = []
    for part in text.split('+'):
        part = part.strip()
        if part == 'US':
            result.append('US (unspecified)')
        elif re.fullmatch(r'US[123]+', part):
            result.extend('US' + n for n in part[2:])
        elif part == '1BOR4':
            result.append('GE 1B or GE 4')
        elif part == 'UD 2/5':
            result.append('UD 2/5')
        elif re.fullmatch(r'UD [2345]', part):
            result.append(part)
        elif re.fullmatch(r'[1-6][ABC]?|E', part):
            result.append('GE ' + part)
        elif part in {'WID', 'GWAR', 'PE: PHYSED'}:
            result.append('PE' if part.startswith('PE:') else part)
        else:
            raise ValueError('Unrecognized satisfaction attribute: ' + part)
    return list(dict.fromkeys(result))


def _code(value):
    return re.sub(r'[^A-Z0-9]', '', value.upper())


def _metadata(rows):
    return {'source_url': next((r.get('sourceUrl') for r in rows if r.get('sourceUrl')), None),
            'fetched_at': min((str(r['fetchedAt']) for r in rows if r.get('fetchedAt')), default=None)}


class Availability:
    def __init__(self, repository, sections=None):
        from .schedule_data import read_sections
        self.repository = repository
        self.sections = sections or read_sections

    def invoke(self, name, arguments, context):
        if name == 'check_fit':
            return self.check_fit(context=context, **arguments)
        if name not in {'find_courses_by_requirement', 'get_course', 'get_sections'}:
            raise ValueError('Unknown availability tool')
        return getattr(self, name)(**arguments)

    def find_courses_by_requirement(self, area, term):
        term = parse_term(term).id
        area = re.sub(r'\s+', ' ', area.strip().upper())
        rows = self.repository.section_records(term)
        groups = {}
        for row in rows:
            satisfies = parse_satisfies(row.get('attributes'))
            if area in satisfies:
                groups.setdefault(row['courseCode'], []).append(row)
        courses = []
        for code, members in sorted(groups.items()):
            seats = [r.get('openSeats') for r in members]
            courses.append({'code': code, 'title': members[0].get('title'), 'units': members[0].get('units'),
                            'satisfies': sorted({s for r in members for s in parse_satisfies(r.get('attributes'))}),
                            'section_count': len(members),
                            'open_seats_total': sum(max(0, n) for n in seats) if all(type(n) is int for n in seats) else None,
                            'seats_known': all(type(n) is int for n in seats),
                            'modes': sorted({r.get('mode', '') for r in members}), **_metadata(members)})
        return {'term': term, 'area': area, 'courses': courses, **_metadata(rows)}

    def get_course(self, code):
        row = self.repository.course_details(code)
        if not row:
            return {'courses': []}
        row = dict(row)
        if row.get('fetched_at') is not None:
            row['fetched_at'] = str(row['fetched_at'])
        # Requirement eligibility is term-specific; get it from the requested term's schedule tool.
        row.setdefault('satisfies', [])
        return {'courses': [row], 'source_url': row.get('catalog_url'), 'fetched_at': row.get('fetched_at')}

    def get_sections(self, code, term, fresh=False):
        term = parse_term(term).id
        if type(fresh) is not bool:
            raise ValueError('fresh must be boolean')
        if fresh:
            data = self.sections(term)
            if data.get('status') != 'available':
                raise ValueError(data.get('message') or 'Official schedule unavailable')
            rows = data.get('offerings', [])
            metadata = {'source_url': data.get('sourceUrl'), 'fetched_at': data.get('fetchedAt')}
        else:
            rows = self.repository.section_records(term)
            metadata = _metadata(rows)
        same = [r for r in rows if _code(r['courseCode']) == _code(code)]
        result = []
        for row in same:
            seats = row.get('openSeats')
            result.append({'class_number': row['classNumber'], 'section': row.get('sectionNumber'),
                           'component': row.get('component'), 'days': row.get('days'), 'times': row.get('times'),
                           'mode': row.get('mode'), 'instructors': row.get('instructors', []),
                           'open_seats': seats if type(seats) is int else None, 'seats_known': type(seats) is int,
                           'location': row.get('location'), 'satisfies': parse_satisfies(row.get('attributes'))})
        return {'code': code, 'term': term, 'sections': result, **metadata}

    def check_fit(self, code, term, context, class_numbers=None):
        term = parse_term(term)
        row = self.repository.course_details(code)
        if not row:
            return {'code': code, 'prerequisites': {'status': 'unknown', 'missing_codes': []}, 'conflicts': [], 'schedule_status': 'unknown'}
        cid = row['course_id']
        completed = set(context.get('completed_course_ids', []))
        rules = self.repository.prerequisite_rules(context['program_id'])
        relevant = [r for r in rules if r['course_id'] == cid]
        proposed = copy.deepcopy(context)
        proposed['plan'] = [p for p in proposed.get('plan', []) if p['course_id'] != cid]
        if context.get('starting_term'):
            slot = semester_slot(context['starting_term'], term)
            proposed['plan'].append({'course_id': cid, 'semester_slot': slot, 'status': 'planned'})
            issues = prerequisite_issues(proposed, relevant)
            status = 'unmet' if issues else 'met'
            if any(r.get('manual_review') for r in relevant):
                status = 'unknown'
        else:
            status = 'unknown'
        text = row.get('prerequisite_text') or ''
        if not relevant and text and not text.startswith('No prerequisite conditions'):
            status = 'unknown'
        elif not relevant and not text:
            status = 'unknown'
        if re.search(r'\b(grade|consent|permission|standing|GPA)\b', text, re.I) and status == 'met':
            status = 'unknown'
        missing_ids = sorted({r['required_id'] for r in relevant if r['required_id'] not in completed
                              and (not context.get('starting_term') or prerequisite_issues(proposed, [r]))}) if status != 'met' else []
        known = self.repository.planned_courses(context['program_id'], missing_ids) if missing_ids and hasattr(self.repository, 'planned_courses') else []
        missing = sorted({r['code'] for r in known})
        rows = self.repository.section_records(term.id)
        chosen = [r for r in rows if _code(r['courseCode']) == _code(code) and r['classNumber'] in (class_numbers or [])]
        selected = context.get('selected_sections', {}).get(term.id, [])
        existing = [r for r in rows if r['classNumber'] in selected and _code(r['courseCode']) != _code(code)]
        conflicts = []
        schedule_status = 'unknown'
        if chosen and len(chosen) == len(set(class_numbers)) and len(existing) == len([n for n in selected if n not in {r['classNumber'] for r in rows if _code(r['courseCode']) == _code(code)}]):
            try:
                for index, left in enumerate(chosen):
                    for right in chosen[index + 1:] + existing:
                        if any(d & e and a < y and x < b for d, a, b in patterns(left) for e, x, y in patterns(right)):
                            conflicts.append({'class_number': left['classNumber'], 'with_class_number': right['classNumber']})
                schedule_status = 'conflicts' if conflicts else 'clear'
            except ValueError:
                schedule_status = 'unknown'
        return {'code': row['code'], 'term': term.id, 'prerequisites': {'status': status, 'missing_codes': missing, 'missing_course_ids': missing_ids},
                'conflicts': conflicts, 'schedule_status': schedule_status, 'already_completed': cid in completed,
                'already_planned': any(p['course_id'] == cid for p in context.get('plan', [])),
                'validation_notes': 'Checks recorded course ordering and meeting overlaps, not degree eligibility or transfer equivalencies.',
                'source_url': row.get('catalog_url'), 'fetched_at': str(row.get('fetched_at') or '') or None}
