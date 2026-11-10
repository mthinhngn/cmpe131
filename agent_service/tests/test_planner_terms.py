import unittest
from pydantic import ValidationError
from agent_service.contracts import BrowserContext
from agent_service.course_action_agent import valid_slot
from agent_service.interpretation import NumberedSemester


class PlannerTermsTests(unittest.TestCase):
    def test_sparse_and_empty_semesters(self):
        context = dict(program_id="computer-engineering", page="/planner", revision="v1",
                       semester_count=8, semester_slots=[1, 4, 8])
        BrowserContext.model_validate(context)
        self.assertTrue(valid_slot(4, context))
        self.assertFalse(valid_slot(3, context))
        self.assertTrue(valid_slot("winter-2027", context))
        self.assertTrue(valid_slot(3, {"semester_count": 8}))
        context.update(semester_count=0, semester_slots=[])
        BrowserContext.model_validate(context)
        self.assertFalse(valid_slot(1, context))

    def test_extended_number_boundary(self):
        NumberedSemester.model_validate(dict(kind="numbered_semester", number=100))
        with self.assertRaises(ValidationError):
            NumberedSemester.model_validate(dict(kind="numbered_semester", number=101))
