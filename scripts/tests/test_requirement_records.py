import copy
import unittest

from scripts.requirement_records import validate_record

SHA = "b" * 64
CAPTURE = ("Program Electives (6 units) Choose two: TEST 101 - Intro 3 unit(s) TEST 102 - Lab 3 unit(s) "
           "Graduate courses may substitute (except TEST 201 , TEST 202 ). Department page: minimum GPA 3.0.")
CHECKED = {"status": "extracted", "checked_at": None, "checked_by": None}


def course(code, refs=("catalog",)):
    return {"code": code, "term_id": None, "section_numbers": None, "topic": None, "condition_refs": [], "source_refs": list(refs)}


def record(includes, exclusions=(), quote=CAPTURE):
    return {
        "sources": [{"key": "catalog", "quote": quote, "url": "https://catalog.sjsu.edu/x", "document_date": None,
                     "retrieved_at": "2026-11-08T14:23:30Z", "sha256": SHA, "locator": "Program Electives", "verification": CHECKED}],
        "conditions": [], "aliases": [], "coverage_source_refs": ["catalog"], "catalog_list_coverage": "complete",
        "applicability": {"pattern": "unspecified", "condition_refs": [], "program_effects": []},
        "rule": {"key": "electives", "kind": "choose_courses", "count": 2, "text": "Choose two.", "condition_refs": [], "source_refs": ["catalog"],
                 "includes": [course(code) for code in includes], "exclusions": [course(code) for code in exclusions]},
    }


class RequirementRecordChecks(unittest.TestCase):
    def check(self, item):
        return validate_record(item, {SHA: CAPTURE}, {"TEST 101", "TEST 102", "TEST 201", "TEST 202"})

    def test_clean_record_passes(self):
        errors, warnings = self.check(record(["TEST 101", "TEST 102"], ["TEST 201", "TEST 202"]))
        self.assertEqual((errors, warnings), ([], []))

    def test_course_from_exclusion_clause_is_never_an_inclusion(self):
        errors, _ = self.check(record(["TEST 101", "TEST 201"]))
        self.assertTrue(any("TEST 201" in error for error in errors), errors)

    def test_positive_course_is_not_accepted_as_exclusion(self):
        errors, _ = self.check(record(["TEST 102"], ["TEST 101"]))
        self.assertTrue(any("TEST 101" in error for error in errors), errors)

    def test_quote_must_be_verbatim_in_capture(self):
        errors, _ = self.check(record(["TEST 101"], quote="Choose two: TEST 101 - Intro 3 unit(s) TEST 103"))
        self.assertTrue(any("verbatim" in error for error in errors), errors)

    def test_unknown_course_is_flagged(self):
        _, warnings = validate_record(record(["TEST 101"]), {SHA: CAPTURE}, {"TEST 102"})
        self.assertTrue(any("TEST 101" in warning for warning in warnings), warnings)

    def test_conflicts_need_distinct_sourced_values(self):
        item = record(["TEST 101"])
        item["review_conflicts"] = [{"field": "minimum_gpa", "alternatives": [{"value": "3.0", "source_ref": "catalog"},
                                                                              {"value": "3.0", "source_ref": "missing"}]}]
        errors, _ = self.check(item)
        self.assertIn("minimum_gpa: missing distinct conflicting values", errors)
        self.assertIn("unresolved conflict source: missing", errors)

    def test_complete_coverage_requires_evidence(self):
        item = copy.deepcopy(record(["TEST 101"]))
        item["coverage_source_refs"] = []
        self.assertIn("complete coverage requires source evidence", self.check(item)[0])


if __name__ == "__main__":
    unittest.main()
