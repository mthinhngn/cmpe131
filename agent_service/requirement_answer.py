"""Code-owned rendering and checks for requirement lists, so a long verified list reaches the user intact."""
import re
from urllib.parse import urlsplit

COURSE = re.compile(r'\b(?!(?:GE|UD|US)\s*\d)([A-Z]{2,5}(?:\d(?=\s))?)\s?(\d{1,3}[A-Z]?)\b(?![:\d])')
REQUIREMENT_WORDS = re.compile(r'(?i)technical\s+(?:upper[-\s]division\s+)?electives?|\bTEs?\b|tự\s*chọn|counts? (?:for|toward)|qualif\w*|satisf\w*|meets?')
NEGATION = re.compile(r"(?i)\b(?:not|no|none|neither|nor|isn['’]t|aren['’]t|without|excluded?|không|chưa)\b|n['’]t\b")
UNOFFERED = re.compile(r"(?i)\b(?:not\s+(?:be\s+)?(?:offered|available|scheduled|open)|no\s+(?:spring|fall|summer|winter|listed\s+)?\s*(?:sections?|classes|offerings?)"
                       r"|isn['’]t\s+(?:offered|available)|aren['’]t\s+(?:offered|available)|không\s+(?:mở|có\s+lớp)|chưa\s+(?:mở|có\s+lớp))")


def _code(value):
    return re.sub(r'[^A-Z0-9]', '', value.upper())


NO_LIST = {'no_program_source', 'program_required', 'unknown_program', 'unknown_requirement',
           'ambiguous_requirement', 'incomplete_coverage', 'catalog_unavailable', 'open_rule',
           'term_required', 'term_not_imported'}

REQUIREMENT_TOOLS = ('find_courses_by_requirement', 'search_sections')


def requirement_lookups(evidence, statuses=('ok',)):
    return [e for e in evidence if e['tool'] in REQUIREMENT_TOOLS and e['status'] in statuses and e['data'].get('requirement')]


def _term_label(term):
    season, year = term.split('-')
    return f'{season.title()} {year}'


def _requirement_label(data):
    label = data.get('label') or data.get('area') or 'requirement'
    if data['requirement'] == 'technical-electives':
        return ' '.join(part for part in (data.get('program_name'), 'technical electives') if part)
    return label


def _rule_text(rule, catalog_year):
    if rule.get('slots'):
        groups = list(dict.fromkeys((slot.get('description') or slot.get('label') or '').rstrip('.') for slot in rule['slots']))
        if len(groups) == 1:
            return f"The {catalog_year} roadmap has {len(rule['slots'])} technical elective slots ({groups[0]})."
        return 'Roadmap elective slots\n\n' + '\n'.join(f"- {slot.get('description') or slot.get('label')}" for slot in rule['slots'])
    return rule.get('text', '')


def _cell(value):
    return ' '.join(str(value or '').split()).replace('|', '\\|')


# Code-checked records: attribute every statement to SJSU's catalog with its quote, link and capture date.
def is_record(data):
    return data.get('verification') in ('code_checked', 'human_verified')


def record_label(data):
    label = re.sub(r'^\d+\.\s*', '', data.get('label') or 'this requirement')
    return f"{label} for {data['program_name']}" if data.get('scope') == 'program' and data.get('program_name') else label


def _source_note(url, checked_on):
    from .verifier import readable_date
    if not url:
        return ''
    return f' Source: <{url}>' + (f' (captured {readable_date(checked_on)}).' if checked_on else '.')


def _quote(data):
    quote = data.get('rule_quote') or {}
    return (f'“{quote["text"]}”' if quote.get('text') else ''), _source_note(quote.get('url'), quote.get('checked_on'))


def source_name(source, year):
    if source.get('kind') == 'department_list':
        path = urlsplit(source.get('url') or '').path.strip('/')
        department = path.split('/', 1)[0].upper()
        return f"the {department} department’s list" if department else "the department’s list"
    if (source.get('kind') or '').startswith('catalog_'):
        return f"SJSU's {year} catalog"
    return 'the SJSU requirements page'


def _alternative(item):
    quote = ' '.join(str(item.get('quote') or '').split())
    text = str(item.get('value') or '').strip() + (f': “{quote}”' if quote and len(quote) <= 300 else '')
    return text + (_source_note(item.get('url'), item.get('checkedOn') or item.get('checked_on')) or ' (source not recorded).')


