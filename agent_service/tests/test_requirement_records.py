"""Code-checked requirement records: student-visible wording, membership, menu-bound selection and failures (no network).

All programs, requirements and course codes here are synthetic; assertions read the reply a student would see."""
import copy
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
from langchain_core.messages import HumanMessage

from agent_service.advisor_loop import AdvisorLoop
from agent_service.availability import Availability
from agent_service.evidence import envelope
from agent_service.graph import turn_state
from agent_service.program_requirements import ProgramRequirements
from agent_service.requirement_answer import check_requirement_claims
from agent_service.requirement_query import select_program_requirement

YEAR = '2026-2027'
CATALOG_URL = 'https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=90001'
DEPT_URL = 'https://www.sjsu.edu/example/electives.php'
NAMES = {'example-engineering': 'Example Engineering', 'sample-science': 'Sample Science'}


def source(url=CATALOG_URL, quote=None, checked='2026-11-08'):
    return {'kind': 'catalog_program' if 'catalog' in url else 'department_list', 'url': url, 'quote': quote,
            'locator': 'Example heading', 'documentDate': None, 'checkedOn': checked, 'retrievedAt': checked + 'T00:00:00Z'}


def record(program, key, label, courses=(), *, coverage=None, rule='Complete 6 units from the approved list.', excluded=(),
           conflicts=(), conditions=None, needs_review=False, scope='program', pattern='unspecified'):
    rule_source = source(quote=rule)
    rows = [{'code': code, 'courseId': None, 'title': f'{code} title', 'units': 3, 'inPlannerCatalog': True, 'groups': ['main'],
             'rules': [{'sections': None, 'term': None, 'topic': None, 'condition': (conditions or {}).get(code), 'source': source(DEPT_URL)}]}
            for code in courses]
    status = 'source_conflict' if needs_review else 'open_rule' if not rows else 'partial' if coverage else 'verified'
    return {'program': program, 'programName': NAMES.get(program, ''), 'catalogYear': YEAR, 'requirement': key,
            'requirementId': ('sjsu:' + YEAR if scope == 'campus' else 'cv-' + program) + ':' + key, 'label': label, 'scope': scope,
            'status': status, 'verificationStatus': 'code_checked', 'checkedAt': '2026-11-20T00:00:00Z', 'recordRevision': 1,
            'coverage': coverage, 'courses': rows, 'excludedCodes': list(excluded), 'conflicts': list(conflicts),
            'rule': {'kind': 'choose_units' if rows else 'open_rule', 'text': rule, 'count': None, 'units': 6, 'manualReview': needs_review,
                     'conditions': [], 'groups': [{'key': 'main', 'kind': 'choose_units', 'text': rule, 'count': None, 'units': 6,
                                                   'codes': list(courses), 'excludedCodes': list(excluded)}]},
            'applicability': {'pattern': pattern, 'conditions': [], 'programEffects': []}, 'aliases': [], 'sources': [rule_source, source(DEPT_URL)]}


def menu_row(listing, aliases=()):
    return {'id': listing['requirementId'], 'label': listing['label'], 'scope': listing['scope'], 'kind': listing['rule']['kind'],
            'verificationStatus': 'code_checked', 'needsReview': listing['status'] == 'source_conflict',
            'pattern': listing['applicability']['pattern'], 'aliases': [{'text': a, 'kind': kind} for a, kind in aliases],
            'sourceUrl': CATALOG_URL, 'checkedOn': '2026-11-08'}


CONFLICT = {'field': 'minimum_gpa', 'alternatives': [
    {'value': '2.7', **source(CATALOG_URL, 'A minimum GPA of 2.7 is required.')},
    {'value': '3.0', **source(DEPT_URL, 'Students need a 3.0 GPA.', '2026-11-10')}]}
COURSE_CONFLICT = {'field': 'exam_142_listing', 'alternatives': [
    {'value': 'Absent from the named list', **source(CATALOG_URL)}, {'value': 'Listed', **source(DEPT_URL)}]}

