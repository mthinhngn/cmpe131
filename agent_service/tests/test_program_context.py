import unittest
from pydantic import ValidationError
from agent_service.contracts import BrowserContext


class ProgramContextTests(unittest.TestCase):
    def context(self, **fields):
        return BrowserContext(program_id='mechanical-engineering-ms', page='/prerequisites', revision='v1', semester_count=4, **fields)

    def test_graduate_program_and_optional_minor_are_accepted(self):
        context = self.context(additional_program_ids=['robotics-minor'])
        self.assertEqual(context.program_id, 'mechanical-engineering-ms')
        self.assertEqual(context.additional_program_ids, ['robotics-minor'])

    def test_malformed_or_excessive_additional_programs_are_rejected(self):
        for programs in [['../forged'], ['robotics-minor'] * 11]:
            with self.assertRaises(ValidationError):
                self.context(additional_program_ids=programs)
