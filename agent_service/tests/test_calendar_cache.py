import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from unittest.mock import Mock, patch

import psycopg

from agent_service.calendar_cache import CalendarCache, CachedWebAgent
from agent_service.web_search_agent import lookup_input
from calendar_fixture import fixture_agent


class CalendarCacheTests(unittest.TestCase):
    def setUp(self):
        self.result = fixture_agent().invoke(lookup_input())["result"]
        self.rows = {}

        def connect(*args, **kwargs):
            conn = Mock()

            def execute(sql, args=None):
                cursor = Mock()
                if sql.startswith("SELECT evidence"):
                    value = self.rows.get(args[0])
                    cursor.fetchone.return_value = (value,) if value else None
                elif sql.startswith("INSERT"):
                    self.rows[args[0]] = args[1].obj
                return cursor

            conn.execute.side_effect = execute
            return conn

        self.db = patch("agent_service.calendar_cache.psycopg.connect", side_effect=connect)
        self.db.start()
        self.addCleanup(self.db.stop)

    def cache(self, day=date(2026, 11, 3)):
        return CalendarCache(today=lambda: day)

    def test_new_backend_instance_reuses_persisted_evidence_without_lookup(self):
        loader = Mock(return_value=self.result)
        self.cache().get(loader)
        saved, reused = self.cache().get(loader)
        self.assertTrue(reused)
        self.assertEqual(saved, self.result)
        self.assertEqual(loader.call_count, 1)

    def test_expired_evidence_requires_new_lookup(self):
        self.cache().get(lambda: self.result)
        loader = Mock(return_value={"kind": "calendar", "status": "failed", "as_of": "2026-12-19"})
        self.cache(date(2026, 12, 19)).get(loader)
        loader.assert_called_once()

    def test_failures_are_only_temporarily_cached_and_never_persisted(self):
        loader = Mock(return_value={"kind": "calendar", "status": "failed", "as_of": "2026-11-03"})
        cache = self.cache()
        cache.get(loader)
        cache.get(loader)
        self.assertEqual(loader.call_count, 1)
        self.assertEqual(self.rows, {})
        cache.retry_at = 0
        cache.get(loader)
        self.assertEqual(loader.call_count, 2)

    def test_chat_and_schedule_concurrent_callers_share_one_lookup(self):
        cache = self.cache()
        loader = Mock(return_value=self.result)
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: cache.get(loader), range(4)))
        self.assertEqual(loader.call_count, 1)
        self.assertEqual(sum(not reused for _, reused in results), 1)

    def test_database_failure_keeps_verified_memory_result(self):
        with patch("agent_service.calendar_cache.psycopg.connect", side_effect=psycopg.OperationalError()):
            cache = self.cache()
            loader = Mock(return_value=self.result)
            cache.get(loader)
            cache.get(loader)
            self.assertEqual(loader.call_count, 1)

    def test_wrappers_share_calendar_but_do_not_skip_offering_validation(self):
        cache = self.cache()
        agent = Mock()
        agent.invoke.return_value = {"result": self.result, "events": []}
        with patch("agent_service.calendar_cache.shared_calendar", cache):
            CachedWebAgent(agent).invoke(lookup_input())
            CachedWebAgent(agent).invoke(lookup_input())
            self.assertEqual(agent.invoke.call_count, 1)
            CachedWebAgent(agent).invoke(lookup_input("offering", target_term="fall-2026", course_code="CS 146"))
            self.assertEqual(agent.invoke.call_count, 2)


if __name__ == "__main__":
    unittest.main()
