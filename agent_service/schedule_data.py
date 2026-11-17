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
            match = re.fullmatch(r"(.+?)\s*\(Section\s+([^)]+)\)", row[0], re.I)
            if not match:
                match = re.fullmatch(r"(.+?)\s*Sec\s+(\d+)", row[0], re.I)
            course = re.fullmatch(r"([A-Z][A-Z0-9 &-]*?)\s+(\d+[A-Z]*)", match[1].strip(), re.I) if match else None
            if not course or not re.fullmatch(r"\d{5}", row[1]):
                raise LookupFailure("schedule_not_verified", "The published table includes an unrecognized class row.")
            if row[1] in seen:
                continue
            seen.add(row[1])
            if len(row) > 13 and re.search(r"\bcancel(?:led|ed)\b", row[13], re.I):
                continue
            number = re.sub(r"^0+(?=\d)", "", course[2].upper())
            code = f"{course[1].strip().upper()} {number}"
            offerings.append({"courseCode": code, "sectionNumber": match[2], "classNumber": row[1], "mode": row[2], "attributes": row[4], "component": row[6], "days": row[7], "times": row[8], "instructors": [n.strip() for n in row[9].split("/") if n.strip() and n.strip().lower() not in {"staff", "tba", "tbd"}], "location": row[10], "dates": row[11], "openSeats": int(row[12]) if re.fullmatch(r"-?\d+", row[12]) else None, "seatsKnown": bool(re.fullmatch(r"-?\d+", row[12]))})
        if not offerings:
            raise LookupFailure("schedule_not_published", "No readable sections are published for this semester.")
        result = {"term": term.id, "status": "available", "offerings": offerings, "sourceUrl": source["url"], "fetchedAt": source["retrieved_at"], "sourceUpdatedOn": source.get("sourceUpdatedOn"), "message": ""}
    except LookupFailure as exc:
        result = {"term": term.id, "status": "unavailable", "offerings": [], "message": str(exc), "error_code": exc.code}
    if tools is None:
        with _lock:
            _cache[term.id] = (time.monotonic() + (900 if result["status"] == "available" else 60), result)
    return result
