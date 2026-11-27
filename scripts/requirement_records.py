"""Validate captured requirement records and publish a read-only API snapshot."""

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

from bs4 import BeautifulSoup
from jsonschema import Draft202012Validator, FormatChecker

from scripts.import_sjsu_programs import DIRECTORY, ROOT, YEAR, course_quote_roles, parse_page, text


DATA = ROOT / "api/prisma/data/requirements" / YEAR
SCHEMA = ROOT / "scripts/schemas/requirement-record.schema.json"
SNAPSHOT = DATA / "checked.json"
SLUGS = {
    "computer-engineering", "software-engineering", "electrical-engineering-bs",
    "mechanical-engineering-bs", "civil-engineering-bs", "aerospace-engineering-bs",
    "nursing-bs", "business-administration-general-business-concentration-bs",
    "business-administration-finance-concentration-bs",
    "business-administration-accounting-concentration-bs",
}
CROSS_LIST = re.compile(r"\b([A-Z][A-Z0-9]{1,7}(?:\s*/\s*[A-Z][A-Z0-9]{1,7})+)\s+(\d{1,3}[A-Z]{0,3})\b")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def expand_cross_lists(quote):
    return CROSS_LIST.sub(lambda match: " / ".join(
        f"{prefix.strip()} {match[2]}" for prefix in match[1].split("/")
    ), quote)


def keyed(items):
    result = {item["key"]: item for item in items}
    if len(result) != len(items):
        raise ValueError("duplicate source or condition key")
    return result


def validate_record(record, captures, known_codes):
    sources, conditions = keyed(record["sources"]), keyed(record["conditions"])
    errors, warnings = [], []
    seen_nodes = set()

    def refs(item):
        for field, keys in (("condition_refs", conditions), ("source_refs", sources)):
            for key in item.get(field, ()):
                if key not in keys:
                    errors.append(f"unresolved {field}: {key}")
        if "source_refs" in item and not item["source_refs"]:
            errors.append("missing source reference")

    def walk(rule):
        refs(rule)
        if rule["key"] in seen_nodes:
            errors.append(f"duplicate rule key: {rule['key']}")
        seen_nodes.add(rule["key"])
        for branch in rule.get("children", ()):
            walk(branch)
        includes = rule.get("includes", ())
        exclusions = rule.get("exclusions", ())
        for entry in (*includes, *exclusions):
            refs(entry)
            retirement = "excluded" if entry in exclusions else "positive"
            code = entry["code"]
            roles = [course_quote_roles(code, expand_cross_lists(sources[key]["quote"] or ""))
                     for key in entry["source_refs"] if key in sources]
            if {retirement} not in roles or (retirement == "positive" and any("excluded" in role for role in roles)):
                errors.append(f"{code}: no unambiguous {retirement} course evidence for {rule['key']}")
            if code not in known_codes:
                warnings.append(f"{code}: missing from captured catalog facts")
        for include in includes:
            for exclude in exclusions:
                if include["code"] != exclude["code"]:
                    continue
                if any(include[field] and exclude[field] and include[field] != exclude[field]
                       for field in ("term_id", "topic")):
                    continue
                if include["section_numbers"] and exclude["section_numbers"] and not (
                    set(include["section_numbers"]) & set(exclude["section_numbers"])
                ):
                    continue
                errors.append(f"{include['code']}: overlapping inclusion and exclusion in {rule['key']}")

    for source in sources.values():
        capture = captures.get(source["sha256"])
        if not all(source[field] for field in ("quote", "url", "retrieved_at", "locator")):
            errors.append(f"{source['key']}: missing source capture metadata")
        elif capture is None:
            errors.append(f"{source['key']}: capture bytes do not match any saved source")
        elif text(source["quote"]) not in capture:
            errors.append(f"{source['key']}: quotation not found verbatim in captured source")

    refs(record["applicability"])
    for item in (*record["conditions"], *record["aliases"], *record["applicability"]["program_effects"]):
        refs(item)
    for key in record["coverage_source_refs"]:
        if key not in sources:
            errors.append(f"unresolved coverage source: {key}")
    if record["catalog_list_coverage"] == "complete" and not record["coverage_source_refs"]:
        errors.append("complete coverage requires source evidence")
    for conflict in record.get("review_conflicts", ()):
        if len({item["value"] for item in conflict["alternatives"]}) < 2:
            errors.append(f"{conflict['field']}: missing distinct conflicting values")
        for item in conflict["alternatives"]:
            if item["source_ref"] not in sources:
                errors.append(f"unresolved conflict source: {item['source_ref']}")
    walk(record["rule"])
    return sorted(set(errors)), sorted(set(warnings))