LISTINGS = {
    'example-engineering': [
        (record('example-engineering', 'technical-electives', 'Approved Upper Division Electives (6 units)', ['EXAM 120', 'EXAM 130', 'EXAM 140'],
                conditions={'EXAM 140': 'Only with department approval.'}, excluded=['EXAM 190'],
                rule='Approved Upper Division Electives (6 units). EXAM 190 may not be used.'),
         [('Technical Electives', 'common')]),
        (record('example-engineering', 'major-preparation', '2. Major Preparation (33 units)', ['EXAM 1', 'EXAM 2'], coverage='open',
                rule='Major Preparation: complete EXAM 1, EXAM 2 and other approved preparation courses.'), []),
        (record('example-engineering', 'university-electives', 'University Electives', excluded=['EXAM 99'],
                rule='University Elective Lower or Upper Division (6 units), excluding EXAM 99.'),
         [('University Elective Lower or Upper Division (6 units)', 'official')]),
        (record('example-engineering', 'core-courses', 'Core Courses (15 units)', ['EXAM 10', 'EXAM 11']), []),
        (record('example-engineering', 'design-electives', 'Design Electives', ['EXAM 141', 'EXAM 142'], needs_review=True,
                conflicts=[CONFLICT, COURSE_CONFLICT], rule='Choose two design electives with a minimum GPA of 2.7.'), []),
        (record('example-engineering', 'lab-electives', 'Lab Electives', needs_review=True, conflicts=[CONFLICT],
                rule='Lab electives are selected with the department.'), []),
    ],
    'sample-science': [
        (record('sample-science', 'technical-electives', 'Technical Electives (9 units)', ['SAMP 150', 'SAMP 160']), []),
    ],
}
CAMPUS_RECORDS = [
    (record(None, 'ge-area-3', 'GE Area 3 - Arts and Humanities', scope='campus', pattern='current',
            rule='Students must complete one three-unit course each in Arts, and Humanities.'),
     [('Area 3', 'official'), ('Arts and Humanities', 'official'), ('Area C', 'former')]),
    (record(None, 'ge-area-3a', 'GE Area 3A - Arts', scope='campus', pattern='current', rule='3A: Arts (formerly C1)'),
     [('Area 3A', 'official'), ('Arts', 'official'), ('Area C1', 'former')]),
    (record(None, 'ge-area-6', 'GE Area 6 - Ethnic Studies', scope='campus', pattern='current', rule='Area 6 - Ethnic Studies (formerly F)'),
     [('Area 6', 'official'), ('Ethnic Studies', 'official'), ('Area F', 'former')]),
    (record(None, 'legacy-area-f', 'Legacy GE Area F - Ethnic Studies', scope='campus', pattern='legacy', rule='Area F: Ethnic Studies'),
     [('Area F', 'official'), ('Ethnic Studies', 'official')]),
]
MAJOR_EFFECTS = {
    ('example-engineering', 'ge-area-3'): [{'effect': 'waived', 'text': '3 units of Area 3 are satisfied by EXAM 1.', 'requirement': 'Major Preparation',
                                           'requirementId': 'cv-example-engineering:major-preparation', 'needsReview': False,
                                           'source': source(quote='3 units of Area 3 are satisfied by EXAM 1.')}],
    ('example-engineering', 'ge-area-3a'): [{'effect': 'covered_by_major', 'text': 'Major coursework may satisfy Area 3A.', 'requirement': 'Lab Electives',
                                            'requirementId': 'cv-example-engineering:lab-electives', 'needsReview': True, 'source': None}],
}
CAMPUS = {'area f': {'status': 'ambiguous_requirement', 'candidates': [
    {'id': listing['requirementId'], 'label': listing['label'], 'scope': 'campus', 'pattern': listing['applicability']['pattern']}
    for listing, _ in CAMPUS_RECORDS if listing['requirement'] in ('ge-area-6', 'legacy-area-f')]}}