def conflict_block(data, conflicts=None):
    conflicts = data.get('conflicts') if conflicts is None else conflicts
    if not conflicts:
        return ''
    lines = ['SJSU sources disagree on this requirement.']
    for conflict in conflicts:
        field = re.sub(r'[_.\-]+', ' ', str(conflict.get('field') or 'detail')).strip()
        lines.append(f'- {field}: ' + ' versus '.join(
            source_name(item, data.get('catalog_year', '')) + ' says ' + _alternative(item)
            for item in conflict.get('alternatives', [])))
    return '\n'.join(lines)


def _codes_in(text):
    return {_code(''.join(m)) for m in COURSE.findall(re.sub(r'_+', ' ', str(text or '')).upper())}


def conflict_codes(conflict):
    return _codes_in(conflict.get('field')).union(*(_codes_in(a.get('value')) for a in conflict.get('alternatives', [])))


def _conflicts_for(code, data):
    return [c for c in data.get('conflicts') or [] if _code(code) in conflict_codes(c)]


def conflict_claim_issues(claims, evidence):
    """Where SJSU sources disagree, a claim may not state one alternative as fact without the others."""
    from .requirement_query import normalized_words
    conflicts = [c for e in requirement_lookups(evidence, ('ok', 'empty')) for c in e['data'].get('conflicts') or []]
    issues = []
    for claim in claims:
        if claim.get('kind') == 'gap' or not conflicts:
            continue
        text, codes = f" {normalized_words(claim['text'])} ", _codes_in(claim['text'])
        for conflict in conflicts:
            values = [normalized_words(str(a.get('value') or '')) for a in conflict.get('alternatives', [])]
            stated = [v for v in values if v and f' {v} ' in text]
            if not stated or len(stated) == len(values):
                continue
            # Short generic values ("Listed") only count when the claim concerns a course the conflict names.
            if codes & conflict_codes(conflict) or all(re.search(r'\d', v) or len(v.split()) >= 2 for v in stated):
                issues.append({'claim': claim['text'], 'problem': 'SJSU sources differ on ' + re.sub(r'[_.\-]+', ' ', str(conflict.get('field'))) +
                               '; state every alternative with its source, or say the sources differ, instead of one value as fact.'})
    return issues


def record_rule_gap(data, conflicts=()):
    """An open rule is answered with the catalog's own wording, never with an invented list or approval route."""
    quote, source = _quote(data)
    name = source_name(data.get('rule_quote') or {}, data['catalog_year'])
    text = f"{name[:1].upper() + name[1:]} does not give a closed course list for {record_label(data)}."
    if quote:
        text += f' It states: {quote}'
    excluded = [e['code'] for e in data.get('exclusions', [])]
    if excluded:
        text += f" {name[:1].upper() + name[1:]} explicitly excludes {', '.join(excluded)}."
    text += source
    block = conflict_block(data, list(conflicts))
    return text + ('\n\n' + block if block else '')


def major_effects_block(effects, program, year, label, summary=None):
    """What the major's own catalog text says about a campus requirement; never a statement about the student."""
    if effects is None or not program:
        return ''
    if not effects:
        if not summary or not summary.get('quote') or not summary.get('url'):
            return ''
        return (f"SJSU's {year} {program} catalog records no major waiver or coverage for {label}. "
                f'The Summary of Degree Units says “{summary["quote"]}”'
                + _source_note(summary['url'], summary.get('checkedOn')))
    lines = []
    for effect in effects:
        source = effect.get('source') or {}
        cite = _source_note(source.get('url'), source.get('checkedOn'))
        if not cite:
            continue
        if effect.get('needsReview'):
            lines.append(f"SJSU sources differ on how the {program} major affects {label}, so this is not stated as fact. "
                         f"The {program} catalog's {effect.get('requirement') or 'requirement'} text says: “{effect.get('text')}”{cite} "
                         'Please confirm with the department.')
        else:
            lines.append(f"SJSU's {year} {program} catalog says: “{effect.get('text')}”{cite}")
    return '\n\n'.join(lines)


