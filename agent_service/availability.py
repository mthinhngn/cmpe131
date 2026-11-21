"""Exact catalog and schedule reads; no model or personal-state mutations."""
import copy
import re
from contextlib import contextmanager
from contextvars import ContextVar
from threading import RLock
from .web_contracts import parse_term, semester_slot
from .section_actions import patterns
from .plan_changes import prerequisite_issues
from .requirement_query import (CAMPUS, CATALOG_YEAR, PROGRAM_IDS, SectionSearch, bind_schedule_filters, bind_section_scope,
                                broad_group, campus_mentions, exact_campus_id, MAJOR_EFFECT_QUESTION, mentions_phrase,
                                menu_mentions, select_program_requirement)
from .requirement_answer import major_effects_block, record_rule_gap

NON_REQUIRED = re.compile(r'\b(?:non[-\s]?required|not (?:already )?required)\b', re.I)

RECORD_STATUSES = ('code_checked', 'human_verified')
KNOWN_STATUSES = {'verified', 'partial', 'open_rule', 'source_conflict', 'unknown_requirement', 'ambiguous_requirement',
                  'catalog_unavailable', 'no_source'}


def _menu_choice(row):
    pattern = row.get('pattern')
    return row['label'] + (f' ({pattern} GE pattern)' if pattern in ('current', 'legacy') else '')


def _rule_quote(listing):
    """The record's catalog rule text with the source passage it comes from, for attribution."""
    rule = listing.get('rule') or {}
    text = ' '.join(str(rule.get('text') or '').split())
    sources = [s for s in listing.get('sources', []) if s and s.get('url')]
    def same(s):
        quote = ' '.join(str(s.get('quote') or '').split())
        return quote and (quote in text or text in quote)
    source = next((s for s in sources if same(s)), sources[0] if sources else {})
    return {'text': str(source.get('quote') or '').strip() if text and not same(source) else text,
            'url': source.get('url'), 'kind': source.get('kind'), 'checked_on': source.get('checkedOn'),
            'document_date': source.get('documentDate')}


def _record_fields(listing):
    """Record evidence the renderer needs: rule quote, explicit exclusions, sourced conflicts and applicability."""
    rule = listing.get('rule') or {}
    exclusions = {}
    for group in rule.get('groups') or []:
        for code in group.get('excludedCodes') or []:
            exclusions.setdefault(code, group.get('text') or rule.get('text'))
    for code in listing.get('excludedCodes') or []:
        exclusions.setdefault(code, rule.get('text'))
    return {'verification': listing['verificationStatus'], 'record_revision': listing.get('recordRevision'),
            'record_status': listing.get('status'), 'scope': listing.get('scope'), 'rule_quote': _rule_quote(listing),
            'exclusions': [{'code': code, 'text': text} for code, text in exclusions.items()],
            'conflicts': listing.get('conflicts') or [], 'pattern': (listing.get('applicability') or {}).get('pattern')}

_turn_snapshots = ContextVar('turn_schedules', default=None)


@contextmanager
def schedule_turn():
    token = _turn_snapshots.set((RLock(), {}))
    try:
        yield
    finally:
        _turn_snapshots.reset(token)


_SEAT_REQUEST = re.compile(
    r'\b(?:open\s+seats?|seats?\s+(?:left|open|available)|(?:available|remaining)\s+seats?'
    r'|not\s+full|còn\s+(?:chỗ|ghế)|(?:chỗ|ghế)\s+trống|chưa\s+(?:đầy|kín)(?:\s+chỗ)?)\b',
    re.I,
)


def parse_satisfies(value, *, strict=True):
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
        elif re.fullmatch(r'[1-6][ABC]?|[A-F][1-4]?', part):
            result.append('GE ' + part)
        elif part in {'WID', 'GWAR', 'PE: PHYSED'}:
            result.append('PE' if part.startswith('PE:') else part)
        elif strict:
            raise ValueError('Unrecognized satisfaction attribute: ' + part)
    return list(dict.fromkeys(result))


def _code(value):
    return re.sub(r'[^A-Z0-9]', '', value.upper())


def _metadata(rows):
    return {'source_url': next((r.get('sourceUrl') for r in rows if r.get('sourceUrl')), None),
            'fetched_at': min((str(r['fetchedAt']) for r in rows if r.get('fetchedAt')), default=None),
            **{key: rows[0].get(key) if rows else None for key in ('sourceUpdatedOn', 'checkedAt', 'lastImportedAt')}}