class Records(ProgramRequirements):
    """The assistant API contract (view=assistant) over synthetic records."""
    def __init__(self):
        super().__init__(base='http://localhost:1')
        self.calls = []

    def programs(self):
        return [{'slug': slug, 'title': name + ' — BS', 'kind': 'bachelor'} for slug, name in NAMES.items()]

    def menu(self, program, year):
        return [menu_row(listing, aliases) for listing, aliases in LISTINGS[program] + CAMPUS_RECORDS]

    def get(self, program, requirement='technical-electives'):
        self.calls.append((program, requirement))
        for listing, _ in LISTINGS[program] + CAMPUS_RECORDS:
            if requirement in (listing['requirementId'], listing['requirement']):
                found = {**copy.deepcopy(listing), 'programName': NAMES[program]}
                if listing['scope'] == 'campus':
                    found['majorEffects'] = copy.deepcopy(MAJOR_EFFECTS.get((program, listing['requirement']), []))
                    found['degreeSummary'] = source(quote='Summary of Degree Units: Major Preparation: 24.')
                return found
        campus = CAMPUS.get(requirement.lower())
        if campus:
            return {'programName': NAMES[program], 'catalogYear': YEAR, 'requirement': requirement, 'courses': [], 'sources': [], **copy.deepcopy(campus)}
        return {'programName': NAMES[program], 'catalogYear': YEAR, 'requirement': requirement, 'courses': [], 'status': 'unknown_requirement'}


class Schedule:
    SOURCE = {'source_url': 'https://www.sjsu.edu/classes/schedules/spring-2027.php', 'fetched_at': '2026-11-17T20:00:00Z',
              'lastImportedAt': '2026-11-17T20:00:00Z', 'sourceUpdatedOn': '2026-11-17'}

    def schedule_snapshot(self, term):
        if term != 'spring-2027':
            return [], {}
        row = {'sectionNumber': '01', 'days': 'MW', 'times': '9:00AM - 10:15AM', 'mode': 'In Person', 'instructors': ['A. Teacher']}
        return [{**row, 'courseCode': 'EXAM 120', 'classNumber': '50001', 'openSeats': 4},
                {**row, 'courseCode': 'EXAM 130', 'classNumber': '50002', 'openSeats': 0},
                {**row, 'courseCode': 'OTHER 5', 'classNumber': '50003', 'openSeats': 9},
                {**row, 'courseCode': 'ARTX 10', 'classNumber': '50004', 'openSeats': 2, 'attributes': 'GE: 3'}], self.SOURCE

    def course_details(self, code):
        return None


class NoModel:
    def bind_tools(self, definitions, **options):
        return self

    def invoke(self, messages):
        raise AssertionError('Requirement lookups in these tests are rendered by code.')


def ask(message, intent, program='example-engineering', requirements=None):
    requirements = requirements or Records()
    loop = AdvisorLoop(NoModel(), Availability(Schedule(), requirements=requirements), None, understander=lambda *_: intent,
                       direct_requirements=True, structured_requirements=True, today=lambda: date(2026, 11, 20))
    result = loop.run(turn_state(message, {'program_id': program, 'plan': []}))
    return result, requirements


def program_list(name, **extra):
    return {'needs': ['requirement_options'], 'requirement': name, 'requirement_filters': {'program_list': name, **extra}}


