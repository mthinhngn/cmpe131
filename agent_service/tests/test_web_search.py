import time
import unittest
import json
from unittest.mock import Mock, patch
import httpx
from groq import APIStatusError
from datetime import date
from agent_service.web_contracts import CalendarPeriod, Term, semester_slot, slot_term, next_term
from agent_service.web_tools import LookupFailure, OfficialSearchTools, official_url
from agent_service.web_search_agent import choose_current, lookup_input, verified_periods, published_ranges, calendar_excerpts, CALENDAR_TEXT_BUDGET, GroqCalendarExtractor
from calendar_fixture import CalendarTools, extraction, fixture_agent


class WebSearchTests(unittest.TestCase):
    def test_large_pages_produce_bounded_grounded_calendar_excerpts(self):
        relevant = 'Fall 2026 First Day of Instruction August 19, 2026 Last Day of Instruction December 7, 2026 '
        sources = [{"source_id": str(i), "url": f"https://www.sjsu.edu/classes/calendar/{i}.php",
                    "text": "navigation " * 10000 + relevant * 120} for i in range(4)]
        excerpts = calendar_excerpts(sources)
        self.assertLessEqual(sum(len(t) for s in excerpts for t in s['excerpts']), CALENDAR_TEXT_BUDGET)
        self.assertTrue(excerpts)
        for source in excerpts:
            original = sources[int(source['source_id'])]['text'].lower()
            for text in source['excerpts']:
                self.assertIn(text, original)
        fake = Mock()
        fake.with_structured_output.return_value.invoke.return_value = {'parsed': Mock(), 'parsing_error': None}
        with patch('agent_service.web_search_agent.ChatGroq', return_value=fake):
            GroqCalendarExtractor()(sources, time.monotonic() + 30)
        messages = fake.with_structured_output.return_value.invoke.call_args.args[0]
        self.assertLess(len(messages[1].content), 9000)
        self.assertNotIn('navigation ' * 100, messages[1].content)
        self.assertEqual(json.loads(messages[1].content), excerpts)

    def test_first_day_of_instruction_is_valid_teaching_evidence(self):
        source = CalendarTools().fetch({'url':'https://www.sjsu.edu/calendar', 'title':'Calendar'}, 0)
        source['text'] = 'Fall 2026 First Day of Instruction August 19, 2026 Last Day of Instruction December 7, 2026'
        data = extraction([], 0)
        data['periods'][0].update(start='2026-08-19', end='2026-12-07', start_quote='First Day of Instruction August 19, 2026', end_quote='Last Day of Instruction December 7, 2026')
        self.assertEqual(len(verified_periods(data, [source])), 1)

    def test_model_payload_and_rate_limits_are_distinct_and_not_retried(self):
        for status, code in [(413, 'model_input_too_large'), (429, 'model_rate_limited'), (503, 'model_service_failed')]:
            response = httpx.Response(status, request=httpx.Request('POST', 'https://api.groq.com'))
            extractor = Mock(side_effect=APIStatusError('private provider body', response=response, body=None))
            result = self.lookup(fixture_agent(extract=extractor))
            self.assertEqual(result['error_code'], code)
            self.assertEqual(extractor.call_count, 1)
            self.assertNotIn('private provider body', result['message'])

    def lookup(self, agent=None, kind='calendar', **kwargs):
        return (agent or fixture_agent()).invoke(lookup_input(kind, **kwargs))['result']

    def test_calendar_returns_facts_not_personal_slot(self):
        result = self.lookup()
        self.assertEqual(result['status'], 'verified')
        self.assertEqual(result['current_term'], {'season': 'fall', 'year': 2026})
        self.assertEqual(result['next_term'], {'season': 'spring', 'year': 2027})
        self.assertEqual(result['valid_until'], '2026-12-18')
        self.assertNotIn('semester_slot', result)
        self.assertTrue(result['citations'])

    def test_regular_progression_counts_skips_and_optional_starts(self):
        self.assertEqual(semester_slot('fall-2025', Term(season='fall', year=2026)), 3)
        self.assertEqual(semester_slot('summer-2025', Term(season='fall', year=2025)), 1)
        self.assertEqual(semester_slot('winter-2025', Term(season='spring', year=2025)), 1)
        self.assertEqual(semester_slot(None, Term(season='summer', year=2026)), 'summer-2026')
        self.assertEqual(next_term(Term(season='fall', year=2026)).id, 'spring-2027')
        self.assertEqual(next_term(Term(season='spring', year=2027)).id, 'fall-2027')
        for start in ('fall-2025', 'spring-2025', 'winter-2025', 'summer-2025'):
            for slot in range(1, 9): self.assertEqual(semester_slot(start, slot_term(start, slot)), slot)

    def test_failed_search_has_one_attempt(self):
        class Failure(CalendarTools):
            def search(self, query, deadline):
                self.searches += 1
                raise LookupFailure('provider_timeout', 'Search timed out')
        tools = Failure()
        self.assertEqual(self.lookup(fixture_agent(tools))['status'], 'failed')
        self.assertEqual((tools.searches, tools.fetches), (1, 0))

    def test_failed_fetch_has_no_second_round(self):
        class Failure(CalendarTools):
            def fetch(self, hit, deadline):
                self.fetches += 1
                raise LookupFailure('fetch_failed', 'HTTP 403')
        tools = Failure()
        self.assertEqual(self.lookup(fixture_agent(tools))['error_code'], 'fetch_failed')
        self.assertEqual((tools.searches, tools.fetches), (1, 1))

    def test_successful_empty_search_is_bounded(self):
        class Empty(CalendarTools):
            def search(self, query, deadline):
                self.searches += 1
                return []
        tools = Empty()
        self.assertEqual(self.lookup(fixture_agent(tools))['status'], 'not_verified')
        self.assertEqual(tools.searches, 2)

    def test_invented_dates_registration_dates_and_bad_citations_rejected(self):
        source = CalendarTools().fetch({'url': 'https://www.sjsu.edu/calendar', 'title': 'test'}, 0)
        for field, value in [('start', '2026-08-21'), ('term_quote', 'Spring 2027'), ('start_quote', 'August 20 Registration begins'), ('source_id', 'invented')]:
            data = extraction([], 0); data['periods'][0][field] = value
            self.assertEqual(verified_periods(data, [source]), [])

    def test_winter_summer_use_most_recent_regular_term(self):
        def period(season, year, start, end):
            return CalendarPeriod(season=season, year=year, start=start, end=end, source_id='fixture', term_quote='term', start_quote='start', end_quote='end!')
        fall = period('fall', 2026, '2026-08-20', '2026-12-18')
        winter = period('winter', 2027, '2027-01-04', '2027-01-20')
        spring = period('spring', 2027, '2027-01-27', '2027-05-17')
        following = period('fall', 2027, '2027-08-20', '2027-12-18')
        self.assertEqual(choose_current([fall, winter, spring], date(2027, 1, 10)).id, 'fall-2026')
        self.assertEqual(choose_current([spring, following], date(2027, 7, 1)).id, 'spring-2027')
        self.assertIsNone(choose_current([fall], date(2027, 2, 1)))

    def test_conflicting_dates_rejected(self):
        fall = CalendarPeriod.model_validate(extraction([], 0)['periods'][0])
        with self.assertRaises(LookupFailure): choose_current([fall, fall.model_copy(update={'end': date(2026, 12, 19)})], date(2026, 11, 3))

    def test_deadline_invalid_schema_missing_provider_fail_closed(self):
        data = lookup_input(); data['deadline'] = time.monotonic() - 1
        self.assertEqual(fixture_agent().invoke(data)['result']['error_code'], 'budget_exhausted')
        self.assertEqual(self.lookup(fixture_agent(extract=lambda *_: {'garbage': 'invalid'}))['status'], 'failed')
        with self.assertRaises(LookupFailure): OfficialSearchTools(key='').search('calendar', time.monotonic() + 10)

    def test_unsafe_urls_rejected(self):
        for url in ('http://www.sjsu.edu/', 'https://localhost/', 'https://169.254.169.254/', 'https://www.sjsu.edu.evil.org/', 'https://user:pass@www.sjsu.edu/', 'https://www.sjsu.edu:8000/'):
            with self.assertRaises(LookupFailure): official_url(url)

    def test_published_cross_year_instruction_ranges(self):
        for season, year, span, start, end in [('fall', 2026, 'August 19* - December 7, 2026', '2026-08-19', '2026-12-07'), ('winter', 2027, 'December 22, 2026 to January 16, 2027', '2026-12-22', '2027-01-16')]:
            quote = f'{season.title()} {year} Dates of Instruction: {span}'
            item = {'season': season, 'year': year, 'start': start, 'end': end, 'source_id': 'published', 'term_quote': quote, 'start_quote': quote, 'end_quote': quote}
            source = {'source_id': 'published', 'text': quote}
            self.assertEqual(len(verified_periods({'periods': [item]}, [source])), 1)
            self.assertEqual(verified_periods({'periods': [{**item, 'start': start[:-2] + '21'}]}, [source]), [])

    def test_labeled_ranges_are_verified_before_model_is_needed(self):
        text = 'Fall 2026 Dates of Instruction: August 19* - December 7, 2026. Winter 2027 Dates of Instruction: December 22, 2026 to January 16, 2027.'
        source = {'source_id': 'published', 'text': text}
        periods = verified_periods(published_ranges([source]), [source])
        self.assertEqual([(p.id, p.start.isoformat()) for p in periods], [('fall-2026', '2026-08-19'), ('winter-2027', '2026-12-22')])

    def test_offering_exact_course_term_without_calendar(self):
        tools = CalendarTools()
        result = self.lookup(fixture_agent(tools), 'offering', target_term='summer-2026', course_code='CMPE 126')
        self.assertEqual(result['status'], 'verified')
        self.assertEqual((tools.searches, tools.schedule_fetches), (0, 1))
        self.assertEqual(result['target_term'], {'season': 'summer', 'year': 2026})

    def test_absent_course_requires_complete_schedule(self):
        self.assertEqual(self.lookup(kind='offering', target_term='summer-2026', course_code='CMPE 999')['status'], 'not_offered')
        class Incomplete(CalendarTools):
            def fetch(self, hit, deadline): return {**super().fetch(hit, deadline), 'complete_table': False}
        self.assertEqual(self.lookup(fixture_agent(Incomplete()), 'offering', target_term='summer-2026', course_code='CMPE 999')['status'], 'failed')

    def test_wrong_term_or_unpublished_schedule_never_proves_absence(self):
        for change in ({'headings': ['Fall 2025 Class Schedule']}, {'schedule_rows': []}):
            class Wrong(CalendarTools):
                def fetch(self, hit, deadline): return {**super().fetch(hit, deadline), **change}
            self.assertEqual(self.lookup(fixture_agent(Wrong()), 'offering', target_term='summer-2026', course_code='CMPE 126')['status'], 'failed')

    def test_full_allowed_with_warning_canceled_excluded(self):
        class Full(CalendarTools):
            def fetch(self, hit, deadline):
                source = super().fetch(hit, deadline)
                for row in source['schedule_rows']: row[12] = '0'
                return source
        result = self.lookup(fixture_agent(Full()), 'offering', target_term='summer-2026', course_code='CMPE 126')
        self.assertEqual(result['status'], 'verified')
        self.assertIn('full or closed', result['warning'])
        class Canceled(Full):
            def fetch(self, hit, deadline):
                source = super().fetch(hit, deadline)
                for row in source['schedule_rows']: row[13] = 'Canceled'
                return source
        self.assertEqual(self.lookup(fixture_agent(Canceled()), 'offering', target_term='summer-2026', course_code='CMPE 126')['status'], 'not_offered')
