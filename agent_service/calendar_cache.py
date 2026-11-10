"""Shared verified academic calendar; PostgreSQL survives service restarts."""

import copy
import logging
import time
from threading import RLock

import psycopg
from psycopg.types.json import Jsonb

from .catalog import database_url
from .web_contracts import WebResult
from .web_search_agent import create_web_search_agent, local_today, lookup_input

log = logging.getLogger("course-radar-agent")
CACHE_KEY = "sjsu-calendar-v1"


class CalendarCache:
    def __init__(self, today=local_today):
        self.today = today
        self.lock = RLock()
        self.saved = None
        self.failure = None
        self.retry_at = 0

    def valid(self, value):
        try:
            result = WebResult.model_validate(value)
            return (result.kind == "calendar" and result.status == "verified"
                    and result.as_of <= self.today() <= result.valid_until)
        except (ValueError, TypeError):
            return False

    def get(self, loader):
        # Serialize Schedule and chat callers so concurrent requests share a lookup.
        with self.lock:
            if self.valid(self.saved):
                return copy.deepcopy(self.saved), True
            if self.failure is not None and time.monotonic() < self.retry_at:
                return copy.deepcopy(self.failure), True
            conn = None
            try:
                conn = psycopg.connect(database_url(), connect_timeout=5, autocommit=True,
                                       options="-c statement_timeout=70000")
                conn.execute("""CREATE TABLE IF NOT EXISTS agent_calendar_cache (
                    cache_key text PRIMARY KEY, evidence jsonb NOT NULL,
                    updated_at timestamptz NOT NULL DEFAULT now())""")
                # Also serialize across backend processes. The lock is released on close.
                conn.execute("SELECT pg_advisory_lock(131, 2026)")
                row = conn.execute("SELECT evidence FROM agent_calendar_cache WHERE cache_key = %s",
                                   (CACHE_KEY,)).fetchone()
                if row and self.valid(row[0]):
                    self.saved = row[0]
                    conn.close()
                    return copy.deepcopy(self.saved), True
            except psycopg.Error:
                log.warning("Calendar persistence unavailable; using shared memory cache.")
                if conn is not None:
                    conn.close()
                conn = None
            try:
                result = WebResult.model_validate(loader()).model_dump(mode="json")
                if self.valid(result):
                    self.saved = result
                    self.failure = None
                    if conn is not None:
                        try:
                            conn.execute("""INSERT INTO agent_calendar_cache (cache_key, evidence)
                                VALUES (%s, %s) ON CONFLICT (cache_key) DO UPDATE
                                SET evidence = EXCLUDED.evidence, updated_at = now()""",
                                         (CACHE_KEY, Jsonb(result)))
                        except psycopg.Error:
                            log.warning("Calendar persistence write failed; verified result retained in memory.")
                else:
                    # Never store a failed lookup as verified calendar evidence.
                    self.failure = result
                    self.retry_at = time.monotonic() + 60
                return copy.deepcopy(result), False
            finally:
                if conn is not None:
                    conn.close()


shared_calendar = CalendarCache()


class CachedWebAgent:
    def __init__(self, agent):
        self.agent = agent

    def invoke(self, data, config=None):
        if data["kind"] != "calendar":
            return self.agent.invoke(data, config)
        output = None

        def load():
            nonlocal output
            output = self.agent.invoke(data, config)
            return output["result"]

        result, reused = shared_calendar.get(load)
        if not reused:
            return {**output, "result": result}
        return {"result": result, "events": [{"node": "web_search.calendar_cache",
                "detail": "Reused shared calendar result; no web lookup was made."}]}


def read_calendar():
    return CachedWebAgent(create_web_search_agent()).invoke(lookup_input(), {"recursion_limit": 40})["result"]