class RecordListTests(unittest.TestCase):
    def test_closed_list_distinguishes_department_list_from_catalog_rule(self):
        result, _ = ask('What are the technical electives for my major?', program_list('technical electives'))
        reply = result['reply']
        self.assertIn("3 courses under Approved Upper Division Electives (6 units) for Example Engineering are named in the EXAMPLE department’s list", reply)
        for code in ('EXAM 120', 'EXAM 130', 'EXAM 140'):
            self.assertIn(f'| **{code}**', reply)
        self.assertIn('Only with department approval.', reply)
        self.assertIn(f'Source: <{DEPT_URL}> (captured Nov 08, 2026).', reply)
        self.assertNotIn('EXAM 190 may not be used', reply)
        self.assertNotIn('| **EXAM 190**', reply)
        self.assertNotRegex(reply.casefold(), r'course radar verified|advisor (?:approved|verified)|\bverified list')
        self.assertEqual(result['steps'], [])

    def test_open_coverage_list_says_the_rule_may_allow_more_and_quotes_it(self):
        reply = ask('Show the major preparation courses', program_list('major preparation'))[0]['reply']
        self.assertIn('| **EXAM 1**', reply)
        rule = '“Major Preparation: complete EXAM 1, EXAM 2 and other approved preparation courses.”'
        self.assertIn('Other courses may qualify under the quoted rules.', reply)
        self.assertLess(reply.index(rule), reply.index('| **EXAM 1**'))

    def test_open_rule_quotes_rule_exclusions_link_and_date_without_a_list(self):
        result, _ = ask('Which classes count as university electives?', program_list('university electives'))
        reply = result['reply']
        self.assertIn("SJSU's 2026-2027 catalog does not give a closed course list for University Electives for Example Engineering.", reply)
        self.assertIn('It states: “University Elective Lower or Upper Division (6 units), excluding EXAM 99.”', reply)
        self.assertIn('catalog explicitly excludes EXAM 99.', reply)
        self.assertIn(f'Source: <{CATALOG_URL}> (captured Nov 08, 2026).', reply)
        self.assertNotIn('| **', reply)
        self.assertNotRegex(reply.casefold(), r'petition|form|office|advisor approv')

    def test_source_conflict_states_both_values_with_sources_and_keeps_list(self):
        reply = ask('List the design electives', program_list('design electives'))[0]['reply']
        self.assertIn('| **EXAM 141**', reply)
        self.assertIn('SJSU sources disagree on this requirement.', reply)
        self.assertIn(f'catalog says 2.7: “A minimum GPA of 2.7 is required.” Source: <{CATALOG_URL}> (captured Nov 08, 2026). versus '
                      f'the EXAMPLE department’s list says 3.0: “Students need a 3.0 GPA.” Source: <{DEPT_URL}> (captured Nov 10, 2026).', reply)

    def test_source_conflict_without_a_list_quotes_rule_and_both_sources(self):
        reply = ask('What counts for lab electives?', program_list('lab electives'))[0]['reply']
        self.assertIn('does not give a closed course list for Lab Electives for Example Engineering', reply)
        self.assertIn('2.7', reply)
        self.assertIn('3.0', reply)
        self.assertNotIn('Please confirm with the department.', reply)

    def test_verifier_rejects_one_conflicting_value_without_the_other(self):
        data = {'requirement': 'design-electives', 'mode': 'catalog', 'verification': 'code_checked', 'conflicts': [CONFLICT, COURSE_CONFLICT],
                'courses': [{'code': 'EXAM 141'}, {'code': 'EXAM 142'}], 'label': 'Design Electives'}
        evidence = [envelope(1, 'search_sections', data)]
        one = check_requirement_claims([{'kind': 'fact', 'text': 'Design electives need a minimum GPA of 3.0.', 'evidence_ids': ['ev_1']}], evidence)
        self.assertEqual(len(one), 1)
        self.assertIn('SJSU sources differ', one[0]['problem'])
        both = check_requirement_claims([{'kind': 'fact', 'text': 'SJSU sources list a minimum GPA of 2.7 (catalog) and 3.0 (department).',
                                          'evidence_ids': ['ev_1']}], evidence)
        self.assertEqual(both, [])
        listed = check_requirement_claims([{'kind': 'fact', 'text': 'EXAM 142 is Listed as a design elective.', 'evidence_ids': ['ev_1']}], evidence)
        self.assertEqual(len(listed), 1)
        unrelated = check_requirement_claims([{'kind': 'fact', 'text': 'EXAM 141 is required for this list.', 'evidence_ids': ['ev_1']}], evidence)
        self.assertEqual(unrelated, [])