def record_membership(code, data):
    """Answer from the scoped rule, including any requirement for the same course."""
    label, year = record_label(data), data['catalog_year']
    quote, source = _quote(data)
    conflicts = _conflicts_for(code, data)
    if conflicts:
        return f'SJSU sources differ on whether {code} counts toward {label}, so I cannot say yes or no.\n\n' + conflict_block(data, conflicts)
    course = next((c for c in data.get('courses', []) if _code(c['code']) == _code(code)), None)
    if course:
        rule_source = course.get('rule_source') or data.get('rule_quote') or {}
        name = source_name(rule_source, year)
        text = f"Yes. {course['code']} counts toward {label} under {name}."
        from .availability import _rule_condition
        rules = course.get('rules') or []
        conditions = list(dict.fromkeys(_rule_condition(rule) for rule in rules))
        if conditions and None not in conditions:
            text += ' ' + ' or '.join(conditions)
        elif not rules and course.get('condition'):
            text += ' ' + course['condition']
        return text + (_source_note(rule_source.get('url'), rule_source.get('checked_on')) or source)
    required = (data.get('required_course_sources') or {}).get(_code(code))
    if required:
        policy = data['non_required_policy']
        return (f"No. {code} is required for {data['program_name']}."
                + _source_note(required['url'], required.get('checkedOn'))
                + f" {source_name(policy, year)} says “{policy['quote']}”"
                + _source_note(policy['url'], policy.get('checked_on')))
    excluded = next((e for e in data.get('exclusions', []) if _code(e['code']) == _code(code)), None)
    if excluded:
        rule_source = next((s for s in data.get('sources', []) if excluded['text'] and excluded['text'] in (s.get('quote') or '')),
                           data.get('rule_quote') or {})
        return (f"No. {code} is excluded from {label} under {source_name(rule_source, year)}. “{excluded['text']}”"
                + _source_note(rule_source.get('url'), rule_source.get('checked_on')))
    if not data.get('coverage') and data.get('record_status') == 'verified':
        names = ' and '.join(source_name(s, year) + _source_note(s['url'], s.get('checkedOn')).rstrip('.')
                             for s in data.get('list_sources', []))
        rule_name = source_name(data.get('rule_quote') or {}, year)
        return (f"No. {code} does not count toward {label} on the published list in {names or rule_name}."
                + (f' The rule in {rule_name} says {quote}' if quote else '') + source)
    policy = data.get('non_required_policy') or data.get('rule_quote') or {}
    passage = policy.get('quote') or policy.get('text')
    if passage and policy.get('url'):
        return (f"Eligibility for {code} under {label} depends on this rule from {source_name(policy, year)}. “{passage}”"
                + _source_note(policy['url'], policy.get('checked_on')))
    return record_rule_gap(data)


def record_conditions(data, topics):
    from .requirement_query import CONDITION_TOPICS
    patterns = [CONDITION_TOPICS[key] for key in topics]
    matches = lambda text: any(re.search(pattern, text or '', re.I) for pattern in patterns)
    conflicts = [c for c in data.get('conflicts') or [] if matches(re.sub(r'[_-]', ' ', c['field']))]
    lines = [conflict_block(data, conflicts)] if conflicts else []
    conditions = (data.get('rule') or {}).get('conditions') or []
    for source in data.get('sources', []):
        quote = source.get('quote') or ''
        matched = [c for c in conditions if c in quote and matches(c)] or [sentence for sentence in
                   re.split(r'(?<=[.!?])\s+', quote) if matches(sentence) and len(sentence) <= 500]
        for passage in matched:
            if conflicts and any(str(a.get('value', '')).casefold() in passage.casefold()
                                 for c in conflicts for a in c['alternatives'] if a.get('value')):
                continue
            lines.append(f"{source_name(source, data['catalog_year'])} says “{passage}”"
                         + _source_note(source['url'], source.get('checked_on')))
    return '\n\n'.join(dict.fromkeys(lines)) or record_rule_gap(data)

