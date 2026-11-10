"""Term-specific sections from the existing bounded official-source adapter."""
import re
import time
from threading import RLock
from .web_contracts import parse_term
from .web_tools import OfficialSearchTools, LookupFailure
from .web_search_agent import normalized

_cache = {}
_lock = RLock()


def read_sections(term_id, tools=None):
    term = parse_term(term_id)
    if term.season not in {"fall", "spring"}:
        raise ValueError("Schedule monitors Fall and Spring only.")
    with _lock:
        cached = _cache.get(term.id)
        if tools is None and cached and cached[0] > time.monotonic():
            return cached[1]
    adapter = tools or OfficialSearchTools()
    deadline = time.monotonic() + 45
    try:
        url = adapter.schedule_url(term.id, deadline)
        source = adapter.fetch({"url": url, "title": f"{term.season.title()} {term.year} Class Schedule"}, deadline)
        heading = f"{term.season} {term.year} class schedule"
        if source["url"].rstrip("/") != url.rstrip("/") or not source.get("complete_table") or not any(normalized(h) == heading for h in source.get("headings", [])):
            raise LookupFailure("schedule_not_verified", "The published table could not be verified for this semester.")
        offerings, seen = [], set()
        for row in source.get("schedule_rows", []):
            if len(row) < 13:
                continue
            match = re.fullmatch(r"([A-Z]+\s*\d+[A-Z]*)\s*\(Section\s+([^)]+)\)", row[0], re.I)
            if not match or not row[1].isdigit() or row[1] in seen or re.search(r"\bcancel(?:led|ed)\b", " ".join(row), re.I):
                continue
            seen.add(row[1])
            code = re.sub(r"([A-Z]+)\s*(\d)", r"\1 \2", match[1].upper())
            offerings.append({"courseCode": code, "sectionNumber": match[2], "classNumber": row[1], "mode": row[2], "component": row[6], "days": row[7], "times": row[8], "instructors": [n.strip() for n in row[9].split("/") if n.strip() and n.strip().lower() not in {"staff", "tba", "tbd"}], "location": row[10], "dates": row[11], "openSeats": int(row[12]) if re.fullmatch(r"-?\d+", row[12]) else 0})
        if not offerings:
            raise LookupFailure("schedule_not_published", "No readable sections are published for this semester.")
        result = {"term": term.id, "status": "available", "offerings": offerings, "sourceUrl": source["url"], "fetchedAt": source["retrieved_at"], "message": ""}
    except LookupFailure as exc:
        result = {"term": term.id, "status": "unavailable", "offerings": [], "message": str(exc), "error_code": exc.code}
    if tools is None:
        with _lock:
            _cache[term.id] = (time.monotonic() + (900 if result["status"] == "available" else 60), result)
    return result