class MembershipTests(unittest.TestCase):
    def check(self, message, code, requirement):
        intent = {'needs': ['eligibility'], 'courses': [code], 'requirement': requirement, 'requirement_filters': {'program_list': requirement}}
        return ask(message, intent)[0]['reply']

    def test_listed_course_is_yes_with_condition_and_source(self):
        reply = self.check('Does EXAM 140 count for technical electives?', 'EXAM 140', 'technical electives')
        self.assertTrue(reply.startswith("Yes. EXAM 140 counts toward Approved Upper Division Electives (6 units) for Example Engineering under the EXAMPLE department’s list."))
        self.assertIn('Only with department approval.', reply)
        self.assertIn(f'Source: <{DEPT_URL}>', reply)

    def test_explicitly_excluded_course_is_no_with_the_quoted_exclusion(self):
        reply = self.check('Does EXAM 190 count for technical electives?', 'EXAM 190', 'technical electives')
        self.assertIn("No. EXAM 190 is excluded from Approved Upper Division Electives (6 units) for Example Engineering under SJSU's 2026-2027 catalog. "
                      '“Approved Upper Division Electives (6 units). EXAM 190 may not be used.”', reply)

    def test_closed_list_without_the_course_is_not_on_the_list(self):
        reply = self.check('Does EXAM 175 count toward technical electives?', 'EXAM 175', 'technical electives')
        self.assertTrue(reply.startswith("No. EXAM 175 does not count toward Approved Upper Division Electives"))
        self.assertIn('the EXAMPLE department’s list', reply)
        self.assertIn('says “Approved Upper Division Electives', reply)

    def test_open_or_partial_rule_explains_eligibility(self):
        reply = self.check('Does EXAM 50 count for major preparation?', 'EXAM 50', 'major preparation')
        self.assertIn('Eligibility for EXAM 50 under Major Preparation (33 units) for Example Engineering depends on this rule', reply)
        self.assertIn('other approved preparation courses.', reply)
        self.assertNotIn('No.', reply)
        open_rule = self.check('Can EXAM 50 count as a university elective?', 'EXAM 50', 'university electives')
        self.assertIn('depends on this rule', open_rule)
        excluded = self.check('Can EXAM 99 count as a university elective?', 'EXAM 99', 'university electives')
        self.assertIn("No. EXAM 99 is excluded from University Electives for Example Engineering", excluded)

    def test_course_named_in_a_source_conflict_is_neither_yes_nor_no(self):
        reply = self.check('Does EXAM 142 count for design electives?', 'EXAM 142', 'design electives')
        self.assertIn('SJSU sources differ on whether EXAM 142 counts toward Design Electives for Example Engineering', reply)
        self.assertIn('Absent from the named list', reply)
        self.assertIn('Listed', reply)
        self.assertNotIn('Yes.', reply)