def catalog_corrections(programs):
    """Only replace field values where the saved source and imported section agree."""
    corrections = {}
    for program in programs:
        slug = program["slug"]
        if slug not in SLUGS:
            continue
        source = DIRECTORY / "sources" / f"{program['sourceId']}.html"
        sections, _, _ = parse_page(source, program["title"], slug)
        before = program["sections"]
        if len(sections) != len(before):
            raise ValueError(f"{slug}: unmapped catalog sections")
        replacements = []
        for old, new in zip(before, sections):
            if (new["title"], new["text"]) != (old["title"], old["text"]):
                raise ValueError(f"{slug}: section evidence changed during reparsing")
            removed = sorted({row["code"] for row in old["courses"]} - {row["code"] for row in new["courses"]})
            if removed or old["choice"] != new["choice"]:
                replacements.append({"title": old["title"], "text": old["text"], "removed": removed,
                                     "disableChoice": old["choice"] and not new["choice"]})
        if replacements:
            corrections[slug] = {"sourceUrl": program["sourceUrl"], "sections": replacements}
    return corrections


def capture_hashes(records):
    return {source["sha256"] for record in records for source in record["sources"]}


def check_tracked_captures(records):
    directory = (DIRECTORY / "sources").relative_to(ROOT)
    tracked = subprocess.check_output(["git", "ls-files", "-z", "--", directory.as_posix()], cwd=ROOT)
    indexed = {}
    for path in sorted(set(tracked.decode("utf-8").split("\0")) - {""}):
        if not path.endswith(".html"):
            continue
        raw = subprocess.check_output(["git", "show", f":{path}"], cwd=ROOT)
        indexed[path] = hashlib.sha256(raw).hexdigest()
    hashes = capture_hashes(records)
    missing = hashes - set(indexed.values())
    if missing:
        missing_urls = sorted({source["url"] for record in records for source in record["sources"]
                               if source["sha256"] in missing})
        raise ValueError("Cited captures missing from the Git index: " + ", ".join(missing_urls))
    extra = sorted(path for path, digest in indexed.items() if digest not in hashes)
    if extra:
        raise ValueError("Tracked captures without a record citation: " + ", ".join(extra))
    return len(indexed)


def capture_index(records):
    hashes = capture_hashes(records)
    captures = {}
    for path in (DIRECTORY / "sources").glob("*.html"):
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if digest in hashes:
            soup = BeautifulSoup(raw.decode("utf-8"), "lxml")
            for element in soup.select("script,style"):
                element.decompose()
            captures[digest] = text(soup)
    return captures


def publish(records, corrections):
    body = {"catalogYear": YEAR, "records": records, "catalogCorrections": corrections}
    body["revision"] = hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
    temporary = SNAPSHOT.with_suffix(".tmp")
    temporary.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(SNAPSHOT)