def course_facts_answer(e, *, include_catalog=True):
    from .verifier import compose, readable_date
    data = e['data']
    code = data['code']
    scope = f"the {data['catalog_year']} SJSU catalog"
    record = {
        'found': f'{code} is listed in {scope}.',
        'pending': f'Course Radar has an imported course entry for {code}. Its listing in {scope} is unverified.',
        'not_in_saved_catalog': f"The saved {data['catalog_year']} SJSU catalog has no record for {code}.",
    }[data['catalog_record']]
    texts = [record] if include_catalog else []
    if data.get('term'):
        term = _term_label(data['term'])
        count = data.get('active_sections')
        timestamp = data.get('sourceUpdatedOn') or data.get('fetched_at')
        date = f" (snapshot dated {readable_date(timestamp)})" if timestamp else ''
        sections = ', '.join(f"{s['section']} (#{s['class_number']})" if s.get('section') else f"#{s['class_number']}"
                             for s in data.get('offering_sections', []))
        if count:
            text = f"Yes. {code} is offered in {term}."
            if sections:
                text += f" Sections: {sections}."
        elif count == 0:
            text = f"No. {code} is not offered in {term}. The saved {term} schedule lists 0 active sections of {code}."
        else:
            text = f"The {term} schedule isn't available in Course Radar yet."
        if timestamp and count is not None:
            text = text.rstrip('.') + date + '.'
        if data.get('source_url'):
            text += f" <{data['source_url']}>"
        texts.insert(0, text)
    return compose([{'kind': 'fact', 'text': text, 'evidence_ids': [e['evidence_id']]} for text in texts], [e])


def check_term_reply(text, question, today, evidence, *, declared=(), rendered=()):
    """Check only displayed schedule claims and the evidence they actually use."""
    from .requirement_query import question_terms
    expected = question_terms(question, today)
    if len(expected) != 1:
        return text, 'skipped'
    term = next(iter(expected))

    def schedule(entry):
        data = entry['data']
        if entry['tool'] in REQUIREMENT_TOOLS:
            if data.get('outcome') not in ('offered', 'none_offered', 'none_open', 'term_not_imported', 'term_mismatch'):
                return None
        elif entry['tool'] not in ('course_facts', 'get_sections') and data.get('kind') != 'offering':
            return None
        return data.get('term') or (data.get('target_term') or {}).get('id')

    indexed = {entry['evidence_id']: entry for entry in evidence if schedule(entry)}
    blocks = list(rendered)
    for claim in declared:
        chunk = claim['text']
        if chunk in text and re.search(r'\b(?:sections?|seats?|offered|offerings?|scheduled|schedule|class\s*#)\b', chunk, re.I):
            blocks.extend((chunk, indexed[key], False) for key in claim['evidence_ids'] if key in indexed)
    checked = 'skipped'
    for chunk, entry, include_catalog in blocks:
        actual = schedule(entry)
        if not actual or not chunk or chunk not in text:
            continue
        visible = re.sub(r'https?://[^\s<>]+', '', chunk)
        if actual == term and question_terms(visible, today) == expected:
            if checked == 'skipped':
                checked = 'matched'
            continue
        data = entry['data']
        def identity(item):
            body = item['data']
            return (item['tool'], body.get('requirement_id') or body.get('requirement'),
                    body.get('code') or body.get('course_code'))
        wanted = next((item for item in indexed.values() if schedule(item) == term
                       and identity(item) == identity(entry)), None)
        if wanted and wanted['tool'] in REQUIREMENT_TOOLS:
            replacement = requirement_fallback([wanted])
        elif wanted and wanted['tool'] == 'course_facts' and wanted['status'] == 'ok':
            replacement = course_facts_answer(wanted, include_catalog=include_catalog)
        elif wanted and wanted['status'] == 'ok':
            facts = wanted['data']
            rows = facts.get('sections', [])
            numbers = ', '.join(f"#{row['class_number']}" for row in rows if row.get('class_number'))
            subject = facts.get('code') or facts.get('course_code')
            replacement = (f"Yes. {subject} is offered in {_term_label(term)}. Sections: {numbers}."
                           if rows else f"No. {subject} is not offered in {_term_label(term)}.")
            replacement += _source_note(facts.get('source_url'), facts.get('sourceUpdatedOn') or facts.get('fetched_at'))
        else:
            subject = data.get('code') or data.get('course_code') or data.get('label') or 'the requested courses'
            replacement = f"The lookup returned {_term_label(actual)} schedule data. {_term_label(term)} results for {subject} are unavailable from that lookup."
        text = text.replace(chunk, replacement, 1)
        checked = 'rerendered'
    return text, checked