class SelectionTests(unittest.TestCase):
    def test_model_choice_unsupported_by_the_students_words_asks_with_closest_entries(self):
        result, requirements = ask('What are the core electives?', program_list('technical electives'))
        self.assertIn('Which requirement do you mean? Closest:', result['reply'])
        self.assertIn('Core Courses (15 units)', result['reply'])
        self.assertEqual(result['evidence'][0]['data']['outcome'], 'unknown_requirement')
        self.assertEqual(requirements.calls, [])

    def test_students_words_repair_a_wrong_menu_pick(self):
        result, requirements = ask('Which courses are core courses for my major?', program_list('major preparation'))
        self.assertEqual(requirements.calls, [('example-engineering', 'cv-example-engineering:core-courses')])
        self.assertIn('| **EXAM 10**', result['reply'])

    def test_two_named_requirements_without_a_supported_pick_ask(self):
        rows = [menu_row(listing, aliases) for listing, aliases in LISTINGS['example-engineering']]
        row, issue = select_program_requirement('electives', ['core courses or major preparation?'], rows)
        self.assertIsNone(row)
        self.assertEqual(issue[0], 'ambiguous_requirement')
        self.assertEqual({r['label'] for r in issue[1]}, {'Core Courses (15 units)', '2. Major Preparation (33 units)'})
        chosen, issue = select_program_requirement('Core Courses', ['core courses or major preparation?'], rows)
        self.assertIsNone(chosen)
        self.assertEqual(issue[0], 'ambiguous_requirement')

    def test_ambiguous_former_campus_name_lists_current_and_legacy_patterns(self):
        intent = {'needs': ['requirement_options'], 'requirement': 'Area F', 'requirement_filters': {'requirements_all': ['ge-6']}}
        result, _ = ask('What courses count for Area F?', intent)
        self.assertIn('Which requirement do you mean? GE Area 6 - Ethnic Studies (current GE pattern) · '
                      'Legacy GE Area F - Ethnic Studies (legacy GE pattern)', result['reply'])
        self.assertEqual(result['evidence'][0]['data']['outcome'], 'ambiguous_requirement')

    def test_campus_area_without_a_term_quotes_its_record_and_asks_for_a_term(self):
        intent = {'needs': ['requirement_options'], 'requirement': 'GE Area 3', 'requirement_filters': {'requirements_all': ['ge-3']}}
        reply = ask('What counts for GE Area 3?', intent)[0]['reply']
        self.assertIn("SJSU's 2026-2027 catalog does not give a closed course list for GE Area 3 - Arts and Humanities.", reply)
        self.assertIn('“Students must complete one three-unit course each in Arts, and Humanities.”', reply)
        self.assertIn('Which term should I check for sections with this designation?', reply)
        self.assertNotIn('3 units of Area 3 are satisfied by EXAM 1.', reply)

    def test_official_subject_name_binds_the_campus_record_through_the_menu(self):
        intent = {'needs': ['requirement_options'], 'requirement': 'Arts and Humanities', 'requirement_filters': {'requirements_all': ['ge-3']}}
        result, requirements = ask('What do I need to take for Arts and Humanities?', intent)
        self.assertEqual(requirements.calls, [('example-engineering', 'sjsu:2026-2027:ge-area-3')])
        self.assertIn('“Students must complete one three-unit course each in Arts, and Humanities.”', result['reply'])
        shared = ask('Which classes count for Ethnic Studies?',
                     {'needs': ['requirement_options'], 'requirement': 'Ethnic Studies', 'requirement_filters': {'requirements_all': ['ge-6']}})[0]
        self.assertIn('GE Area 6 - Ethnic Studies (current GE pattern) · Legacy GE Area F - Ethnic Studies (legacy GE pattern)', shared['reply'])

    def test_broad_ge_request_asks_which_area(self):
        result, _ = ask('What GE classes can I take?', {'needs': ['requirement_options'], 'requirement': 'GE'})
        reply = result['reply']
        self.assertIn('Which General Education requirement should I check?', reply)
        for area in ('GE Area 1 - ', 'GE Area 6 - '):
            self.assertIn(area, reply)
        self.assertNotIn('| **', reply)

    def test_named_major_overrides_workspace_major(self):
        result, requirements = ask('What are the technical electives for Sample Science?', program_list('technical electives'))
        self.assertEqual(requirements.calls, [('sample-science', 'cv-sample-science:technical-electives')])
        self.assertEqual(result['evidence'][0]['data']['program'], 'sample-science')
        self.assertIn('| **SAMP 150**', result['reply'])

    def test_named_major_phrasings(self):
        requirements = Records()
        for text in ('My friend is in Sample Science, what are their technical electives?', "What are Sample Science's technical electives?",
                     'I am majoring in Sample Science.', 'technical electives for sample science majors'):
            self.assertEqual(requirements.named(text), 'sample-science', text)
        for text in ('What are my technical electives?', 'Is SAMP 150 offered in Sample Science 2027?'):
            self.assertIsNone(requirements.named(text), text)

    def test_requirement_with_open_seat_filter_keeps_the_requirement(self):
        intent = {**program_list('technical electives', open_seats_only=True), 'term_text': 'Spring 2027'}
        result, _ = ask('Which technical electives have open seats in Spring 2027?', intent)
        data = result['evidence'][0]['data']
        self.assertEqual(data['requirement'], 'technical-electives')
        self.assertEqual([c['code'] for c in data['courses']], ['EXAM 120'])
        self.assertNotIn('OTHER 5', result['reply'])
        self.assertNotIn('professor_ratings', data)