def _cancelled(row):
    return row.get('listed') is False or re.search(r'\bcancel(?:led|ed)\b', row.get('notes') or '', re.I) is not None


def _section(row):
    seats = row.get('openSeats')
    if row.get('seatsKnown') is False:
        seats = None
    return {'class_number': row['classNumber'], 'section': row.get('sectionNumber'), 'component': row.get('component'),
            'days': row.get('days'), 'times': row.get('times'), 'mode': row.get('mode'),
            'instructors': row.get('instructors', []), 'open_seats': seats if type(seats) is int else None,
            'seats_known': type(seats) is int}


def _matches_schedule(row, query):
    if query.modes and row.get('mode') not in query.modes:
        return False
    if not (query.days or query.required_days or query.exclude_days or query.starts_at_or_after or query.ends_by):
        return True
    allowed, required, excluded = set(query.days), set(query.required_days), set(query.exclude_days)
    def matches_days(days):
        return (not allowed or days <= allowed) and not days.intersection(excluded)

    if not (query.starts_at_or_after or query.ends_by):
        days = (row.get('days') or '').replace(' ', '')
        day_set = set(days.replace('/', ''))
        return bool(re.fullmatch(r'[MTWRFSU]+(?:/[MTWRFSU]+)*', days)) and required <= day_set and matches_days(day_set)

    try:
        meetings = patterns(row)
    except (AttributeError, KeyError, ValueError):
        return False
    def minutes(clock):
        hour, minute = map(int, clock.split(':'))
        return hour * 60 + minute
    return bool(meetings) and required <= set().union(*(days for days, _, _ in meetings)) and all(
        matches_days(days)
        and (not query.starts_at_or_after or start >= minutes(query.starts_at_or_after))
        and (not query.ends_by or end <= minutes(query.ends_by))
        for days, start, end in meetings
    )


def _listed_entry(entry):
    return entry['code'] + ('-' + '/'.join(entry['sections']) if entry.get('sections') else '')


def _rule_condition(entry):
    scope = entry.get('sections')
    conditions = [
        f'Applies in {entry["term"]}.' if entry.get('term') else None,
        f'Only section {", ".join(scope)} qualifies.' if scope else None,
        f'Approved topic: {entry["topic"]}.' if entry.get('topic') else None,
        entry.get('condition'),
    ]
    return ' '.join(filter(None, conditions)) or None


def _candidate(entries, sections):
    entry = entries[0]
    rules = [{key: rule.get(key) for key in ('term', 'sections', 'topic', 'condition', 'source')} for rule in entries]
    conditions = list(dict.fromkeys(_rule_condition(rule) for rule in rules))
    source = entry.get('source') or {}
    known = [s['open_seats'] for s in sections if s['seats_known']]
    positive = [n for n in known if n > 0]
    return {'code': entry['code'], 'title': entry.get('title'), 'units': entry.get('units'),
            'condition': ' or '.join(conditions) if None not in conditions and (not sections or len(rules) == 1) else None,
            'rules': rules,
            'rule_source': {'kind': source.get('kind'), 'url': source.get('url'), 'checked_on': source.get('checkedOn')},
            'satisfies': sorted({tag for s in sections for tag in s['designations']}),
            'section_count': len(sections), 'sections': sections,
            'seats_known': len(known) == len(sections),
            'open_section_count': len(positive) if len(known) == len(sections) else None,
            'open_seats_per_section': {'min': min(positive), 'max': max(positive)} if positive else None}


def _requirement_completion(entries, completed, rule, coverage):
    if completed is None:
        return {'status': 'record_unavailable'}
    rule = rule or {}
    completed = set(completed)
    options = list(entries)
    recorded = [e for e in options if e.get('courseId') in completed]
    unconditional = list({e['code']: e for e in recorded if not any(e.get(key) for key in ('sections', 'term', 'topic', 'condition'))}.values())
    units = sum(e['units'] for e in unconditional if isinstance(e.get('units'), (int, float)))
    count = rule.get('count')
    target_units = rule.get('units')
    confirmed = False
    if options and not coverage and not rule.get('manualReview'):
        if rule.get('all') or rule.get('kind') == 'required_all':
            confirmed = len(unconditional) == len({e['code'] for e in options})
        elif count or target_units:
            confirmed = (not count or len(unconditional) >= count) and (not target_units or units >= target_units)
    return {'status': 'recorded_minimum_met' if confirmed else 'unconfirmed',
            'recorded': list(dict.fromkeys(e['code'] for e in recorded)), 'unconditional_units': units,
            'required_count': count, 'required_units': target_units}


