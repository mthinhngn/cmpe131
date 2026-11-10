"""Import public SJSU schedules without an AI service. See docs/SJSU_IMPORT.md."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit
import uuid

from bs4 import BeautifulSoup
import requests
from dotenv import load_dotenv
import psycopg

ROOT = Path(__file__).resolve().parents[1]
TERMS = ("fall-2026", "winter-2027", "spring-2027")
YEAR = "2026-2027"
CATALOG = "https://catalog.sjsu.edu/content.php?catoid=23&navoid=8469"
ISCHOOL = "https://ischool.sjsu.edu/class-schedules"
CODE = re.compile(r"^([A-Z][A-Z0-9 &-]*?)\s+(\d+[A-Z]*)$", re.I)


def text(element, separator=" "):
    return re.sub(r"\s+", " ", element.get_text(separator, strip=True)).strip()


def code(value):
    match = CODE.fullmatch(value.strip())
    if not match:
        raise ValueError(f"Unrecognized course code: {value!r}")
    number_part = re.sub(r"^0+(?=\d)", "", match[2].upper())
    return f"{match[1].strip().upper()} {number_part}"


def number(value):
    return float(value) if re.fullmatch(r"\d+(?:\.\d+)?", value.strip()) else None


def lines(element):
    # Keep meeting patterns aligned; whitespace alone cannot distinguish them.
    for br in element.find_all("br"):
        br.replace_with(" / ")
    return text(element).strip(" / ")


def parse_schedule(html, term, source_url):
    soup = BeautifulSoup(html, "html.parser")
    expected = term.replace("-", " ") + " class schedule"
    if not any(expected in text(h).lower() for h in soup.find_all("h1")):
        raise ValueError(f"Schedule heading does not match {term}")
    sections, rejected = [], []
    for row in soup.select("tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) < 13:
            continue
        values = [lines(c) for c in cells]
        match = re.fullmatch(r"(.+?)\s*\(Section\s+([^)]+)\)", values[0], re.I)
        if not match:
            match = re.fullmatch(r"(.+?)\s*Sec\s+(\d+)", values[0], re.I)
        if not match or not re.fullmatch(r"\d{5}", values[1]):
            rejected.append(values)
            continue
        course_code = code(match[1])
        link = cells[0].find("a", href=True)
        instructors = [text(a) for a in cells[9].select('a[href^="mailto:"]')]
        sections.append({
            "courseCode": course_code, "sectionNumber": match[2], "classNumber": values[1],
            "title": values[3], "unitsText": values[5], "units": number(values[5]),
            "mode": values[2], "component": values[6], "days": values[7], "times": values[8],
            "instructors": list(dict.fromkeys(instructors)), "instructorText": values[9],
            "location": values[10], "dates": values[11],
            "openSeats": int(values[12]) if re.fullmatch(r"-?\d+", values[12]) else None,
            "notes": values[13] if len(values) > 13 else "", "attributes": values[4],
            "catalogUrl": urljoin(source_url, link["href"]) if link else CATALOG,
            "sourceUrl": source_url, "sourceKind": "main-schedule",
        })
    if rejected or not sections:
        raise ValueError(f"{term}: {len(rejected)} unrecognized rows; {len(sections)} readable rows. No database writes.")
    by_number = {}
    for row in sections:
        previous = by_number.get(row["classNumber"])
        if previous:
            if (previous["courseCode"], previous["sectionNumber"]) != (row["courseCode"], row["sectionNumber"]):
                raise ValueError(f"Conflicting class identity in {term}: {row['classNumber']}")
            previous.setdefault("additionalListings", []).append(row)
        else:
            by_number[row["classNumber"]] = row
    return list(by_number.values())


def ischool_links(html):
    soup = BeautifulSoup(html, "html.parser")
    result = {t: [] for t in TERMS}
    for row in soup.select("tr"):
        label = text(row)
        term = next((t for t in TERMS if t.replace("-", " ").lower() in label.lower()), None)
        if not term:
            continue
        for link in row.select("a[href]"):
            url = urljoin(ISCHOOL, link["href"])
            if urlsplit(url).hostname == "ischoolapps.sjsu.edu" and "session=" in url:
                result[term].append(url)
    return {term: list(dict.fromkeys(urls)) for term, urls in result.items()}


def parse_ischool(html, term, source_url):
    soup = BeautifulSoup(html, "html.parser")
    label = term.replace("-", " ")
    if label.lower() not in " ".join(text(h) for h in soup.select("h1")).lower():
        raise ValueError(f"iSchool heading does not match {term}")
    dates = re.search(r"Classes begin:\s*(\d{4}-\d\d-\d\d).*?Classes end:\s*(\d{4}-\d\d-\d\d)", text(soup), re.S)
    sections = []
    for row in soup.select("tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) < 6:
            continue
        values = [lines(c) for c in cells]
        match = re.fullmatch(r"([A-Za-z]+)\s*(\d+[A-Za-z]*)\s*-\s*(\d+)", values[0])
        if not match:
            continue
        if values[2] and not re.fullmatch(r"\d{5}", values[2]):
            raise ValueError(f"Unrecognized iSchool class number: {values[2]}")
        faculty = [text(a) for a in cells[3].select('a[href*="facultypages"]')]
        sections.append({
            "courseCode": code(match[1] + " " + match[2]), "sectionNumber": match[3], "classNumber": values[2],
            "title": values[1], "unitsText": "", "units": None,
            "mode": "Fully Online", "component": "", "days": "TBA", "times": "TBA",
            "instructors": list(dict.fromkeys(faculty)), "instructorText": values[3],
            "location": "ONLINE", "dates": "/".join(dates.groups()) if dates else "",
            "openSeats": None, "notes": values[5], "mandatoryZoom": values[4], "attributes": "",
            "catalogUrl": CATALOG, "sourceUrl": source_url, "sourceKind": "ischool",
        })
    if not sections:
        raise ValueError(f"No readable iSchool sections in {source_url}")
    return sections


def parse_catalog(html, source_url):
    """Parse a public course preview or a user-saved copy; never infer AND/OR rules."""
    soup = BeautifulSoup(html, "html.parser")
    heading = soup.select_one("#course_preview_title")
    if heading is None:
        return None
    match = re.match(r"(.+?)\s*[–—-]\s*(.+)", text(heading))
    if not match:
        raise ValueError("Unrecognized catalog course heading")
    # The preview body starts after h1 and ends before Class Schedule/footer links.
    chunks = []
    for sibling in heading.next_siblings:
        if getattr(sibling, "name", None) == "p" and sibling.find("a", href=re.compile("classes/schedules")):
            break
        chunks.append(str(sibling))
    body = BeautifulSoup("".join(chunks), "html.parser")
    for br in body.select("br"):
        br.replace_with("\n")
    value = body.get_text(" ", strip=True)
    units = re.search(r"^(.*?)\s*unit\(s\)", value, re.S)
    if not units:
        raise ValueError("Catalog units missing")
    units_text = re.sub(r"\s+", " ", units[1]).strip()
    rest = value[units.end():].strip()
    labels = r"(?:Prerequisite\(s\)|Corequisite\(s\)|Prerequisite or Corequisite|Grading|Repeatable for credit|Note|Satisfies)\s*:"
    description = re.split(labels, rest, maxsplit=1, flags=re.I)[0].strip()
    def field(name):
        found = re.search(rf"{name}\s*:\s*(.*?)(?={labels}|$)", rest, re.S | re.I)
        return re.sub(r"\s+", " ", found[1]).strip() if found else ""
    prereq, coreq = field(r"Prerequisite\(s\)"), field(r"Corequisite\(s\)")
    references = {code(text(a)): urljoin(source_url, a["href"]) for a in body.select('a[href*="preview_course"]') if CODE.fullmatch(text(a))}
    return {"code": code(match[1]), "title": match[2].strip(), "unitsText": units_text, "units": number(units_text),
            "description": re.sub(r"\s+", " ", description), "prerequisiteText": prereq, "corequisiteText": coreq,
            "prerequisiteCodes": [c for c in references if c in prereq], "corequisiteCodes": [c for c in references if c in coreq],
            "references": references, "sourceUrl": source_url}


class Sources:
    def __init__(self, directory, offline=False):
        self.directory, self.offline = directory, offline
        self.directory.mkdir(parents=True, exist_ok=True)
        self.client = requests.Session()
        self.client.headers["User-Agent"] = "CourseRadar/1.0 public-schedule-import"
        self.manifest = []

    def get(self, url):
        path = self.directory / (hashlib.sha256(url.encode()).hexdigest() + ".html")
        if self.offline:
            body = path.read_bytes()
        else:
            response = self.client.get(url, timeout=45)
            if response.status_code != 200 or not response.content:
                raise ValueError(f"Source unavailable: HTTP {response.status_code}; browser challenge={response.headers.get('x-amzn-waf-action', 'none')}; {url}")
            body = response.content
            path.write_bytes(body)
            path.with_suffix(".json").write_text(json.dumps({"url": url, "fetchedAt": datetime.now(timezone.utc).isoformat()}), encoding="utf8")
        metadata = json.loads(path.with_suffix(".json").read_text(encoding="utf8"))
        self.manifest.append({**metadata, "sha256": hashlib.sha256(body).hexdigest(), "file": path.name})
        return body.decode("utf8", errors="replace")


def collect(sources):
    report = {"catalogYear": YEAR, "sources": sources.manifest, "issues": [], "terms": {}, "complete": False}
    schedules = {}
    for term in TERMS:
        url = f"https://www.sjsu.edu/classes/schedules/{term}.php"
        schedules[term] = parse_schedule(sources.get(url), term, url)
        for row in schedules[term]:
            row["fetchedAt"] = sources.manifest[-1]["fetchedAt"]
        print(f"{term}: {len(schedules[term])} main schedule sections", flush=True)
    links = ischool_links(sources.get(ISCHOOL))
    for term, urls in links.items():
        if not urls:
            report["issues"].append({"term": term, "kind": "ischool-not-linked", "message": "No matching term linked by iSchool index; separate coverage unverified."})
        by_number = {s["classNumber"]: s for s in schedules[term]}
        for url in urls:
            try:
                extra = parse_ischool(sources.get(url), term, url)
                for row in extra:
                    row["fetchedAt"] = sources.manifest[-1]["fetchedAt"]
                numbered = [row for row in extra if row["classNumber"]]
                for row in extra:
                    if not row["classNumber"]:
                        report["issues"].append({"term": term, "kind": "unassigned-class-number", "sourceUrl": url, "evidence": row})
                # Validate the complete source before merging it into this term.
                for row in numbered:
                    old = by_number.get(row["classNumber"])
                    if old and old["courseCode"] != row["courseCode"]:
                        raise ValueError(f"Conflicting course identity for class {row['classNumber']}")
                for row in numbered:
                    old = by_number.get(row["classNumber"])
                    if old:
                        old.setdefault("additionalSources", []).append(row)
                    else:
                        # iSchool does not publish component/seat fields in this table.
                        # Preserve the source; do not fabricate schedulable metadata.
                        by_number[row["classNumber"]] = row
                print(f"{term}: {len(extra)} sections from {url}", flush=True)
            except (ValueError, requests.RequestException, FileNotFoundError) as exc:
                report["issues"].append({"term": term, "kind": "ischool-source-failed", "message": str(exc)})
        schedules[term] = list(by_number.values())
        report["terms"][term] = {"sections": len(by_number), "courses": len({s['courseCode'] for s in by_number.values()}),
                                  "subjects": sorted({s['courseCode'].rsplit(' ', 1)[0] for s in by_number.values()}),
                                  "ischoolSources": len(urls)}
    catalog = {}
    try:
        sources.get(CATALOG)
        # Save a reachable index for a later catalog-only pass; listing titles are not descriptions.
        report["issues"].append({"kind": "catalog-enrichment-pending", "message": "Catalog index saved; individual course descriptions still require import."})
    except (ValueError, requests.RequestException, FileNotFoundError) as exc:
        report["issues"].append({"kind": "catalog-source-unavailable", "message": str(exc)})
    # Saved public previews can be supplied without bypassing catalog access restrictions.
    for metadata in sorted(sources.directory.glob("*.json")):
        item = json.loads(metadata.read_text(encoding="utf8"))
        if "preview_course" in item.get("url", ""):
            record = parse_catalog(metadata.with_suffix(".html").read_text(encoding="utf8"), item["url"])
            if record:
                record["fetchedAt"] = item["fetchedAt"]
                catalog[record["code"]] = record
                body = metadata.with_suffix(".html").read_bytes()
                sources.manifest.append({**item, "sha256": hashlib.sha256(body).hexdigest(), "file": metadata.with_suffix(".html").name})
    return schedules, catalog, report


def save_database(schedules, catalog, fetched_at):
    load_dotenv(ROOT / "api/.env")
    import os
    from psycopg.types.json import Jsonb
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL is not configured")
    parts = urlsplit(database_url)
    query = {k: v[-1] for k, v in parse_qs(parts.query).items() if k != "schema"}
    url = parts._replace(query=urlencode(query)).geturl()
    all_courses = {}
    for rows in schedules.values():
        for row in rows:
            old = all_courses.get(row["courseCode"])
            if not old or old["units"] is None and row["units"] is not None:
                all_courses[row["courseCode"]] = {"code": row["courseCode"], **row}
    all_courses.update(catalog)
    # Include linked prerequisites even when no section exists in these terms.
    for record in catalog.values():
        for ref, source_url in record["references"].items():
            all_courses.setdefault(ref, {"code": ref, "title": ref, "units": None, "unitsText": "", "sourceUrl": source_url})
    with psycopg.connect(url, connect_timeout=10) as conn:
        conn.execute("SELECT pg_advisory_xact_lock(20261105)")
        existing = conn.execute('SELECT id, code FROM "Course"').fetchall()
        ids = {}
        for ident, course_code in existing:
            if course_code in ids:
                raise ValueError(f"Duplicate existing course identity: {course_code}")
            ids[course_code] = ident
        for course_code, record in sorted(all_courses.items()):
            ident = ids.setdefault(course_code, "sjsu-" + re.sub(r"[^a-z0-9]+", "-", course_code.lower()))
            conn.execute('INSERT INTO "Course" (id, code) VALUES (%s,%s) ON CONFLICT (id) DO NOTHING', (ident, course_code))
            full = course_code in catalog
            conn.execute('''INSERT INTO "UniversityCourseRecord"
                ("courseId","catalogYear",title,units,"unitsText",description,"prerequisiteText","corequisiteText","prerequisiteCodes","corequisiteCodes","sourceUrl","catalogStatus","fetchedAt")
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT ("courseId","catalogYear") DO UPDATE SET
                title=CASE WHEN EXCLUDED."catalogStatus"='catalog-verified' OR "UniversityCourseRecord"."catalogStatus"!='catalog-verified' THEN EXCLUDED.title ELSE "UniversityCourseRecord".title END,
                units=CASE WHEN "UniversityCourseRecord"."catalogStatus"='catalog-verified' AND EXCLUDED."catalogStatus"!='catalog-verified' THEN "UniversityCourseRecord".units ELSE COALESCE(EXCLUDED.units,"UniversityCourseRecord".units) END,
                "unitsText"=CASE WHEN "UniversityCourseRecord"."catalogStatus"='catalog-verified' AND EXCLUDED."catalogStatus"!='catalog-verified' THEN "UniversityCourseRecord"."unitsText" WHEN EXCLUDED."unitsText"!='' THEN EXCLUDED."unitsText" ELSE "UniversityCourseRecord"."unitsText" END,
                description=COALESCE(EXCLUDED.description,"UniversityCourseRecord".description),
                "prerequisiteText"=COALESCE(EXCLUDED."prerequisiteText","UniversityCourseRecord"."prerequisiteText"),
                "corequisiteText"=COALESCE(EXCLUDED."corequisiteText","UniversityCourseRecord"."corequisiteText"),
                "prerequisiteCodes"=CASE WHEN EXCLUDED."catalogStatus"='catalog-verified' THEN EXCLUDED."prerequisiteCodes" ELSE "UniversityCourseRecord"."prerequisiteCodes" END,
                "corequisiteCodes"=CASE WHEN EXCLUDED."catalogStatus"='catalog-verified' THEN EXCLUDED."corequisiteCodes" ELSE "UniversityCourseRecord"."corequisiteCodes" END,
                "sourceUrl"=CASE WHEN EXCLUDED."catalogStatus"='catalog-verified' OR "UniversityCourseRecord"."catalogStatus"!='catalog-verified' THEN EXCLUDED."sourceUrl" ELSE "UniversityCourseRecord"."sourceUrl" END,
                "catalogStatus"=CASE WHEN "UniversityCourseRecord"."catalogStatus"='catalog-verified' THEN "UniversityCourseRecord"."catalogStatus" ELSE EXCLUDED."catalogStatus" END,
                "fetchedAt"=CASE WHEN "UniversityCourseRecord"."catalogStatus"='catalog-verified' AND EXCLUDED."catalogStatus"!='catalog-verified' THEN "UniversityCourseRecord"."fetchedAt" ELSE EXCLUDED."fetchedAt" END''',
                (ident, YEAR, record["title"], record["units"], record["unitsText"], record.get("description"), record.get("prerequisiteText"), record.get("corequisiteText"), record.get("prerequisiteCodes", []), record.get("corequisiteCodes", []), record.get("sourceUrl", CATALOG), "catalog-verified" if full else "catalog-pending", record.get("fetchedAt", fetched_at)))
        stored, pending = {}, {}
        for term, rows in schedules.items():
            url = f"https://www.sjsu.edu/classes/schedules/{term}.php"
            conn.execute('''INSERT INTO "Term" (id,name,"sourceUrl","fetchedAt") VALUES (%s,%s,%s,%s)
                ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,"sourceUrl"=EXCLUDED."sourceUrl","fetchedAt"=EXCLUDED."fetchedAt"''', (term, term.replace("-", " ").title(), url, rows[0].get("fetchedAt", fetched_at)))
            values = []
            with conn.cursor() as cur:
                cur.executemany('''INSERT INTO "UniversitySectionRecord" ("termId","classNumber","courseId","sourceUrl",evidence,"fetchedAt")
                    VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT ("termId","classNumber") DO UPDATE SET
                    "courseId"=EXCLUDED."courseId","sourceUrl"=EXCLUDED."sourceUrl",evidence=EXCLUDED.evidence,"fetchedAt"=EXCLUDED."fetchedAt"''',
                    [(term, row["classNumber"], ids[row["courseCode"]], row["sourceUrl"], Jsonb(row), row.get("fetchedAt", fetched_at)) for row in rows])
            for row in rows:
                if not row["component"] or row["openSeats"] is None or re.search(r"\bcancel(?:led|ed)\b", row["notes"], re.I):
                    pending.setdefault(term, []).append(row["classNumber"])
                    continue
                values.append((str(uuid.uuid4()), term, ids[row["courseCode"]], row["classNumber"], row["sectionNumber"], row["mode"], row["component"], row["days"], row["times"], row["location"], row["dates"], row["openSeats"], row["instructors"]))
            with conn.cursor() as cur:
                cur.executemany('''INSERT INTO "Section" (id,"termId","courseId","classNumber","sectionNumber",mode,component,days,times,location,dates,"openSeats",instructors)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT ("termId","classNumber") DO UPDATE SET "courseId"=EXCLUDED."courseId","sectionNumber"=EXCLUDED."sectionNumber",mode=EXCLUDED.mode,component=EXCLUDED.component,days=EXCLUDED.days,times=EXCLUDED.times,location=EXCLUDED.location,dates=EXCLUDED.dates,"openSeats"=EXCLUDED."openSeats",instructors=EXCLUDED.instructors''', values)
            stored[term] = len(values)
    return {"courses": len(all_courses), "sourceSectionsStored": {t: len(rows) for t, rows in schedules.items()}, "sectionsUpserted": stored, "sectionsRequiringScheduleReview": pending,
            "note": "Upsert only; existing degree requirements, personal workspaces, and unlisted sections are preserved."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Use saved source files without HTTP requests")
    parser.add_argument("--write-db", action="store_true", help="Upsert into the configured catalog database")
    parser.add_argument("--output", type=Path, default=ROOT / "data/sjsu/2026-2027")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    sources = Sources(args.output / "sources", args.offline)
    try:
        schedules, catalog, report = collect(sources)
        now = datetime.now(timezone.utc).isoformat()
        report["runAt"] = now
        scheduled = {r["courseCode"] for rows in schedules.values() for r in rows}
        report["scheduledCourses"] = len(scheduled)
        report["catalogRecords"] = len(catalog)
        report["missingCatalogCodes"] = sorted(scheduled - catalog.keys())
        report["unresolvedPrerequisiteCodes"] = sorted({c for r in catalog.values() for c in r["references"]} - catalog.keys())
        for term, rows in schedules.items():
            (args.output / f"{term}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        (args.output / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        if args.write_db:
            report["database"] = save_database(schedules, catalog, now)
        report["complete"] = not report["issues"] and not report["missingCatalogCodes"] and not report["unresolvedPrerequisiteCodes"]
        (args.output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        print(json.dumps({"complete": report["complete"], "scheduledCourses": len(scheduled),
                          "sections": {t: len(rows) for t, rows in schedules.items()},
                          "catalogRecords": len(catalog), "missingCatalogRecords": len(report["missingCatalogCodes"]),
                          "unresolvedPrerequisites": len(report["unresolvedPrerequisiteCodes"]),
                          "issues": len(report["issues"]), "databaseWritten": args.write_db,
                          "report": str(args.output / "report.json")}, indent=2))
        return 0 if report["complete"] else 2
    finally:
        sources.client.close()


if __name__ == "__main__":
    sys.exit(main())