class FailureAndScopeTests(unittest.TestCase):
    def test_unexpected_api_errors_are_lookup_failures_not_empty_lists(self):
        for status, body in [(500, {'message': 'Internal server error'}), (404, {'message': 'Cannot GET /bootstrap/requirement-menu'})]:
            client = Mock()
            client.get.return_value = httpx.Response(status, json=body, request=httpx.Request('GET', 'http://localhost:1/x'))
            requirements = Records()
            requirements.menu = lambda *_: ProgramRequirements.menu(requirements, *_)
            requirements.client = client
            result, _ = ask('What are the technical electives for my major?', program_list('technical electives'), requirements=requirements)
            evidence = result['evidence'][0]
            self.assertEqual((evidence['status'], evidence['data']['outcome']), ('failed', 'lookup_failed'))
            self.assertIn('could not be verified because the lookup failed', result['reply'])
            self.assertNotIn('| **', result['reply'])

    def test_unexpected_payload_status_is_a_lookup_failure(self):
        requirements = Records()
        requirements.get = lambda *_: {'programName': 'Example Engineering', 'catalogYear': YEAR, 'status': 'mystery', 'courses': []}
        result, _ = ask('What are the technical electives for my major?', program_list('technical electives'), requirements=requirements)
        self.assertEqual(result['evidence'][0]['data']['outcome'], 'lookup_failed')

    def test_program_catalog_not_found_stays_a_distinct_gap(self):
        client = Mock()
        client.get.return_value = httpx.Response(404, json={'message': 'Requested program catalog was not found'},
                                                 request=httpx.Request('GET', 'http://localhost:1/x'))
        self.assertIsNone(ProgramRequirements(base='http://localhost:1', client=client).get('missing-program'))

    def test_ratings_are_fetched_only_when_the_request_asks_about_instructors(self):
        sections = {'code': 'EXAM 120', 'term': 'spring-2027', 'sections': [{'class_number': '1', 'instructors': ['A. Teacher']}]}
        for intent, message, fetched in [({'needs': ['availability'], 'courses': ['EXAM 120']}, 'Does EXAM 120 have open seats in spring 2027?', False),
                                         ({'needs': ['instructor_reviews'], 'courses': ['EXAM 120']}, 'Who is the best professor for EXAM 120?', True)]:
            ratings = Mock()
            ratings.lookup.return_value = [{'name': 'A. Teacher', 'rating': 4.0}]
            availability = Mock()
            availability.invoke.return_value = sections
            loop = AdvisorLoop(NoModel(), availability, None, ratings=ratings, understander=lambda *_: intent)
            state =turn_state(message, {'program_id': 'example-engineering', 'plan': []})
            state['ratings_in_scope'] = AdvisorLoop._ratings_scope(intent['needs'], message)
            data, _, _ = loop.read('get_sections', {'code': 'EXAM 120', 'term': 'spring-2027'}, state)
            self.assertEqual(ratings.lookup.called, fetched, message)
            self.assertEqual('professor_ratings' in data, fetched)

    def test_course_facts_distinguish_imported_empty_term_from_missing_import(self):
        availability = Availability(Schedule(), requirements=Records())
        empty = availability.course_facts('EXAM 999', 'spring-2027')
        self.assertEqual(empty['active_sections'], 0)
        missing = availability.course_facts('EXAM 999', 'summer-2027')
        self.assertIsNone(missing['active_sections'])


