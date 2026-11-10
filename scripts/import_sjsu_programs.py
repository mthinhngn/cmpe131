"""Normalize saved official catalog pages; publish programs without replacing personal data.

Collect first with collect_sjsu_programs.mjs / collect_sjsu_roadmaps.mjs.
All source text and alternatives remain in programMetadata; draft placement is not a degree audit.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import math
import os
from functools import lru_cache
from concurrent.futures import ProcessPoolExecutor
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, urlencode
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import psycopg
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "data/sjsu/2026-2027/programs"
YEAR = "2026-2027"

def text(node):
    value = node.get_text(" ", strip=True) if hasattr(node, "get_text") else str(node)
    for bad, good in {"â€™": "’", "â€“": "–", "â€”": "—", "â€œ": "“", "â€\u009d": "”", "Â": ""}.items():
        value = value.replace(bad, good)
    return re.sub(r"\s+", " ", value.replace("\ufffd", " ")).strip()

def slug(title):
    aliases = {"Computer Engineering, BS": "computer-engineering", "Software Engineering, BS": "software-engineering"}
    base = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()).strip("-")
    return aliases.get(title) or (base if len(base) <= 105 else base[:95].rstrip("-") + "-" + hashlib.sha256(title.encode()).hexdigest()[:8])

def kind(title):
    if re.search(r"\bminor\b", title, re.I): return "minor"
    if re.search(r"\bcertificate\b", title, re.I): return "certificate"
    if re.search(r"credential|authorization", title, re.I): return "credential"
    if "+" in title or "SAGE" in title: return "combined"
    if re.search(r",\s*(PhD|EdD|DNP|OTD|AUD|AuD)\b", title): return "doctoral"
    if re.search(r",\s*M[A-Za-z]{1,4}\b", title): return "master"
    if re.search(r",\s*B[A-Z]{1,3}\b|\bADN to BSN\b", title): return "bachelor"
    return "other"

def units(value):
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:[-–]\s*\d+(?:\.\d+)?)?\s*unit", value, re.I)
    return float(match[1]) if match else 0

def conditional_dependency(value):
    condition = re.sub(r"\bor\s+(?:better|higher|above)\b", "", value or "", flags=re.I)
    return bool(re.search(r"\bor\b|\beither\b|consent|permission|placement|eligib", condition, re.I))

def course_links(node):
    result = {}
    for a in node.select('a[onclick*="showCourse"],a[href*="preview_course"],a[onclick*="showCatalogData"]'):
        match = re.match(r"([A-Z][A-Z0-9 &/-]*?\s+\d+[A-Z]*)\s*[-–]\s*(.+)", text(a))
        bare = re.fullmatch(r"([A-Z][A-Z0-9 &/-]*?\s+\d+[A-Z]*)", text(a)) if not match else None
        if not match and not bare: continue
        code = re.sub(r"\s+", " ", (match or bare)[1])
        coid = re.search(r"showCourse\(['\"]\d+['\"],\s*['\"](\d+)", a.get("onclick", ""))
        course_id = coid[1] if coid else parse_qs(urlsplit(a.get("href", "")).query).get("coid", [None])[0]
        row = a.find_parent("li") or a.parent
        result[code] = {"code": code, "title": match[2] if match else code, "units": units(text(row)), "coid": course_id}
    return list(result.values())

def sections(soup):
    records = []
    ancestors = {}
    cores = []
    for heading in soup.select(".block_content h2, .block_content h3, .block_content h4, .block_content h5"):
        if "acalog-core" in heading.parent.get("class", []):
            cores.append(heading.parent)
            continue
        # Some programs publish their requirements in prose rather than acalog-core blocks.
        core = soup.new_tag("div")
        core["data-narrative"] = "true"
        core.append(copy.copy(heading))
        for sibling in heading.next_siblings:
            if getattr(sibling, "name", None) in ["h2", "h3", "h4", "h5"] or (getattr(sibling, "name", None) and sibling.find(["h2", "h3", "h4", "h5"])):
                break
            core.append(copy.copy(sibling))
        cores.append(core)
    for core in cores:
        heading = core.find(["h2", "h3", "h4", "h5"], recursive=False)
        if not heading: continue
        title = text(heading)
        courses = course_links(core)
        intro = " ".join(text(p) for p in core.find_all("p", recursive=False))
        own_choice = bool(re.search(r"\b(?:choose|select|one of|either|alternative|substitution|complete (?:one|two|three|four|\d+))\b|electives?|\boption\s+[A-Z]\b|\bplan\s+[AB]\b", title + " " + intro, re.I))
        level = int(heading.name[1])
        ancestors = {depth:index for depth,index in ancestors.items() if depth < level}
        if ancestors: records[max(ancestors.values())]["hasChildren"] = True
        inherited = next((records[index]["choiceRoot"] for depth,index in sorted(ancestors.items()) if records[index]["choice"]), None)
        root = inherited if inherited is not None else len(records)
        ancestors[level] = len(records)
        rows = [{"text": text(li), "courses": course_links(li)} for listing in core.find_all(["ul", "ol"], recursive=False) for li in listing.find_all("li", recursive=False)]
        if not rows:
            rows = [{"text": text(p), "courses": course_links(p)} for p in core.find_all("p", recursive=False) if course_links(p)]
        records.append({"title": title, "text": text(core), "courses": courses,
                        **({"narrative": True} if core.get("data-narrative") else {}),
                        "units": units(title), "choice": own_choice or inherited is not None, "choiceRoot": root, "hasChildren": False, "rows": rows})
    for i, record in enumerate(records):
        root = record["choiceRoot"]
        if record["choice"] and root != i:
            parent = records[root]
            parent["courses"] = list({c["code"]: c for c in parent["courses"] + record["courses"]}.values())
            parent["text"] += " " + record["text"]
    return records

def section_items(records, prefix):
    result, seen = [], set()
    structured_codes = {c["code"] for r in records if not r.get("narrative") for c in r["courses"]}
    for index, record in enumerate(records):
        if re.search(r"admission|advancement to candidacy", record["title"], re.I): continue
        if structured_codes and record.get("narrative") and all(c["code"] in structured_codes for c in record["courses"]): continue
        if record.get("choiceRoot", index) != index and record["choice"]: continue
        if not record["courses"]:
            if not record.get("hasChildren") and re.search(r"requirements?|courses?|electives?|curriculum|program of study|culminating", record["title"], re.I) and not re.search(r"^(?:total|summary|university graduation|admission)", record["title"], re.I):
                result.append({"id": f"{prefix}-choice-{index}", "type": "placeholder", "label": record["title"], "description": record["text"]})
            continue
        if record["choice"]:
            result.append({"id": f"{prefix}-choice-{index}", "type": "placeholder", "label": record["title"], "description": record["text"]})
            continue
        for row_index, row in enumerate(record.get("rows", [])):
            choices = row["courses"]
            if (len(choices) > 1 and re.search(r"\b(?:OR|either)\b", row["text"], re.I)) or re.match(r"(?:GE |General [Ee]ducation|University elective|Technical elective)", row["text"]) or "recommend" in row["text"].lower() or not choices:
                if units(row["text"]) or choices:
                    result.append({"id": f"{prefix}-choice-{index}-{row_index}", "type": "placeholder", "label": row["text"][:100], "description": row["text"]})
                continue
            for course in choices:
                if course["code"] in seen: continue
                seen.add(course["code"])
                result.append({"id": f"{prefix}-{course['coid'] or slug(course['code'])}", "type": "course", "code": course["code"]})
    return result

def parse_page(path, title, prefix):
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "lxml")
    content = soup.select_one(".block_content")
    if content is None or content.find("h1") is None: raise ValueError(f"Missing program: {path}")
    if text(content.find("h1")) != title: raise ValueError(f"Program title mismatch: {path}")
    records = sections(soup)
    full_text = text(content)
    first = text(content.select_one(".acalog-core")) if content.select_one(".acalog-core") else ""
    lead = full_text[full_text.find(title)+len(title):].split(first, 1)[0] if first else full_text
    if lead.strip(): records.append({"title": "Program information and conditions", "text": lead.strip(), "courses": [], "units": 0, "choice": False, "rows": []})
    items = section_items(records, prefix)
    courses = {c["code"]: c for r in records for c in r["courses"]}
    return records, items, courses

@lru_cache(maxsize=None)
def course_facts(coid):
    if not globals().get("_IGNORE_FACTS_CACHE"):
        global _FACTS
        if "_FACTS" not in globals():
            cache = DIRECTORY / "course-facts.json"
            _FACTS = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else {}
        if str(coid) in _FACTS: return _FACTS[str(coid)]
    path = DIRECTORY / "courses" / f"{coid}.html"
    if not path.exists(): return {}
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "lxml")
    content = soup.select_one(".block_content")
    if content is None: return {}
    full = text(content)
    prereq = re.search(r"(?:Prerequisite\(s\)|Prerequisites?):\s*(.*?)(?=(?:Corequisite|Pre/Corequisite|Grading|Course Repeatability|Satisfies|Class Schedule|Notes?:)|$)", full)
    coreq = re.search(r"(?:Corequisite\(s\)|Corequisites?):\s*(.*?)(?=(?:Prerequisite|Grading|Course Repeatability|Satisfies|Class Schedule|Notes?:)|$)", full)
    codes = lambda value: sorted(set(re.findall(r"\b[A-Z][A-Z0-9]{1,7}\s+\d{1,3}[A-Z]{0,3}\b", value)))
    heading = content.find("h1")
    after = full[full.find(text(heading))+len(text(heading)):] if heading else full
    description = re.split(r"Prerequisite|Corequisite|Grading:|Class Schedule", after)[0].strip()
    course_title = re.match(r"^[A-Z][A-Z0-9 &/-]*?\s+\d+[A-Z]*\s*[-?]\s*(.+)", text(heading)) if heading else None
    amount = re.match(r"(\d+(?:\.\d+)?(?:\s*[-?]\s*\d+(?:\.\d+)?)?)\s*unit", after.strip())
    return {**({"title": course_title[1]} if course_title else {}), **({"units": float(re.match(r"\d+(?:\.\d+)?", amount[1])[0]), "unitsText": amount[1]} if amount else {}), "description": description, "prerequisiteText": prereq[1].strip() if prereq else "No prerequisite conditions are listed on the captured course page.",
            "corequisiteText": coreq[1].strip() if coreq else "",
            "corequisiteManualReview": bool(coreq and conditional_dependency(coreq[1])),
            "prerequisiteCodes": codes(prereq[1]) if prereq else [], "corequisiteCodes": codes(coreq[1]) if coreq else [],
            "prerequisiteManualReview": bool(prereq and conditional_dependency(prereq[1])),
            "sourceUrl": f"https://catalog.sjsu.edu/preview_course_nopop.php?catoid=23&coid={coid}"}

@lru_cache(maxsize=1)
def roadmap_index():
    roadmaps = json.loads((DIRECTORY / "roadmaps-raw.json").read_text(encoding="utf-8")) if (DIRECTORY / "roadmaps-raw.json").exists() else []
    return {text(r["title"]).removeprefix("Roadmap: "): r for r in roadmaps}

def normalize_one(entry):
    roadmap_by_title = roadmap_index()
    title = text(entry["title"])
    if kind(title) == "other": return None
    poid = parse_qs(urlsplit(entry["url"]).query)["poid"][0]
    path = DIRECTORY / "sources" / f"{poid}.html"
    if not path.exists(): return {"missing": entry}
    key = slug(title)
    records, items, courses = parse_page(path, title, key)
    roadmap, sequence = [], "draft"
    source = roadmap_by_title.get(title)
    if source:
        roadmap_id = parse_qs(urlsplit(source["url"]).query)["poid"][0]
        roadmap_path = DIRECTORY / "sources" / f"roadmap-{roadmap_id}.html"
        if roadmap_path.exists():
            rsoup = BeautifulSoup(roadmap_path.read_text(encoding="utf-8"), "lxml")
            for i, core in enumerate(rsoup.select(".block_content .acalog-core")):
                heading = core.find(["h2", "h3", "h4"], recursive=False)
                if not heading or not re.search(r"semester\s*\d|(?:fall|spring)\s*(?:semester|20\d\d)|(?:first|second|third|fourth|fifth|sixth|seventh|eighth) semester", text(heading), re.I): continue
                rrecords = sections(BeautifulSoup('<td class="block_content">'+str(core)+'</td>', 'html.parser'))
                options = course_links(core)
                courses.update({c["code"]: c for c in options})
                ritems = section_items(rrecords, key+f"-term-{i}")
                if ritems: roadmap.append({"id": f"semester-{len(roadmap)+1}", "title": text(heading), "description": text(core), "items": ritems})
            if roadmap: sequence = "official"
    for c in courses.values():
        c.update(course_facts(c["coid"]))
        for field in ["prerequisite", "corequisite"]:
            c[field+"ManualReview"] = conditional_dependency(c.get(field+"Text"))
    if not roadmap:
        if not items:
            items = [{"id": key+"-advisor-approved-requirements", "type": "placeholder", "label": "Advisor-approved program requirements", "description": "This catalog entry does not publish a fixed course sequence. Review the official program information and confirm an individual program of study with the department."}]
        count = {"bachelor": 8, "combined": 10, "master": 4, "doctoral": 6}.get(kind(title), 2)
        groups = [[] for _ in range(count)]
        # Preserve source order, distribute source-listed requirements, and label the result draft.
        # Prerequisite-aware refinement happens after course catalog enrichment.
        for i, item in enumerate(items): groups[min(count-1, i * count // max(1,len(items)))].append(item)
        roadmap = [{"id": f"semester-{i+1}", "title": f"Suggested semester {i+1}", "description": "Draft sequence from official requirements; verify prerequisites, availability and advisor approval.", "items": group} for i,group in enumerate(groups)]
    seen = set()
    for g in roadmap:
        for item in g["items"]:
            code = item.get("code")
            if code in seen:
                item.pop("code")
                item.update(type="placeholder", label=f"Repeat: {code}", description=f"{courses[code]['units']} units. Repeated enrollment in {code}; verify repeat-credit limits and required number of terms.")
            if code: seen.add(code)
    return {"slug": key, "title": title, "kind": kind(title), "sourceUrl": entry["url"], "sourceId": poid,
                     "catalogYear": YEAR, "sequenceKind": sequence, "roadmapUrl": source["url"] if source and sequence=="official" else None,
                     "sections": records, "courses": list(courses.values()), "groups": roadmap,
                     "technicalCodes": sorted({c["code"] for r in records if re.search(r"technical.*elective", r["title"], re.I) for c in r["courses"]}),
                     "hash": hashlib.sha256(b"prerequisites-v3" + path.read_bytes() + json.dumps(roadmap,sort_keys=True).encode() + json.dumps(records,sort_keys=True).encode() + json.dumps(list(courses.values()),sort_keys=True).encode()).hexdigest()}

def normalize():
    entries = json.loads((DIRECTORY / "directory-raw.json").read_text(encoding="utf-8"))
    programs, missing = [], []
    with ProcessPoolExecutor(max_workers=4) as pool:
        for index, record in enumerate(pool.map(normalize_one, entries)):
            if record and "missing" in record: missing.append(record["missing"])
            elif record: programs.append(record)
            if index and index % 50 == 0: print(f"Normalized {index}/{len(entries)}", flush=True)
    if len({p["slug"] for p in programs}) != len(programs): raise ValueError("Duplicate program slugs")
    result = {"catalogYear": YEAR, "fetchedAt": datetime.now(timezone.utc).isoformat(), "programs": programs, "missing": missing}
    (DIRECTORY / "normalized.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result

def publish(result):
    load_dotenv(ROOT / "api/.env")
    parts = urlsplit(os.environ["DATABASE_URL"])
    url = parts._replace(query=urlencode({k:v[-1] for k,v in parse_qs(parts.query).items() if k != "schema"})).geturl()
    with psycopg.connect(url) as conn:
        conn.execute("SELECT pg_advisory_xact_lock(hashtext('sjsu-program-import'))")
        known = {}
        for course_id, code in conn.execute('SELECT id,code FROM "Course" ORDER BY CASE WHEN id LIKE \'ce-%\' THEN 0 WHEN id LIKE \'se-%\' THEN 1 ELSE 2 END,id'):
            known.setdefault(code, course_id)
        facts = {c["code"]: c for program in result["programs"] for c in program["courses"]}
        for c in facts.values():
            course_id = known.setdefault(c["code"], "sjsu-" + slug(c["code"]))
            conn.execute('INSERT INTO "Course" (id,code) VALUES (%s,%s) ON CONFLICT (id) DO NOTHING', (course_id,c["code"]))
            if not c.get("sourceUrl"): continue
            conn.execute('''INSERT INTO "UniversityCourseRecord" ("courseId","catalogYear",title,units,"unitsText",description,"prerequisiteText","corequisiteText","prerequisiteCodes","corequisiteCodes","sourceUrl","catalogStatus","fetchedAt")
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'retrieved',now())
                ON CONFLICT ("courseId","catalogYear") DO UPDATE SET title=EXCLUDED.title,units=EXCLUDED.units,"unitsText"=EXCLUDED."unitsText",description=EXCLUDED.description,"prerequisiteText"=EXCLUDED."prerequisiteText","corequisiteText"=EXCLUDED."corequisiteText","prerequisiteCodes"=EXCLUDED."prerequisiteCodes","corequisiteCodes"=EXCLUDED."corequisiteCodes","sourceUrl"=EXCLUDED."sourceUrl","catalogStatus"=EXCLUDED."catalogStatus","fetchedAt"=EXCLUDED."fetchedAt"''',
                (course_id,YEAR,c["title"],c["units"],c.get("unitsText",str(c["units"])),c["description"],c["prerequisiteText"],c.get("corequisiteText"),c.get("prerequisiteCodes",[]),c.get("corequisiteCodes",[]),c["sourceUrl"]))
        for p in result["programs"]:
            program_id = "catalog-"+p["sourceId"]
            conn.execute('INSERT INTO "Program" (id,slug,name,abbreviation) VALUES (%s,%s,%s,%s) ON CONFLICT (slug) DO NOTHING', (program_id,p["slug"],p["title"],(re.search(r"\b(?:BS|BA|BFA|BM|MS|MA|MFA|MBA|MPA|MPH|MUP|MSW|MARA|AUD|DNP|OTD|EdD|PhD)\b",p["title"]) or [p["kind"]])[0]))
            program_id = conn.execute('SELECT id FROM "Program" WHERE slug=%s',(p["slug"],)).fetchone()[0]
            # Existing approved CE/SE semester roadmaps keep their identities and layout.
            if p["slug"] in {"computer-engineering","software-engineering"}: continue
            existing = conn.execute('SELECT "dataVersion" FROM "CatalogVersion" WHERE "programId"=%s AND "catalogYear"=%s', (program_id, YEAR)).fetchone()
            if existing and existing[0] == "programs-v2-"+p["hash"][:16]: continue
            version_id = f"catalog-{p['sourceId']}-{YEAR}"
            for c in p["courses"]:
                course_id = known.setdefault(c["code"],"sjsu-"+slug(c["code"]))
                conn.execute('INSERT INTO "Course" (id,code) VALUES (%s,%s) ON CONFLICT (id) DO NOTHING',(course_id,c["code"]))
            metadata = {k:p[k] for k in ["title","kind","sequenceKind","roadmapUrl","sections","technicalCodes"]}
            conn.execute('INSERT INTO "CatalogVersion" (id,"programId","catalogYear","dataVersion","sourceUrl","lastVerifiedAt","semesterCount","programMetadata") VALUES (%s,%s,%s,%s,%s,now(),%s,%s) ON CONFLICT ("programId","catalogYear") DO UPDATE SET "dataVersion"=EXCLUDED."dataVersion","sourceUrl"=EXCLUDED."sourceUrl","lastVerifiedAt"=EXCLUDED."lastVerifiedAt","semesterCount"=EXCLUDED."semesterCount","programMetadata"=EXCLUDED."programMetadata"', (version_id,program_id,YEAR,"programs-v2-"+p["hash"][:16],p["sourceUrl"],len(p["groups"]),Jsonb(metadata)))
            version_id = conn.execute('SELECT id FROM "CatalogVersion" WHERE "programId"=%s AND "catalogYear"=%s',(program_id,YEAR)).fetchone()[0]
            versions = {}
            for c in p["courses"]:
                cv_id = f"{version_id}:{slug(c['code'])}"
                versions[c["code"]] = cv_id
                conn.execute('INSERT INTO "CourseVersion" (id,"courseId","catalogVersionId",title,description,units,"prerequisiteText") VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT ("courseId","catalogVersionId") DO UPDATE SET title=EXCLUDED.title,units=EXCLUDED.units,description=EXCLUDED.description,"prerequisiteText"=EXCLUDED."prerequisiteText"', (cv_id,known[c["code"]],version_id,c["title"],c.get("description", "Listed in the official program requirements. See the source for full course conditions."),c["units"]," ".join([c.get("prerequisiteText", "Prerequisite details have not yet been verified for this program; check the official catalog."), ("Corequisites: "+c["corequisiteText"]) if c.get("corequisiteText") else ""]).strip()))
                versions[c["code"]] = conn.execute('SELECT id FROM "CourseVersion" WHERE "courseId"=%s AND "catalogVersionId"=%s',(known[c["code"]],version_id)).fetchone()[0]
            for c in p["courses"]:
                cv_id = versions[c["code"]]
                conn.execute('DELETE FROM "PrerequisiteRule" WHERE "courseVersionId"=%s',(cv_id,))
                for field,corequisite in [("prerequisiteCodes",False),("corequisiteCodes",True)]:
                    if conditional_dependency(c.get("corequisiteText" if corequisite else "prerequisiteText")): continue
                    for code in c.get(field,[]):
                        if code not in known or code == c["code"]: continue
                        conn.execute('''INSERT INTO "PrerequisiteRule" (id,"courseVersionId","requiredCourseId","groupKey",operator,"isCorequisite","requiresManualReview") VALUES (%s,%s,%s,'catalog','AND',%s,false)''', (cv_id+":"+field+":"+known[code],cv_id,known[code],corequisite))
            # Only this import-owned catalog's requirement rows are rebuilt; personal state is untouched.
            conn.execute('DELETE FROM "ProgramRequirement" WHERE "requirementGroupId" IN (SELECT id FROM "RequirementGroup" WHERE "catalogVersionId"=%s)',(version_id,))
            conn.execute('DELETE FROM "RequirementGroup" WHERE "catalogVersionId"=%s',(version_id,))
            for index,g in enumerate(p["groups"]):
                gid=f"{version_id}:semester-{index+1}"
                conn.execute('INSERT INTO "RequirementGroup" (id,key,"catalogVersionId",title,description,"sortOrder") VALUES (%s,%s,%s,%s,%s,%s)',(gid,g["id"],version_id,g["title"],g["description"],index))
                for i,item in enumerate(g["items"]):
                    conn.execute('INSERT INTO "ProgramRequirement" (id,"sourceKey","requirementGroupId","itemType","courseVersionId",label,description,"recommendedSemester","sortOrder") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)',(f"{gid}:{i}",item["id"],gid,"COURSE" if item.get("code") else "PLACEHOLDER",versions.get(item.get("code")),item.get("label"),item.get("description"),index+1,i))
    print(f"Published {len(result['programs'])} programs; existing personal plans preserved.")

if __name__ == "__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--write-db",action="store_true");args=parser.parse_args()
    data=normalize();print(json.dumps({"programs":len(data["programs"]),"missing":len(data["missing"]),"official":sum(p["sequenceKind"]=="official" for p in data["programs"])}))
    if args.write_db:
        if data["missing"]: raise SystemExit("Incomplete source coverage; publication stopped.")
        publish(data)
