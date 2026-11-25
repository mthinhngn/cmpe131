"""Planner parity: live bootstrap API vs the pre-records baseline, allowing only published catalog corrections.

Usage: python -B -m scripts.planner_parity [--base http://localhost:5175/api/v1/bootstrap]
"""
import argparse
import json
import re
import unicodedata
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "tests/fixtures/planner-parity-2026-2027"
SNAPSHOT = ROOT / "api/prisma/data/requirements/2026-2027/checked.json"


def snapshot(base, slug):
    def get(path, **query):
        with urllib.request.urlopen(base + path + "?" + urllib.parse.urlencode(query), timeout=60) as response:
            return json.load(response)
    catalog = get("", program=slug)["catalog"]
    menu = get("/requirement-menu", program=slug)["requirements"]
    lists = {}
    for row in menu:
        data = get("/requirements", program=slug, requirement=row["id"])
        # Course order is not stable across database reads (CP1 finding); membership is what the Planner shows.
        lists[row["id"].split(":", 1)[1]] = {"status": data.get("status"), "codes": sorted(c["code"] for c in data.get("courses", []))}
    return {"requirementEvidence": [{"title": s.get("title"), "choice": s.get("choice"), "codes": [c["code"] for c in s.get("courses") or []]}
                                    for s in catalog.get("requirementEvidence", [])],
            "plannerCategories": {c["code"]: c.get("plannerCategory") for c in catalog["courses"]},
            "roadmapCourseIds": sorted(catalog["roadmapCourseIds"]), "menu": [r["label"] for r in menu], "lists": lists}


def slug_of(title):
    """Same normalization as requirementName() in api/src/graduation-requirements.ts."""
    value = unicodedata.normalize("NFKC", title).lower().replace("’", "").replace("'", "")
    return "-".join(re.sub(r"[^\w]+|_", " ", value).split())


def expected(before, corrections):
    """Apply the approved corrections to the baseline: removed codes leave the section, its list and its menu entry."""
    after = json.loads(json.dumps(before))
    by_title = {}
    for fix in corrections:
        by_title.setdefault(fix["title"], []).append(fix)
    for section in after["requirementEvidence"]:
        for fix in by_title.get(section["title"], []):
            section["codes"] = [code for code in section["codes"] if code not in fix["removed"]]
            if fix["disableChoice"]:
                section["choice"] = False
    for key, value in list(after["lists"].items()):
        for fix in corrections:
            if re.fullmatch(rf"catalog-choice-{re.escape(slug_of(fix['title']))}-\d+", key.split(":")[-1]):
                value["codes"] = [code for code in value["codes"] if code not in fix["removed"]]
                if fix["disableChoice"]:
                    del after["lists"][key]
                    after["menu"] = [label for label in after["menu"] if label != fix["title"]]
                elif not value["codes"]:
                    value["status"] = "open_rule"
    return after


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://localhost:5175/api/v1/bootstrap")
    args = parser.parse_args()
    corrections = json.loads(SNAPSHOT.read_text(encoding="utf-8"))["catalogCorrections"]
    failures = 0
    for path in sorted(BASELINE.glob("*.json")):
        slug = path.stem
        before = json.loads(path.read_text(encoding="utf-8"))
        for value in before["lists"].values():
            value["codes"] = sorted(value["codes"])
        want = expected(before, corrections.get(slug, {}).get("sections", []))
        got = snapshot(args.base, slug)
        diffs = [field for field in want if want[field] != got.get(field)]
        changed = before != want
        print(f"{slug}: {'FAIL ' + ', '.join(diffs) if diffs else 'PASS'}{' (approved catalog corrections applied)' if changed and not diffs else ''}")
        failures += bool(diffs)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