class MajorEffectTests(unittest.TestCase):
    def test_waiver_question_quotes_the_majors_catalog_statement_and_the_campus_rule(self):
        result, requirements = ask('Is GE Area 3 waived for my major?', {'needs': ['policy'], 'requirement': 'GE Area 3'})
        reply = result['reply']
        self.assertTrue(reply.startswith("SJSU's 2026-2027 Example Engineering catalog says: “3 units of Area 3 are satisfied by EXAM 1.” "
                                         f"Source: <{CATALOG_URL}> (captured Nov 08, 2026)."), reply)
        self.assertIn('“Students must complete one three-unit course each in Arts, and Humanities.”', reply)
        self.assertNotIn('Which term', reply)
        self.assertNotRegex(reply, r'\byou (?:are|have been) (?:exempt|waived)\b')
        self.assertEqual(result['steps'], [])

    def test_no_recorded_effect_is_not_claimed_as_a_waiver(self):
        intent = {'needs': ['policy'], 'requirement': 'Arts and Humanities', 'requirement_filters': {'requirements_all': ['ge-3']}}
        reply = ask('Is Arts and Humanities covered by my major?', intent, program='sample-science')[0]['reply']
        self.assertIn("SJSU's 2026-2027 Sample Science catalog records no major waiver or coverage for GE Area 3 - Arts and Humanities.", reply)
        self.assertIn('“Summary of Degree Units: Major Preparation: 24.”', reply)
        self.assertNotIn('catalog says:', reply)
        self.assertNotIn('waived', reply.replace('waiver', ''))

    def test_unsourced_effect_is_omitted(self):
        reply = ask('Is GE Area 3A covered by my major?', {'needs': ['policy'], 'requirement': 'GE Area 3A'})[0]['reply']
        self.assertNotIn('Major coursework may satisfy Area 3A.', reply)
        self.assertNotIn('catalog says:', reply)

    def test_section_list_omits_unrequested_major_effects(self):
        intent = {'needs': ['requirement_options'], 'requirement': 'GE Area 3', 'term_text': 'Spring 2027',
                  'requirement_filters': {'requirements_all': ['ge-3']}}
        reply = ask('Which GE Area 3 classes are offered in Spring 2027?', intent)[0]['reply']
        self.assertIn('| **ARTX 10**', reply)
        self.assertNotIn('3 units of Area 3 are satisfied by EXAM 1.', reply)


class SharedQueryTests(unittest.TestCase):
    def test_every_query_route_keeps_scope_with_every_filter(self):
        message = 'List the technical electives offered next spring.'
        filters = ({'open_seats_only': True}, {'modes': ['In Person']}, {'days': ['M', 'W']},
                   {'required_days': ['M']}, {'exclude_days': ['F']}, {'starts_at_or_after': '08:00'},
                   {'ends_by': '11:00'}, {'courses': ['EXAM 120', 'OTHER 5']})
        for values in filters:
            with self.subTest(filters=values):
                availability = Availability(Schedule(), requirements=Records())
                loop = AdvisorLoop(NoModel(), availability, None, structured_requirements=True,
                                   today=lambda: date(2026, 11, 20))
                state = turn_state(message, {'program_id': 'example-engineering'})
                data, _, _ = loop.read('search_sections', {'term': 'fall-2027', **values}, state)
                result, _ = ask(message, {'needs': ['requirement_options'], 'requirement': 'technical electives',
                                         'term_text': 'Spring 2027', 'requirement_filters': values})
                for row in (data, result['evidence'][0]['data']):
                    self.assertTrue(row['query']['program_list'].endswith(':technical-electives'))
                    self.assertEqual(row['term'], 'spring-2027')
                    self.assertTrue(row['courses'])
                    self.assertTrue(all(course['code'].startswith('EXAM ') for course in row['courses']))
                    for key, value in values.items():
                        self.assertEqual(row['query'][key], value)

    def test_membership_and_offering_have_separate_sources(self):
        result, _ = ask('Does EXAM 130 count for technical electives and is it offered in Spring 2027?', {
            'needs': ['eligibility', 'availability'], 'courses': ['EXAM 130'], 'requirement': 'technical electives',
            'requirement_filters': {'program_list': 'technical electives'}, 'term_text': 'Fall 2027'})
        self.assertEqual([entry['tool'] for entry in result['evidence']], ['search_sections', 'course_facts'])
        self.assertIn(DEPT_URL, result['reply'])
        self.assertIn(Schedule.SOURCE['source_url'], result['reply'])
        self.assertIn('Yes. EXAM 130 is offered in Spring 2027. Sections: 01 (#50002)', result['reply'])
        self.assertNotIn('Fall 2027', result['reply'])

    def test_verifier_rejects_department_list_attributed_to_catalog(self):
        evidence = [envelope(1, 'search_sections', {'courses': [], 'sources': [source(DEPT_URL)]})]
        claim = {'kind': 'fact', 'text': f"The catalog lists these courses ({DEPT_URL}).", 'evidence_ids': ['ev_1']}
        self.assertIn('department', check_requirement_claims([claim], evidence)[0]['problem'])


if __name__ == '__main__':
    unittest.main()
