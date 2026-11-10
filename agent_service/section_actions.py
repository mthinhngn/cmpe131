"""Term-specific section bundles, with conservative meeting/conflict validation."""
import re
from uuid import uuid4


def patterns(row):
    days, times = row['days'].split('/'), row['times'].split('/')
    if len(days) == 1 and len(times) > 1:
        days *= len(times)
    if len(days) != len(times):
        raise ValueError('Meeting patterns need review')
    result = []
    for d, t in zip(days, times):
        if not re.fullmatch('[MTWRFSU]+', d.strip()):
            raise ValueError('Meeting days are unknown; select this section manually')
        m = re.fullmatch(r'(\d{1,2}):(\d{2})(AM|PM)\s*-\s*(\d{1,2}):(\d{2})(AM|PM)', t.strip(), re.I)
        if not m:
            raise ValueError('Meeting times are unknown; select this section manually')
        def clock(h, minute, suffix):
            if not 1 <= int(h) <= 12 or not 0 <= int(minute) < 60:
                raise ValueError('Invalid meeting time')
            return (int(h) % 12 + (12 if suffix.upper() == 'PM' else 0)) * 60 + int(minute)
        start, end = clock(*m.groups()[:3]), clock(*m.groups()[3:])
        if start >= end:
            raise ValueError('Invalid meeting range')
        result.append((set(d.strip()), start, end))
    return result


def prepare_sections(course, decision, context, data):
    if 'set_course_sections' not in context.get('capabilities', []):
        raise ValueError('This browser has no direct section-change handler yet. No sections were changed.')
    if data.get('status') != 'available' or data.get('term') != decision.section_term:
        raise ValueError('Official sections are unavailable for that term')
    rows = data['offerings']
    same = [r for r in rows if re.sub(r'\W', '', r['courseCode']).lower() == re.sub(r'\W', '', course['code']).lower()]
    chosen = [r for r in same if r['classNumber'] in decision.section_numbers]
    if len(chosen) != len(set(decision.section_numbers)) or not chosen:
        raise ValueError('Specify the exact published class numbers')
    required = {r['component'] for r in same}
    if {r['component'] for r in chosen} != required or len(chosen) != len(required):
        raise ValueError('Choose exactly one section for every required component (including lecture/lab)')
    existing_ids = context.get('selected_sections', {}).get(decision.section_term, [])
    existing = [r for r in rows if r['classNumber'] in existing_ids and r not in same]
    if len(existing) != len([n for n in existing_ids if n not in {r['classNumber'] for r in same}]):
        raise ValueError('Existing section selections could not be verified')
    meetings = [(r, patterns(r)) for r in chosen + existing]
    for constraint in decision.constraints:
        if constraint.lower() not in {'no friday', 'avoid friday', 'no conflicts'}:
            raise ValueError('This additional section condition needs clarification')
        if 'friday' in constraint.lower() and any('F' in d for r, pats in meetings[:len(chosen)] for d, _, _ in pats):
            raise ValueError('The selected sections meet on Friday')
    for i, (_, left) in enumerate(meetings):
        for _, right in meetings[i+1:]:
            if any(d & e and a < y and x < b for d, a, b in left for e, x, y in right):
                raise ValueError('The requested sections conflict with the weekly schedule')
    numbers = [r['classNumber'] for r in existing + chosen]
    return {'kind': 'set_course_sections', 'program_id': context['program_id'], 'action_id': str(uuid4()), 'tool_call_id': str(uuid4()),
            'expected_revision': context['revision'], 'course_id': course['course_id'], 'term': decision.section_term,
            'class_numbers': numbers, 'source_url': data.get('sourceUrl')}
