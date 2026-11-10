import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("sjsu_import", Path(__file__).parents[1] / "import_sjsu.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ImportTests(unittest.TestCase):
    def schedule(self, seats="12", class_number="12345"):
        cells = ["BUS1 20 (Section 01)", class_number, "Hybrid", "Accounting", "GE", "1-3", "LEC", "MW<br>F", "09:00AM-10:00AM<br>TBA", '<a href="mailto:a@sjsu.edu">Faculty A</a>', "BBC<br>ONLINE", "08/19/26-12/07/26", seats, "Requires consent"]
        return '<h1>Fall 2026 Class Schedule</h1><table><tr>' + ''.join('<td>' + c + '</td>' for c in cells) + '</tr></table>'

    def test_subject_digits_variable_units_and_meeting_alignment(self):
        row = module.parse_schedule(self.schedule(), "fall-2026", "https://www.sjsu.edu/schedule")[0]
        self.assertEqual(row["courseCode"], "BUS1 20")
        self.assertEqual(row["days"], "MW / F")
        self.assertEqual(row["times"], "09:00AM-10:00AM / TBA")
        self.assertEqual(row["instructors"], ["Faculty A"])
        self.assertEqual(row["unitsText"], "1-3")
        self.assertIsNone(row["units"])

    def test_unknown_seats_are_not_zero(self):
        row = module.parse_schedule(self.schedule(seats="TBA"), "fall-2026", "https://www.sjsu.edu/")[0]
        self.assertIsNone(row["openSeats"])

    def test_repeated_source_listing_is_preserved_without_duplicate_identity(self):
        html = self.schedule()
        duplicate = html[html.index("<tr>"):html.index("</tr>") + 5]
        rows = module.parse_schedule(html.replace("</table>", duplicate + "</table>"), "fall-2026", "https://www.sjsu.edu/")
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(rows[0]["additionalListings"]), 1)

    def test_official_short_section_label(self):
        html = self.schedule().replace("BUS1 20 (Section 01)", "BUS1 20Sec 01")
        row = module.parse_schedule(html, "fall-2026", "https://www.sjsu.edu/")[0]
        self.assertEqual(row["sectionNumber"], "01")
        self.assertEqual(module.code("ISDA 080"), "ISDA 80")

    def test_wrong_term_or_malformed_class_fails_closed(self):
        with self.assertRaises(ValueError):
            module.parse_schedule(self.schedule(), "spring-2027", "https://www.sjsu.edu/")
        with self.assertRaises(ValueError):
            module.parse_schedule(self.schedule(class_number="broken"), "fall-2026", "https://www.sjsu.edu/")

    def test_catalog_preserves_alternative_prerequisites(self):
        html = '''<h1 id="course_preview_title">CMPE 131 - Software Engineering I</h1><hr>
        <em>3</em> <em>unit(s)</em><br>Software lifecycle.<br><br>
        <strong>Prerequisite(s):</strong> <a href="preview_course_nopop.php?catoid=23&coid=1">CMPE 50</a>
        or <a href="preview_course_nopop.php?catoid=23&coid=2">CS 46B</a> (C- or better).
        <br><strong>Grading:</strong> Letter Graded'''
        row = module.parse_catalog(html, "https://catalog.sjsu.edu/preview_course_nopop.php?catoid=23&coid=3")
        self.assertEqual(row["description"], "Software lifecycle.")
        self.assertIn("or", row["prerequisiteText"])
        self.assertEqual(row["prerequisiteCodes"], ["CMPE 50", "CS 46B"])
        self.assertEqual(row["units"], 3)

    def test_ischool_leaves_unpublished_fields_unknown(self):
        html = '<h1>Spring 2027 MLIS Schedule</h1><table><tr><td>Info200-01</td><td>Communities</td><td>20812</td><td>Liu, Z.</td><td>See notes</td><td>Special dates</td></tr></table>'
        row = module.parse_ischool(html, "spring-2027", "https://ischoolapps.sjsu.edu/")[0]
        self.assertEqual(row["courseCode"], "INFO 200")
        self.assertIsNone(row["openSeats"])
        self.assertEqual(row["component"], "")
        self.assertEqual(row["mandatoryZoom"], "See notes")


if __name__ == "__main__":
    unittest.main()