class Availability:
    def __init__(self, repository, sections=None, requirements=None):
        from .schedule_data import read_sections
        from .program_requirements import ProgramRequirements
        self.repository = repository
        self.sections = sections or read_sections
        self.requirements = requirements or ProgramRequirements()

    def invoke(self, name, arguments, context):
        context = context or {}
        if name == 'check_fit':
            return self.check_fit(context=context, **arguments)
        if name in ('list_requirements', 'search_sections'):
            return getattr(self, name)(**arguments, context_program=context.get('program_id'),
                                       **({'completed': context.get('completed_course_ids'), 'question': context.get('latest_message', ''),
                                           'earlier': context.get('earlier_messages', ()),
                                           'scope_required': context.get('requirement_scope_required', False)} if name == 'search_sections' else {}))
        if name == 'find_courses_by_requirement':
            return self.find_courses_by_requirement(**arguments, context_program=(context or {}).get('program_id'),
                                                    question=(context or {}).get('latest_message', ''),
                                                    completed=(context or {}).get('completed_course_ids'))
        if name not in {'get_course', 'get_sections', 'course_facts'}:
            raise ValueError('Unknown availability tool')
        return getattr(self, name)(**arguments)

    def list_requirements(self, program=None, catalog_year=None, context_program=None):
        year = catalog_year or CATALOG_YEAR
        slug, candidates = self.requirements.resolve(program) if program else (context_program, [])
        return {'catalog_year': year, 'program': slug, 'program_candidates': candidates,
                'requirements': list(CAMPUS.values()) if year == CATALOG_YEAR else [],
                'program_lists': self.requirements.menu(slug, year) if slug else []}

    def search_sections(self, *, context_program=None, completed=None, question='', earlier=(), scope_required=False, **args):
        query = bind_schedule_filters(SectionSearch.model_validate(args).normalized_ids(), question)
        label = query.program_list or 'schedule'
        return self.find_courses_by_requirement(label, term=query.term, program=query.program,
                                                context_program=context_program, catalog_year=query.catalog_year,
                                                completed=completed, query=query, question=question, earlier=earlier,
                                                scope_required=scope_required)

    def _schedule_snapshot(self, term):
        def read():
            if hasattr(self.repository, 'schedule_snapshot'):
                return self.repository.schedule_snapshot(term)
            return self.repository.section_records(term), {}

        turn = _turn_snapshots.get()
        if turn is None:
            return read()
        lock, snapshots = turn
        key = (id(self.repository), term)
        with lock:
            if key not in snapshots:
                snapshots[key] = read()
            return snapshots[key]

    def find_courses_by_requirement(self, area, term=None, program=None, open_only=False, context_program=None,
                                    question='', mode=None, catalog_year=None, completed=None, query=None, earlier=(),
                                    scope_required=False):
        from .program_requirements import listing_rules, refers_to_workspace_program, requirement_kind
        kind = area if query else requirement_kind(area) or area.strip()
        if query:
            open_only = query.open_seats_only
            mode = 'completion' if query.completion else 'seats' if open_only else 'offered' if term else 'catalog'
        else:
            open_only = mode == 'seats' or (open_only and (not question or bool(_SEAT_REQUEST.search(question))))
        if mode != 'completion' and open_only:
            mode = 'seats'
        elif not term and kind == 'technical-electives' and mode == 'offered':
            mode = 'catalog'
        else:
            mode = mode or ('offered' if term else 'catalog')
        parsed = parse_term(term) if term and mode in ('offered', 'seats') else None
        base = {'term': parsed.id if parsed else None, 'area': area, 'requirement': kind, 'open_only': open_only, 'mode': mode, 'courses': []}

        def gap(outcome, text, **details):
            return {**base, **details, 'status': 'empty', 'outcome': outcome, 'gap': text}

        slug = context_program
        named, ambiguous = None, []
        if question and (slug or program):
            if query and hasattr(self.requirements, 'named_matches'):
                named, ambiguous = self.requirements.named_matches(question)
            else:
                named = self.requirements.named(question)
        if ambiguous:
            return gap('ambiguous_program', 'Which major should I use? ' + ' · '.join(ambiguous), candidates=ambiguous)
        if named:
            slug, base['program_from'] = named, 'question'
        elif program and not refers_to_workspace_program(program) and (not query or not question or mentions_phrase(question, program)):
            slug, candidates = self.requirements.resolve(program)
            if not slug:
                return gap('unknown_program', f'Course Radar could not match "{program}" to one SJSU program.',
                           program_query=program, candidates=candidates)
        if query:
            year = catalog_year or CATALOG_YEAR
            if year != CATALOG_YEAR:
                return gap('catalog_unavailable', f'The {year} catalog is unavailable in Course Radar.')
            rows = []
            if slug and question and (query.program_list or not campus_mentions(question) and scope_required):
                rows = self.requirements.menu(slug, year)
            query, issue = bind_section_scope(query, question, rows, scope_required=scope_required and not earlier)
            base['query'] = query.model_dump()
            if issue:
                outcome, choices = issue
                options = ' · '.join(map(_menu_choice, choices))
                prefix = ' Closest:' if outcome == 'unknown_requirement' else ''
                return gap(outcome, 'Which requirement do you mean?' + (prefix + ' ' + options if options else ''), candidates=choices)
            if scope_required and not (query.requirements_all or query.requirements_any or query.program_list):
                return gap('unknown_requirement', 'Which requirement should I check?')
            campus_ids = set(query.requirements_all + query.requirements_any)
            kind = query.program_list or area
            if campus_ids - CAMPUS.keys():
                return gap('unknown_requirement', 'Which SJSU requirement should I check?',
                           candidates=[{'id': key, 'label': row['label']} for key, row in CAMPUS.items()])
            if query.completion and (len(campus_ids) + bool(query.program_list) != 1):
                return gap('incomplete_coverage', 'I can check saved completion for one requirement at a time.')
            if not parsed and not query.completion and (query.modes or query.days or query.required_days or query.exclude_days
                    or query.starts_at_or_after or query.ends_by or query.open_seats_only or not (campus_ids or query.program_list)):
                return gap('term_required', 'Which term should I check for these sections?')
            if question and not query.program_list and not query.courses and not campus_mentions(question) and broad_group(question):
                # A broad group names several designations without the student's operator; ask rather than intersect or pick one.
                name, ids = broad_group(question)
                return gap('ambiguous_requirement', f'Which {name} requirement should I check? ' + ' · '.join(CAMPUS[key]['label'] for key in ids),
                           candidates=[{'id': key, 'label': CAMPUS[key]['label']} for key in ids])
            if query.program_list:
                if not slug:
                    return gap('program_required', 'Which major should I use for this requirement?')
                choices = rows or self.requirements.menu(slug, year)
                program_rows = [row for row in choices if row.get('scope', 'program') == 'program']
                row = next((row for row in rows if row.get('id') == query.program_list and row.get('scope', 'program') == 'program'), None)
                issue = None
                if not row and program_rows:
                    row, issue = select_program_requirement(query.program_list, [question, *earlier], program_rows)
                exact = exact_campus_id(query.program_list) if issue and not campus_ids else None
                if exact:
                    # A campus designation proposed as a program list is checked as that designation instead.
                    return self.find_courses_by_requirement('schedule', term=term, program=program, context_program=context_program,
                                                            catalog_year=catalog_year, completed=completed, question=question, earlier=earlier,
                                                            query=query.model_copy(update={'program_list': None, 'requirements_all': [exact]}))
                if issue:
                    outcome, rows = issue
                    names = ' · '.join(_menu_choice(r) for r in rows)
                    text = ('Which requirement do you mean? ' + names if outcome == 'ambiguous_requirement' else
                            f'I could not match that to a requirement in this program\'s {year} catalog. Which requirement do you mean? Closest: {names}')
                    return gap(outcome, text, candidates=[{key: r.get(key) for key in ('id', 'label', 'scope', 'pattern')} for r in rows])
                if row:
                    kind = base['requirement'] = row['id']
                elif kind not in PROGRAM_IDS and kind not in {row['id'] for row in choices}:
                    return gap('unknown_requirement', 'Which requirement from this program should I check?', candidates=choices)
                listing = self.requirements.for_catalog(slug, kind, year) if catalog_year else self.requirements.get(slug, kind)
            else:
                listing = {'programName': '', 'catalogYear': year, 'label': 'Class schedule', 'status': 'verified'}
        elif slug:
            campus_ids = set()
            listing = self.requirements.for_catalog(slug, kind, catalog_year) if catalog_year else self.requirements.get(slug, kind)
        else:
            campus_ids = set()
            # Raw schedule readers can still query a known designation without program data.
            attribute = re.sub(r'^(?:GE\s+)?AREA\s+', 'GE ', re.sub(r'\s+', ' ', area.strip().upper()))
            if not re.fullmatch(r'GE (?:[1-6][ABC]?|[A-F][1-4]?)|US[123]|UD (?:[2345]|2/5)|WID|GWAR|PE', attribute):
                return gap('program_required', 'Which major and graduation requirement should I use?')
            year = catalog_year or '2026-2027'
            key = attribute.lower().replace(' ', '-').replace('/', '-')
            listing = {'programName': '', 'catalogYear': year, 'label': attribute, 'status': 'partial',
                       'attributes': [attribute], 'requirement': key, 'requirementId': f'sjsu:{year}:{key}',
                       'coverage': 'section_designations'}
        if not listing:
            return gap('unknown_program', f'Course Radar has no catalog entry for the program "{slug}".', program_query=slug)
        name, year = listing['programName'], listing['catalogYear']
        kind = listing.get('requirement', kind)
        label = listing.get('label') or ('Technical electives' if kind == 'technical-electives' else area)
        attributes = set(listing.get('attributes', []))
        # Section designations establish individual offerings, while the catalog-wide list remains incomplete.
        coverage = listing.get('coverage') or ('partial' if listing['status'] == 'partial' else None)
        base.update(program=slug, program_name=name, catalog_year=year, rule=listing.get('rule'),
                    requirement=kind, requirement_id=listing.get('requirementId'), label=label, coverage=coverage,
                    sources=[{'url': s['url'], 'title': f'{name} {label.lower()}', 'kind': s['kind'],
                              'checked_on': s.get('checkedOn'), 'quote': s.get('quote'), 'locator': s.get('locator')}
                             for s in listing.get('sources', []) if s])
        if query and campus_ids:
            def labels(ids):
                return [CAMPUS[key]['label'].split(' - ', 1)[0] for key in dict.fromkeys(ids)]
            all_labels, any_labels = labels(query.requirements_all), labels(query.requirements_any)
            groups = [' and '.join(all_labels), ' or '.join(any_labels)]
            campus_label = ' and '.join(f'({part})' if ' or ' in part and all_labels else part for part in groups if part)
            label = f'{name} {label.lower()} and {campus_label}' if query.program_list else campus_label
            base.update(label=label, coverage='section_designations', requirement='section-designations')
            base['sources'] += [{'url': CAMPUS[key]['source_url'], 'title': CAMPUS[key]['label'],
                                 'checked_on': CAMPUS[key]['checked_on']} for key in sorted(campus_ids)]
            coverage = 'section_designations'
        status = listing.get('status')
        if status not in KNOWN_STATUSES:
            # An unexpected payload is a failed lookup, never an empty list.
            raise ValueError('Unexpected requirement response')
        record = listing.get('verificationStatus') in RECORD_STATUSES
        if record:
            base.update(_record_fields(listing))
        course_codes = {_code(code) for code in query.courses} if query else set()
        membership = record and mode == 'catalog' and bool(course_codes)
        if membership:
            base['queried_courses'] = list(query.courses)
        if status == 'unknown_requirement':
            return gap(status, f'I could not match "{area}" to a recorded graduation requirement for {name}. Which requirement do you mean?')
        if status == 'ambiguous_requirement':
            options = listing.get('candidates', [])
            choices = [_menu_choice(p) + (f" ({', '.join(p['examples'])})" if p.get('examples') else '') for p in options]
            return gap(status, 'Which requirement do you mean? ' + ' · '.join(choices), candidates=options)
        if status == 'catalog_unavailable':
            return gap(status, f'The {catalog_year} catalog is unavailable for {name} in Course Radar.')
        if status == 'no_source':
            return gap('no_program_source', f'Course Radar has no verified {label.lower().rstrip("s")} list for {name} ({year} catalog), so it cannot say which courses count.')
        entries = list(listing_rules(listing))
        if membership:
            base['list_sources'] = list({
                source['url']: source for entry in entries
                if (source := entry.get('source')) and source.get('url')
            }.values())
            policy = next((source for source in base['sources'] if NON_REQUIRED.search(source.get('quote') or '')), None)
            if policy and slug:
                base['non_required_policy'] = policy
                base['required_course_sources'] = self._required_course_sources(
                    slug, year, rows, course_codes - {_code(entry['code']) for entry in entries})
        if record and not entries and mode == 'catalog' and membership:
            # Membership is answered per course from the quoted rule and its explicit exclusions.
            return {**base, 'outcome': 'none_eligible', 'courses': [], 'listed_count': 0}
        if record and not entries and status in ('open_rule', 'source_conflict'):
            return gap(status, record_rule_gap(base, base['conflicts']))
        if status == 'open_rule':
            return gap(status, f'The {year} catalog describes {label} as a rule. It does not supply a closed list of approved courses.')
        if mode == 'completion':
            return {**base, 'outcome': 'completion', 'completion': _requirement_completion(entries, completed, base['rule'], coverage)}
        campus_lookup = query and campus_ids and not query.program_list and not course_codes
        if not parsed and coverage == 'section_designations':
            campus = self._campus_record(slug, campus_ids, question) if campus_lookup else None
            if campus and campus.get('status') == 'ambiguous_requirement':
                options = campus['candidates']
                return gap('ambiguous_requirement', 'Which requirement do you mean? ' + ' · '.join(map(_menu_choice, options)), candidates=options)
            text = f'Course Radar has no complete catalog-wide list for {label}. Which term should I check for sections with this designation?'
            if campus:
                fields = {**base, **_record_fields(campus), 'label': campus.get('label') or label, 'catalog_year': campus.get('catalogYear') or year}
                base.update({key: fields[key] for key in ('verification', 'record_revision', 'rule_quote', 'pattern')})
                effects = major_effects_block(campus.get('majorEffects'), campus.get('programName'), fields['catalog_year'],
                                              fields['label'], campus.get('degreeSummary'))
                if effects and MAJOR_EFFECT_QUESTION.search(question or ''):
                    return gap('program_effects', effects + '\n\n' + record_rule_gap(fields))
                text = record_rule_gap(fields)
                if re.search(r'\b(?:which|what)\b.{0,90}\b(?:take|counts?|courses?|classes?)\b', question, re.I):
                    text += '\n\nWhich term should I check for sections with this designation?'
            return gap('incomplete_coverage', text)
        by_course = {}
        for entry in entries:
            by_course.setdefault(entry['code'], []).append(entry)
        if mode == 'catalog':
            if not entries and coverage and not membership:
                return gap('incomplete_coverage', f'Course Radar does not have a complete catalog list for {label}. Ask for a term to see its qualifying section designations.' if attributes
                           else f'The available {year} source does not verify a complete course list for {label}.')
            if course_codes:
                by_course = {code: rules for code, rules in by_course.items() if _code(code) in course_codes}
            return {**base, 'outcome': 'eligible' if by_course else 'none_eligible',
                    'courses': [_candidate(rules, []) for _, rules in sorted(by_course.items())], 'listed_count': len(by_course)}
        if not parsed:
            return gap('term_required', f'Which term should I check for {label}, for example Spring 2027?')
        term_label = f'{parsed.season.title()} {parsed.year}'
        rows, schedule_source = self._schedule_snapshot(parsed.id)
        if not schedule_source and (hasattr(self.repository, 'schedule_snapshot') or
                                    (not rows and not self.repository.has_imported_schedule(parsed.id))):
            return gap('term_not_imported', f'No {term_label} class schedule has been imported, so offerings for {label} cannot be checked.')
        if attributes:
            by_course.clear()
        by_code = {}
        schedule_only = query is not None and not query.program_list
        for row in rows:
            if not _cancelled(row):
                if query:
                    code = row['courseCode']
                    if (course_codes and _code(code) not in course_codes) or not _matches_schedule(row, query):
                        continue
                    tags = set(parse_satisfies(row.get('attributes'), strict=False))
                    matched = {key for key in campus_ids if tags.intersection(CAMPUS[key]['attributes'])}
                    if not set(query.requirements_all) <= matched or (query.requirements_any and not matched.intersection(query.requirements_any)):
                        continue
                    row = {**row, 'requirement_tags': sorted(tags)}
                    if schedule_only:
                        by_course.setdefault(code, [{'code': code, 'title': row.get('title'), 'units': row.get('units')}])
                elif attributes:
                    tags = set(parse_satisfies(row.get('attributes'), strict=False)) & attributes
                    if not tags:
                        continue
                    row = {**row, 'requirement_tags': sorted(tags)}
                    code = row['courseCode']
                    by_course.setdefault(code, [{'code': code, 'title': row.get('title'), 'units': row.get('units')}])
                by_code.setdefault(_code(row['courseCode']), []).append(row)
        courses, not_offered, full, unknown, closed = [], [], [], [], []
        if course_codes:
            by_course = {code: rules for code, rules in by_course.items() if _code(code) in course_codes}
        for code, rules in sorted(by_course.items()):
            sections = []
            matched_rules = []
            for row in by_code.get(_code(code), []):
                matches = [rule for rule in rules
                           if (not rule.get('term') or rule['term'] == parsed.id)
                           and (not rule.get('sections') or row.get('sectionNumber') in rule['sections'])
                           and (not rule.get('topic') or (row.get('topic') or row.get('sectionTitle') or row.get('title') or '').strip().casefold() == rule['topic'].strip().casefold())]
                if not matches:
                    continue
                matched_rules.extend(rule for rule in matches if rule not in matched_rules)
                conditions = list(dict.fromkeys(_rule_condition(rule) for rule in matches))
                sections.append({**_section(row), 'designations': row.get('requirement_tags') or [],
                                 'eligibility_condition': ' or '.join(conditions) if None not in conditions else None})
            if not sections:
                if not query or not (campus_ids or query.days or query.required_days or query.exclude_days or query.modes
                                     or query.starts_at_or_after or query.ends_by):
                    not_offered.append(_listed_entry(rules[0]) if len(rules) == 1 else code)
                continue
            sections = list({section['class_number']: section for section in sections}.values())
            if open_only:
                unknown.extend({'code': code, **s} for s in sections if not s['seats_known'])
                all_known = all(s['seats_known'] for s in sections)
                sections = [s for s in sections if (s['open_seats'] or 0) > 0]
                if not sections:
                    full.append(code)
                    if all_known:
                        closed.append(code)
                    continue
            detail = next(row for row in by_code[_code(code)] if row['classNumber'] == sections[0]['class_number'])
            entry = matched_rules[0]
            courses.append(_candidate([{**entry, 'title': entry.get('title') or detail.get('title'),
                                        'units': entry.get('units') or detail.get('units')}, *matched_rules[1:]], sections))
        result = {**base, 'courses': courses, 'listed_count': len(by_course), 'listed_not_offered': not_offered,
                  **({'full_or_unknown': full, 'zero_seat_courses': closed, 'unknown_seat_sections': unknown} if open_only else {}),
                  **(schedule_source or _metadata(rows))}
        if not courses:
            # A dated import proves the scoped negative; missing coverage remains a gap.
            dated = result.get('source_url') and result.get('fetched_at') and result.get('lastImportedAt')
            target = ', '.join(query.courses) if query and not query.program_list and not campus_ids and query.courses else label
            result.update(status='ok' if query and dated else 'empty', outcome='none_open' if full else 'none_offered',
                          gap=(f'No qualifying {term_label} sections have reported open seats for {target}.'
                               if full else f'No active {term_label} sections matched {target} in the saved schedule.'))
        else:
            result['outcome'] = 'offered'
        return result

    def _campus_record(self, slug, ids, question):
        """The code-checked campus record for the designation phrase the student used; ambiguity is returned, not resolved."""
        if not slug or len(ids) != 1:
            return None
        # The record menu's sourced aliases bind the student's own words; several matching records stay a question.
        said = menu_mentions(question, [r for r in self.requirements.menu(slug, CATALOG_YEAR) if r.get('scope') == 'campus']) if question else []
        if len(said) > 1:
            return {'status': 'ambiguous_requirement', 'candidates': [{key: r.get(key) for key in ('id', 'label', 'scope', 'pattern')} for r in said]}
        row = CAMPUS[next(iter(ids))]
        short = row['label'].split(' - ', 1)[0]
        names = sorted({short.removeprefix('Legacy '), *row['former_names'], *row['aliases']}, key=len, reverse=True)
        phrase = said[0]['id'] if said else next((name for name in names if question and mentions_phrase(question, name)), short)
        listing = self.requirements.get(slug, phrase)
        if not listing:
            return None
        if listing.get('status') == 'ambiguous_requirement' and listing.get('candidates') and all(c.get('scope') for c in listing['candidates']):
            return listing
        if listing.get('verificationStatus') in RECORD_STATUSES and listing.get('scope') == 'campus':
            return listing
        return None

    def _required_course_sources(self, slug, year, menu, wanted):
        if not wanted:
            return {}
        found = {}
        for row in menu or self.requirements.menu(slug, year):
            if row.get('scope') != 'program' or row.get('kind') != 'required_all':
                continue
            listing = self.requirements.get(slug, row['id']) or {}
            if listing.get('verificationStatus') not in RECORD_STATUSES or listing.get('conflicts'):
                continue
            rule = listing.get('rule') or {}
            required = {_code(code) for group in rule.get('groups', []) if group['kind'] == 'required_all'
                        for code in group['codes']}
            if not rule.get('groups') and rule.get('kind') == 'required_all':
                required = {_code(course['code']) for course in listing['courses']}
            for course in listing.get('courses', []):
                key = _code(course['code'])
                if key not in wanted & required or key in found:
                    continue
                source = next((item.get('source') for item in course.get('rules', [])
                               if (item.get('source') or {}).get('url') and not any(
                                   item.get(field) for field in ('term', 'sections', 'topic'))), None)
                if source:
                    found[key] = source
            if wanted <= found.keys():
                break
        return found

    def course_facts(self, code, term=None):
        row = self.repository.course_details(code)
        verified = row and row.get('catalog_status') in ('catalog-verified', 'retrieved')
        sources = [{'source_url': row.get('catalog_url'), 'fetched_at': str(row['fetched_at']) if row.get('fetched_at') else None,
                    'title': f"{row['code']} catalog record"}] if verified else []
        result = {'code': row['code'] if row else code.upper(), 'catalog_year': CATALOG_YEAR,
                  'catalog_record': 'found' if verified else 'pending' if row else 'not_in_saved_catalog',
                  'term': term, 'sources': sources}
        if term:
            rows, source = self._schedule_snapshot(term)
            active = {r['classNumber']: _section(r) for r in rows if _code(r['courseCode']) == _code(code) and not _cancelled(r)}
            count = len(active)
            if hasattr(self.repository, 'schedule_snapshot'):
                result.update(active_sections=count if source else None, offering_sections=list(active.values()) if source else [], **source)
            else:
                result.update(active_sections=count if count else None, **_metadata(rows))
        return result

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
        result = {'code': code, 'term': term, 'sections': []}
        if hasattr(self.repository, 'schedule_snapshot'):
            rows, metadata = self._schedule_snapshot(term)
            result['snapshot'] = True
            if not metadata:
                return {**result, 'status': 'unavailable', 'gap': f'No {term} class schedule has been imported.'}
        elif fresh:
            data = self.sections(term)
            if data.get('status') != 'available':
                raise ValueError(data.get('message') or 'Official schedule unavailable')
            rows = data.get('offerings', [])
            metadata = {'source_url': data.get('sourceUrl'), 'fetched_at': data.get('fetchedAt'),
                        'sourceUpdatedOn': data.get('sourceUpdatedOn')}
        else:
            rows, _ = self._schedule_snapshot(term)
            metadata = _metadata(rows)
        result['sections'] = [{**_section(row), 'location': row.get('location'), 'satisfies': parse_satisfies(row.get('attributes'))}
                              for row in rows if _code(row['courseCode']) == _code(code) and not _cancelled(row)]
        return {**result, **metadata}

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
        rows, _ = self._schedule_snapshot(term.id)
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