def review(records, findings):
    fields = ["Program", "Requirement", "Kind", "Included courses", "Excluded courses",
              "Conditions", "Official sources and capture dates", "Verbatim quotes", "Status", "Code check flags"]

    def codes(rule, field):
        return sorted({entry["code"] for entry in rule.get(field, ())} |
                      {code for child in rule.get("children", ()) for code in codes(child, field)})

    rows = []
    for record, flags in zip(records, findings):
        sources = record["sources"]
        rule = record["rule"]
        status = record["verification"]["status"] + (" / needs_review" if record.get("needs_review") else "")
        rows.append([
            record["program"] or "SJSU", record["title"], rule["kind"],
            ", ".join(codes(rule, "includes")), ", ".join(codes(rule, "exclusions")),
            " / ".join(condition["text"] for condition in record["conditions"]),
            " / ".join(f"{source['url']} (published {source['document_date'] or 'date unavailable'}, "
                       f"captured {(source['retrieved_at'] or 'date unavailable')[:10]})" for source in sources),
            " / ".join(source["quote"] or "" for source in sources), status, " / ".join(flags),
        ])
    base = ROOT / "tmp/requirement-review/REQUIREMENT_REVIEW_10_MAJORS"
    base.parent.mkdir(parents=True, exist_ok=True)
    with base.with_suffix(".csv").open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(fields)
        writer.writerows(rows)
    table = ["# Requirement review for ten majors", "", "| " + " | ".join(fields) + " |",
             "| " + " | ".join("---" for _ in fields) + " |"]
    for row in rows:
        table.append("| " + " | ".join(" ".join(value.split()).replace("|", "\\|") for value in row) + " |")
    base.with_suffix(".md").write_text("\n".join(table) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true", help="Write the checked snapshot and review files")
    parser.add_argument("--check-tracked", action="store_true", help="Check the published snapshot against the Git index")
    args = parser.parse_args()
    if args.check_tracked:
        records = read_json(SNAPSHOT)["records"]
        print(json.dumps({"records": len(records), "tracked_captures": check_tracked_captures(records)}))
        return
    validator = Draft202012Validator(read_json(SCHEMA), format_checker=FormatChecker())
    programs = read_json(DIRECTORY / "normalized.json")["programs"]
    records, findings, identities = [], [], set()
    for slug in sorted(SLUGS | {"campus"}):
        path = DATA / f"{slug}.json"
        if not path.exists():
            print(f"{slug}: missing record bundle")
            continue
        for record in read_json(path):
            validator.validate(record)
            if record["catalog_year"] != YEAR or record["program"] != (None if slug == "campus" else slug):
                raise ValueError(f"{path}: invalid record scope")
            identity = (slug, record["requirement_key"])
            if identity in identities:
                raise ValueError(f"duplicate record identity: {identity}")
            identities.add(identity)
            records.append(record)
    campus_ids = {f"campus:sjsu:{YEAR}:{record['requirement_key']}" for record in records if record["scope"] == "campus"}
    check_tracked_captures(records)
    captures = capture_index(records)
    known = {course["code"] for program in programs for course in program["courses"] if course.get("sourceUrl")}
    checked_at = datetime.now(timezone.utc).isoformat()
    for record in records:
        errors, warnings = validate_record(record, captures, known)
        errors += sorted({f"program effect targets unknown campus requirement: {effect['target_requirement_id']}"
                          for effect in record["applicability"]["program_effects"]
                          if effect["target_requirement_id"] and effect["target_requirement_id"] not in campus_ids})
        record["verification"] = {"status": "extracted", "checked_at": None, "checked_by": None}
        if not errors:
            record["verification"] = {"status": "code_checked", "checked_at": checked_at,
                                      "checked_by": "requirement-record-validation-v1"}
            validator.validate(record)
        findings.append(errors + warnings)
        if errors:
            print(f"{record['program'] or 'campus'}/{record['requirement_key']}: {'; '.join(errors)}")
    corrections = catalog_corrections(programs)
    if args.publish:
        publish(records, corrections)
        review(records, findings)
    print(json.dumps({
        "records": len(records),
        "code_checked": sum(record["verification"]["status"] == "code_checked" for record in records),
        "needs_review": sum(bool(record.get("needs_review")) for record in records),
        "planner_corrections": {program: len(value["sections"]) for program, value in corrections.items()},
    }))


if __name__ == "__main__":
    main()
