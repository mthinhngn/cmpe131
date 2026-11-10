"""Controlled official-page adapters; never used by production startup."""
from datetime import date
from agent_service.web_search_agent import create_web_search_agent


class CalendarTools:
    def __init__(self):
        self.searches = 0
        self.fetches = 0
        self.schedule_fetches = 0

    def search(self, query, deadline):
        self.searches += 1
        return [{"url": "https://www.sjsu.edu/registrar/calendar/test.php", "title": "Controlled calendar fixture"}]

    def schedule_url(self, term_id, deadline):
        return f"https://www.sjsu.edu/classes/schedules/{term_id}.php"

    def fetch(self, hit, deadline):
        self.fetches += 1
        if "/classes/schedules/" in hit["url"]:
            self.schedule_fetches += 1
            term = hit["url"].rsplit("/", 1)[1].replace(".php", "").replace("-", " ").title()
            rows = [[f"{code} (Section 01)", str(10000+i), "In Person", "Fixture course", "", "3", "LEC", "M", "9", "Fixture", "Room", "dates", "10", ""] for i, code in enumerate(("CS 146", "CMPE 131", "CMPE 126", "CMPE 142", "MATH 30"))]
            return {"source_id": "schedule", "url": hit["url"], "title": "Controlled schedule fixture", "retrieved_at": "2026-11-03T12:00:00+00:00", "content_hash": "schedule-hash", "text": "", "headings": [f"{term} Class Schedule"], "complete_table": True, "schedule_rows": rows}
        return {"source_id": "calendar", "url": hit["url"], "title": hit["title"], "retrieved_at": "2026-11-03T12:00:00+00:00", "content_hash": "test-hash", "text": "Fall 2026. August 20, 2026 Classes begin. December 18, 2026 Final examinations end."}


def extraction(sources, deadline):
    return {"periods": [{"season": "fall", "year": 2026, "start": "2026-08-20", "end": "2026-12-18", "source_id": "calendar", "term_quote": "Fall 2026", "start_quote": "August 20, 2026 Classes begin", "end_quote": "December 18, 2026 Final examinations end"}]}


def fixture_agent(tools=None, extract=extraction, today=lambda: date(2026, 11, 3)):
    return create_web_search_agent(tools or CalendarTools(), extract, today)
