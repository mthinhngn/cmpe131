import json
from pathlib import Path
import unittest
from agent_service.availability import Availability, parse_satisfies
from agent_service.schedule_data import read_sections
from calendar_fixture import CalendarTools

DATA = Path(__file__).resolve().parents[2] / 'data/sjsu/2026-2027'


class Repository:
    def section_records(self, term):
        return json.loads((DATA / (term + '.json')).read_text(encoding='utf-8'))


class AvailabilityTests(unittest.TestCase):
    def test_every_captured_attribute_has_explicit_normalization(self):
        expected = {
            '': [], 'AI: US1': ['US1'], 'AI: US3': ['US3'],
            'GE: 1Bor4': ['GE 1B or GE 4'], 'GE: 4+US': ['GE 4', 'US (unspecified)'],
            'GE: UD 2/5': ['UD 2/5'], 'GE: WID+3': ['WID', 'GE 3'],
            'GWAR': ['GWAR'], 'PE: PhysEd': ['PE'], 'WID': ['WID'],
            'GE: Area 4': ['GE 4'], 'GE:3B+US23': ['GE 3B', 'US2', 'US3'],
        }
        for suffix in ['1A', '1B', '1C', '2', '3A', '3B', '4', '5A', '5B', '5C', '6', 'E', 'UD 3', 'UD 4']:
            expected['GE: ' + suffix] = [suffix if suffix.startswith('UD') else 'GE ' + suffix]
        expected.update({'GE: 3+US23': ['GE 3', 'US2', 'US3'], 'GE: 3B+US1': ['GE 3B', 'US1'],
                         'GE: 4+US1': ['GE 4', 'US1'], 'GE: 4+US23': ['GE 4', 'US2', 'US3'],
                         'GE: 5A+5C': ['GE 5A', 'GE 5C'], 'GE: 5B+5C': ['GE 5B', 'GE 5C']})
        captured = {r.get('attributes', '') for p in DATA.glob('*202*.json') for r in json.loads(p.read_text(encoding='utf-8'))}
        self.assertEqual(captured, set(expected))
        for value, result in expected.items():
            with self.subTest(value=value):
                self.assertEqual(parse_satisfies(value), result)
        with self.assertRaises(ValueError):
            parse_satisfies('GE: unknown')

    def test_us1_golden_snapshot(self):
        result = Availability(Repository()).find_courses_by_requirement('US1', 'Spring 2027')
        self.assertEqual([(r['code'], r['section_count'], r['open_seats_total']) for r in result['courses']],
                         [('AMS 10', 10, 205), ('HIST 15', 13, 783), ('HIST 170S', 4, 126), ('HIST 20A', 1, 19), ('HIST 20B', 1, 32)])
        self.assertTrue(result['fetched_at'])

    def test_unknown_seats_do_not_become_zero(self):
        class Unknown(Repository):
            def section_records(self, term):
                return [{'courseCode': 'HIST 15', 'classNumber': '1', 'attributes': 'GE: 4+US1', 'openSeats': None}]
        tools = Availability(Unknown())
        row = tools.get_sections('hist15', 'spring-2027')['sections'][0]
        self.assertIsNone(row['open_seats'])
        self.assertFalse(row['seats_known'])
        self.assertIsNone(tools.find_courses_by_requirement('US1', 'spring-2027')['courses'][0]['open_seats_total'])

    def test_live_adapter_preserves_attributes_and_unknown_seats(self):
        class Unknown(CalendarTools):
            def fetch(self, hit, deadline):
                data = super().fetch(hit, deadline)
                for row in data.get('schedule_rows', []):
                    row[4], row[12] = 'GE: 4+US1', 'TBA'
                return data
        data = read_sections('spring-2027', Unknown())
        self.assertEqual(data['offerings'][0]['attributes'], 'GE: 4+US1')
        self.assertIsNone(data['offerings'][0]['openSeats'])
        self.assertFalse(data['offerings'][0]['seatsKnown'])

    def test_fit_checks_existing_rules_and_meeting_conflicts_without_mutation(self):
        class Fit:
            def course_details(self, code):
                return {'course_id': 'target', 'code': 'CS 2', 'prerequisite_text': 'CS 1', 'catalog_url': 'https://catalog.sjsu.edu'}
            def prerequisite_rules(self, program):
                return [{'course_id': 'target', 'required_id': 'before', 'group_key': 'catalog', 'operator': 'AND', 'corequisite': False, 'manual_review': False}]
            def section_records(self, term):
                return [{'courseCode': 'CS 2', 'classNumber': '1', 'days': 'M', 'times': '09:00AM-10:00AM'},
                        {'courseCode': 'CS 3', 'classNumber': '2', 'days': 'M', 'times': '09:30AM-10:30AM'}]
        ctx = {'program_id': 'cs', 'starting_term': 'fall-2026', 'completed_course_ids': ['before'], 'plan': [], 'selected_sections': {'spring-2027': ['2']}}
        result = Availability(Fit()).invoke('check_fit', {'code': 'CS 2', 'term': 'spring-2027', 'class_numbers': ['1']}, ctx)
        self.assertEqual(result['prerequisites']['status'], 'met')
        self.assertEqual(result['schedule_status'], 'conflicts')
        self.assertEqual(result['conflicts'], [{'class_number': '1', 'with_class_number': '2'}])
        self.assertEqual(ctx['plan'], [])
