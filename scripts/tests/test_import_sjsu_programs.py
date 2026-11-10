import importlib.util
from pathlib import Path
import unittest
from bs4 import BeautifulSoup

spec = importlib.util.spec_from_file_location("program_import", Path(__file__).parents[1] / "import_sjsu_programs.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProgramImportTests(unittest.TestCase):
    def test_minimum_grade_or_better_is_not_a_course_alternative(self):
        self.assertFalse(module.conditional_dependency('EE 97 and EE 98 both with grades of C- or better. Allowed Declared Major: Electrical Engineering.'))
        self.assertTrue(module.conditional_dependency('EE 98 and MATH 33LA or MATH 33A (each with grade of C- or better).'))
        self.assertTrue(module.conditional_dependency('MATH 31 or instructor consent.'))

    def items(self, html):
        soup = BeautifulSoup('<div class="block_content">' + html + '</div>', 'html.parser')
        return module.section_items(module.sections(soup), 'test')

    def test_nested_track_options_stay_one_choice(self):
        html = '''<div class="acalog-core"><h2>Electives (6 units)</h2><p>Choose one track.</p></div>
        <div class="acalog-core"><h3>Track A</h3><ul><li><a href="preview_course.php?coid=1">ME 200 - Design</a> 3 units</li></ul></div>
        <div class="acalog-core"><h3>Track B</h3><ul><li><a href="preview_course.php?coid=2">ME 201 - Mechanics</a> 3 units</li></ul></div>'''
        items = self.items(html)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['type'], 'placeholder')
        self.assertIn('ME 200', items[0]['description'])
        self.assertIn('ME 201', items[0]['description'])

    def test_prose_ranges_and_advisor_requirements_are_not_dropped(self):
        items = self.items('''<div class="acalog-core"><h2>Minor Requirements (18 units)</h2></div>
          <div class="acalog-core"><h3>Lower Division Courses</h3><p>Complete 3-6 units of HIST 1 through HIST 99.</p></div>
          <div class="acalog-core"><h3>Upper Division Courses</h3><p>Complete 12-15 units of HIST 100 through HIST 199.</p></div>''')
        self.assertEqual(len(items), 2)
        self.assertTrue(all(i['type'] == 'placeholder' for i in items))
        self.assertIn('3-6', items[0]['description'])

    def test_or_row_is_not_two_mandatory_courses(self):
        items = self.items('''<div class="acalog-core"><h2>Core Requirements</h2><ul><li>
        <a href="preview_course.php?coid=1">ME 200 - Design</a> OR
        <a href="preview_course.php?coid=2">ME 201 - Mechanics</a> 3 units</li></ul></div>''')
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['type'], 'placeholder')

    def test_degree_kinds_and_legacy_ids(self):
        self.assertEqual(module.slug('Computer Engineering, BS'), 'computer-engineering')
        for title, kind in [('Design, MDes', 'master'), ('Audiology, AuD', 'doctoral'), ('Robotics Minor', 'minor'), ('Engineering Certificate', 'certificate')]:
            self.assertEqual(module.kind(title), kind)

    def test_requirements_outside_core_containers_are_captured(self):
        items = self.items('''<div class="program_description"><h2>Course Requirements</h2><p>Complete an advisor-approved program of 30 units.</p><h2>Additional Courses (2 units)</h2><ul><li><a href="preview_course.php?coid=3">EDTE 297B - Bilingual Education</a> 1 unit</li></ul></div>''')
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]['type'], 'placeholder')
        self.assertEqual(items[1]['code'], 'EDTE 297B')

    def test_narrative_overview_does_not_duplicate_structured_requirements(self):
        items = self.items('''<div><h2>Course Requirements</h2><p>Complete 30 units.</p></div>
          <div class="acalog-core"><h2>Core (3 units)</h2><ul><li><a href="preview_course.php?coid=1">ME 230 - Analysis</a> 3 units</li></ul></div>''')
        self.assertEqual([i.get('code') for i in items], ['ME 230'])

    def test_course_link_in_prose_is_captured(self):
        items = self.items('''<div><h2>Additional Courses (2 units)</h2><p><a href="preview_course.php?coid=3">EDTE 297B - Bilingual Education</a> 1 unit each semester.</p></div>''')
        self.assertEqual(items[0]['code'], 'EDTE 297B')

    def test_prose_summary_of_structured_choices_is_not_counted_twice(self):
        items = self.items('''<div><h2>Culminating Experience (Plan A or Plan B)</h2><p>Choose <a href="preview_course.php?coid=1">ME 299 - Thesis</a>.</p></div>
          <div class="acalog-core"><h2>Culminating Experience (6 units)</h2><p>Choose one.</p><ul><li><a href="preview_course.php?coid=1">ME 299 - Thesis</a> 6 units</li></ul></div>''')
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['label'], 'Culminating Experience (6 units)')


if __name__ == '__main__':
    unittest.main()