def requirement_table(evidence):
    """Use the full ledger, independent of how much data was shown to the model."""
    lookups = requirement_lookups(evidence, ('ok', 'empty'))
    if not lookups:
        return None
    data = lookups[-1]['data']
    term = _term_label(data['term']) if data.get('term') else None
    courses = data['courses']
    record = is_record(data)
    label = record_label(data) if record else _requirement_label(data)
    rule = _rule_text(data.get('rule') or {}, data.get('catalog_year', ''))
    if record:
        quote, source = _quote(data)
        rule = f"{source_name(data.get('rule_quote') or {}, data.get('catalog_year'))} says {quote}{source}" if quote and source else ''
    lines = []
    if not courses and not data.get('open_only'):
        listed = data.get('listed_not_offered') or []
        if listed:
            lines.append(f"**Catalog eligibility for {label}:** {', '.join(listed)}.")
    elif courses:
        if term and data.get('coverage') == 'section_designations':
            title = f"**{term} sections tagged {label} ({len(courses)} courses"
        elif term and not (data.get('query') and not data['query'].get('program_list')):
            title = f"**{label} with {term} sections ({len(courses)} courses from the published entries"
        elif term:
            title = f"**{term} sections ({len(courses)} courses"
        else:
            title = f"**Courses named for {label} ({len(courses)} listed"
        title += ', reported open seats only)**' if data.get('open_only') else ')**'
        lines = [title, '', '| Course | ' + ('Sections (class #) · schedule · open seats' if term else 'Units and conditions') + ' |', '| --- | --- |']
        for course in courses:
            parts = []
            for s in sorted(course['sections'], key=lambda s: (s.get('section') or '', s['class_number'])):
                dated = data.get('sourceUpdatedOn') or data.get('fetched_at')
                seats = f"{s['open_seats']} open" if s['seats_known'] and dated else 'seats unknown'
                when = ' '.join(p for p in (s.get('days'), s.get('times')) if p and p != 'TBA') or 'TBA'
                if data.get('query', {}).get('modes') and s.get('mode'):
                    when = f"{s['mode']} · {when}"
                tags = ' · ' + ', '.join(s['designations']) if s.get('designations') else ''
                condition = f" · {s['eligibility_condition']}" if s.get('eligibility_condition') else ''
                parts.append(f"{s.get('section') or '—'} (#{s['class_number']}) · {when} · {seats}{tags}{condition}")
            name = f"**{_cell(course['code'])}**"
            condition = course.get('condition')
            right = '; '.join(parts) if term else f"{course['units']} units" if course.get('units') else 'Units unverified'
            if condition:
                right += f" · {condition}"
            lines.append(f"| {name} | {_cell(right)} |")
    if term and courses and data.get('listed_not_offered') and not data.get('open_only'):
        lines += ['', f"Listed but without a {term} section: {', '.join(data['listed_not_offered'])}."]
    if data.get('zero_seat_courses'):
        lines += ['', f"Currently full in the saved schedule (zero reported open seats): {', '.join(data['zero_seat_courses'])}."]
    if data.get('unknown_seat_sections'):
        lines += ['', 'Some qualifying sections have unpublished seat counts.']
    query = data.get('query') or {}
    if term and data.get('outcome') in ('offered', 'none_offered', 'none_open'):
        days = dict(zip('MTWRFSU', ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')))
        filters = [
            '/'.join(query['modes']) if query.get('modes') else '',
            'meeting days limited to ' + '/'.join(days[d] for d in query['days']) if query.get('days') else '',
            'meeting on ' + '/'.join(days[d] for d in query['required_days']) if query.get('required_days') else '',
            'excluding ' + '/'.join(days[d] for d in query['exclude_days']) if query.get('exclude_days') else '',
            'starting at or after ' + query['starts_at_or_after'] if query.get('starts_at_or_after') else '',
            'ending by ' + query['ends_by'] if query.get('ends_by') else '',
            'courses ' + ', '.join(query['courses']) if query.get('courses') else '',
        ]
        if any(filters):
            lines += ['', 'Schedule filters applied — ' + ', '.join(filter(None, filters)) + '.']
    if data.get('coverage') == 'section_designations' and data.get('term') and data.get('outcome') in ('offered', 'none_offered', 'none_open'):
        lines += ['', 'This covers the saved schedule’s section designations. Catalog-wide eligibility and applicability to your catalog are unverified.']
    elif record and data.get('coverage') and courses:
        lines += ['', 'The table covers the published course entries. Other courses may qualify under the quoted rules.']
    elif data.get('coverage') in ('partial', 'section_designations') and courses:
        lines += ['', 'The source has partial coverage or conditions that need review.']
    if record and courses and data.get('coverage') and data.get('exclusions'):
        owner = source_name(data.get('rule_quote') or {}, data['catalog_year'])
        lines += ['', owner[:1].upper() + owner[1:] + ' explicitly excludes ' + ', '.join(e['code'] for e in data['exclusions']) + '.']
    if rule and courses and record and data.get('coverage'):
        table = [rule, '']
        listing_urls = {c.get('rule_source', {}).get('url') for c in courses}
        for source in data.get('sources', []):
            if (source.get('kind') == 'department_list' and source.get('quote')
                    and (source.get('url') in listing_urls or not listing_urls)):
                locator = source.get('locator')
                if not locator:
                    continue
                quote = source['quote']
                if len(quote) > 450:
                    quote = ''
                name = source_name(source, data['catalog_year'])
                table.extend([f"{name[:1].upper() + name[1:]} covers {locator}"
                              + (f' and says “{quote}”' if quote else '')
                              + _source_note(source['url'], source.get('checked_on')), ''])
        lines = table + lines
    elif rule and not record and (courses or data.get('outcome') == 'open_rule'):
        lines += ['', rule]
    if record and courses and data.get('conflicts'):
        lines += ['', conflict_block(data)]
    effects = major_effects_block(data.get('major_effects'), data.get('effects_program'), data.get('catalog_year', ''), data.get('effects_label'))
    if effects:
        lines += ['', effects]
    return '\n'.join(lines).strip() or None


def requirement_table_block(text):
    """A model-written table that repeats the code-owned list (two or more courses in table rows)."""
    rows = [line for line in text.splitlines() if line.strip().startswith('|')]
    return len(rows) >= 3 and len({_code(''.join(m)) for row in rows[2:] for m in COURSE.findall(row)}) >= 2


def check_requirement_claims(claims, evidence, question=''):
    """Requirement membership and offering claims must match the verified list, not model memory."""
    asked = {_code(''.join(m)) for m in COURSE.findall(question.upper())}
    conflicts = (conflict_claim_issues(claims, evidence) + source_kind_issues(claims, evidence)
                 + negative_membership_issues(claims, evidence))
    latest = requirement_lookups(evidence, ('ok', 'empty'))
    if latest and latest[-1]['status'] == 'empty' and latest[-1]['data'].get('outcome') in NO_LIST:
        # Without a verified list no course can be offered as a candidate, from catalog search or memory.
        return conflicts + [{'claim': c['text'], 'problem': 'No verified requirement list exists for this program; do not present courses as candidates. Use the lookup gap_statement and offer to check a specific course.'}
                            for c in claims if c.get('kind') != 'gap' and {_code(''.join(m)) for m in COURSE.findall(c['text'])} - asked]
    lookups = requirement_lookups(evidence)
    if not lookups:
        return conflicts
    data = lookups[-1]['data']
    allowed = {_code(c['code']) for c in data['courses']}
    allowed |= {_code(re.sub(r'-\d{2}(?:/\d{2})*$', '', c)) for c in data.get('listed_not_offered', []) + data.get('full_or_unknown', [])}
    offered = {_code(c['code']) for c in data['courses'] if c.get('sections')}
    issues = conflicts
    for claim in claims:
        if claim.get('kind') == 'gap':
            continue
        text = claim['text']
        for part in re.split(r'(?<=[.!?])\s+|\n', text):
            codes = {_code(''.join(m)) for m in COURSE.findall(part)}
            if not codes:
                continue
            if REQUIREMENT_WORDS.search(text) and not NEGATION.search(part):
                extra = sorted(codes - allowed)
                if extra:
                    issues.append({'claim': text, 'problem': f"{', '.join(extra)} is outside the verified list for {_requirement_label(data)}."})
            if UNOFFERED.search(part) and codes & offered:
                issues.append({'claim': text, 'problem': f"{', '.join(sorted(codes & offered))} has listed {_term_label(data['term'])} sections in the requirement lookup."})
    return issues


def source_kind_issues(claims, evidence):
    ledger = {item['evidence_id']: item['data'] for item in evidence}
    issues = []
    for claim in claims:
        if claim.get('kind') == 'gap':
            continue
        data = [ledger[key] for key in claim.get('evidence_ids', []) if key in ledger]
        sources = [source for item in data
                   for source in [*item.get('sources', []), *item.get('list_sources', [])]
                   if source.get('url') and source.get('kind')]
        for line in claim['text'].splitlines():
            if re.search(r'\bcatalog\b', line, re.I):
                attached = [source for source in sources if source['url'] in line]
                list_claim = re.search(r'\b(?:lists?|listed|counts?|excludes?|named)\b', line, re.I)
                selected_lists = [source for item in data for source in item.get('list_sources', [])]
                relevant = attached or (selected_lists if list_claim else []) or sources
                if relevant and not any(source['kind'].startswith('catalog_') for source in relevant):
                    issues.append({'claim': claim['text'], 'problem': 'The cited source is a department or campus page, not a catalog.'})
            if re.search(r"\bdepartment(?:['’]s)? (?:list|page)\b", line, re.I):
                attached = [source for source in sources if source['url'] in line]
                relevant = attached or sources
                if relevant and not any(source['kind'] == 'department_list' for source in relevant):
                    issues.append({'claim': claim['text'], 'problem': 'The cited source is not a department page.'})
    return issues


_NEGATIVE_MEMBERSHIP = re.compile(
    r"\b(?:does not|doesn['’]t|is not|isn['’]t|not)\b.{0,55}\b(?:list\w*|count\w*|qualif\w*|eligible|included|on\b.{0,35}\blist)"
    r"|\b(?:excludes?|excluded|absent from|not among)\b", re.I)


def negative_membership_issues(claims, evidence):
    indexed = {item['evidence_id']: item for item in evidence if item['status'] == 'ok'}
    issues = []
    for claim in claims:
        if claim.get('kind') == 'gap':
            continue
        for part in re.split(r'(?<=[.!?])\s+|\n', claim['text']):
            codes = _codes_in(part)
            if (not codes or not _NEGATIVE_MEMBERSHIP.search(part) or UNOFFERED.search(part)
                    or not re.search(r'\b(?:catalog|list\w*|electives?|requirement|counts?|exclu\w*|included|absent|toward|among)\b',
                                     part, re.I)):
                continue
            def proves(code, entry):
                data = entry['data']
                if entry['tool'] == 'course_facts':
                    return (data.get('catalog_record') == 'not_in_saved_catalog' and _code(data['code']) == code
                            and bool(re.search(r'\b(?:saved|imported)\b', part, re.I)))
                if entry['tool'] not in REQUIREMENT_TOOLS or data.get('mode') != 'catalog':
                    return False
                if _conflicts_for(code, data):
                    return False
                if code in {_code(row['code']) for row in data.get('exclusions', [])}:
                    return True
                if code in (data.get('required_course_sources') or {}) and data.get('non_required_policy'):
                    return True
                scoped = {_code(value) for value in data.get('queried_courses', [])}
                return (is_record(data) and data.get('record_status') == 'verified' and not data.get('coverage')
                        and (not scoped or code in scoped)
                        and code not in {_code(row['code']) for row in data.get('courses', [])})
            if any(not any(proves(code, indexed[key]) for key in claim['evidence_ids'] if key in indexed)
                   for code in codes):
                issues.append({'claim': claim['text'], 'problem': 'The cited record does not prove this negative membership or listing claim.'})
                break
    return issues


def requirement_fallback(evidence):
    """When no model answer passes verification, the verified lookup itself still answers a list request."""
    from .verifier import compose
    lookups = requirement_lookups(evidence, ('ok', 'empty', 'failed'))
    if not lookups:
        return None
    e = lookups[-1]
    data = e['data']
    label = _requirement_label(data)
    if data.get('queried_courses') and is_record(data) and e['status'] != 'failed' and data.get('mode') == 'catalog' and (
            e['status'] == 'ok' or data.get('outcome') in ('open_rule', 'source_conflict', 'incomplete_coverage')):
        claims = [{'kind': 'fact', 'text': record_membership(code, data), 'evidence_ids': [e['evidence_id']]}
                  for code in data['queried_courses']]
        return compose(claims, evidence)
    if data.get('queried_courses') and e['status'] == 'ok' and data.get('mode') == 'catalog':
        choices = {_code(c['code']): c for c in data['courses']}
        source = next((s for s in data.get('sources', []) if s.get('kind') == 'department_list'), None)
        source = source or next(iter(data.get('sources', [])), {})
        scope = f"{label} under {source_name(source, data['catalog_year'])}"
        citation = _source_note(source.get('url'), source.get('checked_on'))
        claims = []
        for code in data['queried_courses']:
            course = choices.get(_code(code))
            if course:
                text = f"Yes. {course['code']} counts toward {scope}."
                if course.get('condition'):
                    text += ' ' + course['condition']
            elif data.get('coverage'):
                text = f"The available evidence does not establish whether {code} is on {scope}."
            else:
                text = f"No. {code} is not listed for {scope}."
            claims.append({'kind': 'fact', 'text': text + citation, 'evidence_ids': [e['evidence_id']]})
        return compose(claims, evidence)
    if data.get('completion'):
        completion = data['completion']
        recorded = ', '.join(completion.get('recorded', []))
        if completion['status'] == 'record_unavailable':
            text = 'I could not read your saved completion record.'
        elif completion['status'] == 'recorded_minimum_met':
            text = f'Your completion record meets the listed course or unit rule for {label}. Recorded courses: {recorded}.'
        else:
            text = f'I could not verify completion of {label} from your saved record.'
            if recorded:
                text += f" Recorded candidates: {recorded}. Unconditional units from these candidates: {completion['unconditional_units']:g}."
            elif data.get('coverage') != 'section_designations':
                text += ' Your record has no matches among the listed options.'
            if data.get('coverage') == 'section_designations':
                text += ' The completion record does not establish the designation of a previously taken section.'
        claim = {'kind': 'fact', 'text': text, 'evidence_ids': [e['evidence_id']]}
    elif e['status'] in ('empty', 'failed'):
        claim = {'kind': 'gap', 'text': e['gap_statement'], 'evidence_ids': [e['evidence_id']]}
    elif data.get('outcome') in ('none_offered', 'none_open'):
        claim = {'kind': 'fact', 'text': data['gap'], 'evidence_ids': [e['evidence_id']]}
    elif data.get('mode') == 'catalog' and is_record(data):
        count = len(data['courses'])
        list_sources = {s['url']: s for c in data['courses'] if (s := c.get('rule_source')) and s.get('url')}
        sources = ' and '.join(source_name(s, data['catalog_year']) + _source_note(s['url'], s.get('checked_on')).rstrip('.')
                               for s in list_sources.values())
        if data.get('coverage') and list_sources:
            return compose([{'text': '', 'evidence_ids': [e['evidence_id']]}], evidence,
                           extra=requirement_table(evidence))
        claim = {'kind': 'fact', 'evidence_ids': [e['evidence_id']],
                 'text': f"{count} {'course' if count == 1 else 'courses'} under {record_label(data)} are named in "
                         f"{sources or source_name(data.get('rule_quote') or {}, data['catalog_year'])}."}
    elif data.get('mode') == 'catalog':
        claim = {'kind': 'fact', 'evidence_ids': [e['evidence_id']],
                 'text': f"The {data['catalog_year']} catalog evidence lists {len(data['courses'])} courses for {label}."}
    else:
        legacy_complete = (data['requirement'] == 'technical-electives' and 'query' not in data
                           and not data.get('open_only') and not data.get('coverage'))
        claim = {'kind': 'fact', 'evidence_ids': [e['evidence_id']],
                 'text': (f"{len(data['courses'])} of the {data['listed_count']} {label} on the "
                          f"{data['catalog_year']} list have {_term_label(data['term'])} sections.") if legacy_complete else
                         f"{len(data['courses'])} courses have qualifying {_term_label(data['term'])} sections for {label}"
                         + (' with reported open seats.' if data.get('open_only') else '.')}
    return compose([claim], evidence, extra=requirement_table(evidence))
