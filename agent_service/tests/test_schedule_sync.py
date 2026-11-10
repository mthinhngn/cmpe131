import unittest
from uuid import uuid4
from agent_service.graph import create_graph, request_state
from agent_service.schedule_data import read_sections
from agent_service.web_tools import LookupFailure
from calendar_fixture import CalendarTools, fixture_agent
from test_graph import Model, Repository, context, step


class ScheduleSyncTests(unittest.TestCase):
    def invoke(self, term, tools=None):
        tools = tools or CalendarTools()
        graph = create_graph(Repository(), Model([{**step(), "term": term}]), fixture_agent(tools))
        output = graph.invoke(request_state(f"Add CS146 to {term}", context()), {"configurable": {"thread_id": str(uuid4())}})
        return output, tools

    def test_future_term_can_be_planned_without_published_sections(self):
        result, tools = self.invoke("Fall 2028")
        self.assertEqual(result["pending_action"]["semester_slot"], 6)
        self.assertEqual(tools.schedule_fetches, 0)
        self.assertIsNone(result["offering_evidence"])

    def test_current_term_missing_schedule_still_dispatches_personal_plan(self):
        class Unpublished(CalendarTools):
            def schedule_url(self, term_id, deadline):
                raise LookupFailure("schedule_not_published", "Not published")
        result, _ = self.invoke("current", Unpublished())
        self.assertIsNotNone(result["pending_action"])
        self.assertIn("Sections unavailable", result["offering_evidence"]["warning"])

    def test_complete_absence_retains_a_plan_without_invented_sections(self):
        class Absent(CalendarTools):
            def fetch(self, hit, deadline):
                result = super().fetch(hit, deadline)
                if "schedule_rows" in result:
                    result["schedule_rows"] = [r for r in result["schedule_rows"] if not r[0].startswith("CS 146 ")]
                return result
        result, _ = self.invoke("next", Absent())
        self.assertIsNotNone(result["pending_action"])
        self.assertEqual(result["offering_evidence"]["sections"], [])

    def test_section_adapter_keeps_meeting_metadata_and_term_identity(self):
        result = read_sections("spring-2027", CalendarTools())
        self.assertEqual(result["status"], "available")
        self.assertEqual(result["term"], "spring-2027")
        self.assertEqual(result["offerings"][0]["courseCode"], "CS 146")
        self.assertEqual(result["offerings"][0]["instructors"], ["Fixture"])
        self.assertEqual(result["offerings"][0]["days"], "M")

    def test_wrong_term_table_does_not_supply_sections(self):
        class WrongTerm(CalendarTools):
            def fetch(self, hit, deadline):
                result = super().fetch(hit, deadline)
                result["headings"] = ["Fall 2026 Class Schedule"]
                return result
        result = read_sections("spring-2027", WrongTerm())
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["offerings"], [])
