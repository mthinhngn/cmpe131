import copy
import unittest
from datetime import date
from uuid import uuid4
from langgraph.types import Command
from agent_service.graph import create_graph, request_state
from agent_service.contracts import BrowserContext
from calendar_fixture import CalendarTools, fixture_agent
from test_graph import Model, Repository, context, step


class OrchestrationTests(unittest.TestCase):
    def build(self, steps, tools=None):
        self.tools = tools or CalendarTools()
        self.model = Model(steps)
        self.clock = [date(2026, 11, 3)]
        today = lambda: self.clock[0]
        self.graph = create_graph(Repository(), self.model, fixture_agent(self.tools, today=today), today=today)
        self.config = {"configurable": {"thread_id": str(uuid4())}}

    def invoke(self, message, ctx):
        return self.graph.invoke(request_state(message, copy.deepcopy(ctx)), self.config)

    def ack(self, output):
        action = output["pending_action"]
        ctx = copy.deepcopy(output["app_context"])
        ctx["revision"] += "+ack"
        ctx["plan"] = [p for p in ctx["plan"] if p["course_id"] != action["course_id"]]
        if action["kind"] != "remove_course_from_plan":
            ctx["plan"].append({"course_id": action["course_id"], "semester_slot": action["semester_slot"], "status": action.get("previous_status", "planned")})
            if isinstance(action["semester_slot"], str): ctx["named_terms"] = [action["semester_slot"]]
        return self.graph.invoke(Command(resume={"action_id": action["action_id"], "tool_call_id": action["tool_call_id"], "status": "succeeded", "code": "ok", "message": "Done", "context": ctx}), self.config)

    def test_profile_reply_continues_original_action_reuses_calendar(self):
        self.build([{**step(), "term": "current"}])
        ctx = context(); ctx.update(starting_term=None, term_to_slot={})
        first = self.invoke("Add CS146 to current semester", ctx)
        self.assertEqual(first["pending_clarification"]["kind"], "starting_term")
        self.assertEqual((self.tools.searches, self.tools.schedule_fetches), (1, 0))
        ctx.update(starting_term="fall-2025", revision="saved-profile")
        self.model.steps = []
        self.model.resume_pending = True  # Model interprets the reply; stored steps retain intent.
        second = self.invoke("Fall 2025", ctx)
        self.assertEqual(second["pending_action"]["semester_slot"], 3)
        self.assertEqual((self.tools.searches, self.tools.schedule_fetches), (1, 1))
        final = self.ack(second)
        self.model.resume_pending = False
        self.model.steps = [{**step("move_course_in_plan"), "term": "next"}]
        third = self.invoke("Move CS146 to next semester", final["app_context"])
        self.assertEqual(third["pending_action"]["semester_slot"], 4)
        self.assertEqual((self.tools.searches, self.tools.schedule_fetches), (1, 2))

    def test_expired_calendar_refreshes_before_continuing_profile_reply(self):
        self.build([{**step(), "term": "current"}])
        ctx = context(); ctx.update(starting_term=None, term_to_slot={})
        self.invoke("Add CS146 to current semester", ctx)
        self.clock[0] = date(2026, 12, 19)
        ctx.update(starting_term="fall-2025", revision="saved-profile")
        self.model.steps = []
        self.model.resume_pending = True
        result = self.invoke("Fall 2025", ctx)
        self.assertGreater(self.tools.searches, 1)
        self.assertIsNone(result["pending_action"])
        self.assertEqual(self.tools.schedule_fetches, 0)

    def test_long_range_number_needs_no_calendar_or_sections(self):
        self.build([{**step(), "term": None, "semester_slot": 6}])
        result = self.invoke("Add CS146 to Semester 6", context())
        self.assertEqual(result["pending_action"]["semester_slot"], 6)
        self.assertEqual((self.tools.searches, self.tools.schedule_fetches), (0, 0))
        self.assertEqual(result["pending_action"]["target_term"], {"season": "fall", "year": 2028})

    def test_semster_typo_keeps_explicit_move_destination_and_saved_profile(self):
        self.build([{**step("move_course_in_plan"), "term": None, "semester_slot": 2}])
        ctx = {**context(), "starting_term": "spring-2025", "term_to_slot": {}, "plan": [{"course_id": "se-cs146", "semester_slot": 5, "status": "in-progress"}]}
        result = self.invoke("move cs146 to semster 2", ctx)
        self.assertEqual(result["pending_action"]["semester_slot"], 2)
        self.assertEqual(result["pending_action"]["target_term"], {"season": "fall", "year": 2025})
        self.assertEqual((self.tools.searches, self.tools.schedule_fetches), (1, 0))
        self.assertIn("from Semester 5 to Semester 2", self.ack(result)["reply"])

    def test_semster_typo_does_not_turn_current_declaration_into_destination(self):
        self.build([{**step(), "term": "next"}])
        ctx = {**context(), "starting_term": "spring-2024", "term_to_slot": {}}
        result = self.invoke("My current semster is semster 6. Add CS146 to next semester", ctx)
        self.assertEqual(result["pending_action"]["semester_slot"], 7)

    def test_number_without_semester_label_cannot_be_used_as_destination(self):
        self.build([{**step("move_course_in_plan"), "term": None}])
        ctx = {**context(), "plan": [{"course_id": "se-cs146", "semester_slot": 5, "status": "planned"}]}
        result = self.invoke("Move CS146, room 2", ctx)
        self.assertIsNone(result["pending_action"])
        self.assertEqual(self.tools.fetches, 0)

    def test_explicit_current_term_checks_calendar_and_offering(self):
        self.build([{**step(), "term": "Fall 2026"}])
        result = self.invoke("Add CS146 to Fall 2026", context())
        self.assertEqual(result["pending_action"]["semester_slot"], 2)
        self.assertEqual((self.tools.searches, self.tools.schedule_fetches), (1, 1))

    def test_verified_summer_dispatches_named_slot_only_then_browser_creates_it(self):
        self.build([{**step(), "term": "Summer 2026"}])
        ctx = context(); ctx.update(starting_term=None, term_to_slot={}, named_terms=[])
        result = self.invoke("Add CS146 to Summer 2026", ctx)
        self.assertEqual(result["pending_action"]["semester_slot"], "summer-2026")
        self.assertEqual(result["app_context"]["named_terms"], [])
        final = self.ack(result)
        BrowserContext.model_validate(final["app_context"])
        self.assertIn("summer-2026", final["app_context"]["named_terms"])
        self.assertIn("Summer 2026", final["reply"])
        self.assertNotIn("Semester summer", final["reply"])

    def test_unoffered_or_failed_schedule_never_creates_slot(self):
        for unavailable in (True, False):
            class Failure(CalendarTools):
                def fetch(self, hit, deadline):
                    source = super().fetch(hit, deadline)
                    if unavailable: source["schedule_rows"] = [r for r in source["schedule_rows"] if not r[0].startswith("CS 146 ")]
                    else: source["complete_table"] = False
                    return source
            self.build([{**step(), "term": "Summer 2026"}], Failure())
            result = self.invoke("Add CS146 to Summer 2026", {**context(), "named_terms": []})
            self.assertIsNone(result["pending_action"])
            self.assertEqual(result["app_context"]["named_terms"], [])
            self.assertEqual(self.tools.schedule_fetches, 1)

    def test_remove_from_named_term_needs_no_web_or_starting_profile(self):
        self.build([{**step("remove_course_from_plan"), "term": "Summer 2026"}])
        ctx = {**context(), "starting_term": None, "term_to_slot": {}, "named_terms": ["summer-2026"], "plan": [{"course_id": "se-cs146", "semester_slot": "summer-2026", "status": "planned"}]}
        result = self.invoke("Remove CS146 from Summer 2026", ctx)
        self.assertIn("__interrupt__", result)
        self.assertEqual(self.tools.fetches, 0)
        self.assertIn("Removed CS 146 from Summer 2026", self.ack(result)["reply"])

    def test_remove_current_cannot_remove_from_another_slot(self):
        self.build([{**step("remove_course_from_plan"), "term": "current"}])
        ctx = {**context(), "plan": [{"course_id": "se-cs146", "semester_slot": 5, "status": "planned"}]}
        result = self.invoke("Remove CS146 from current semester", ctx)
        self.assertNotIn("__interrupt__", result)
        self.assertIn("No change was made", result["reply"])
        self.assertEqual(self.tools.schedule_fetches, 0)

    def test_explicit_term_slot_conflict_blocks_before_offering(self):
        self.build([{**step(), "term": "Fall 2026", "semester_slot": 5}])
        state = request_state("Add CS146 to Fall 2026 Semester 5", context())
        # Legacy supervisor transport still validates conflicting flat fields.
        state["steps"] = [{**step(), "term": "Fall 2026", "semester_slot": 5}]
        result = self.graph.invoke(state, self.config)
        self.assertNotIn("__interrupt__", result)
        self.assertEqual(self.tools.fetches, 0)

    def test_old_four_season_mapping_does_not_override_new_profile_rule(self):
        self.build([{**step(), "term": "Fall 2026"}])
        result = self.invoke("Add CS146 to Fall 2026", {**context(), "term_to_slot": {"fall-2026": 3}})
        self.assertNotIn("__interrupt__", result)
        self.assertIn("mapping disagrees", result["reply"])

    def test_new_chat_does_not_share_calendar_cache(self):
        self.build([{**step(), "term": "current"}])
        ctx = {**context(), "starting_term": None, "term_to_slot": {}}
        self.invoke("Add CS146 to current semester", ctx)
        self.config = {"configurable": {"thread_id": str(uuid4())}}
        self.invoke("Add CS146 to current semester", ctx)
        self.assertEqual(self.tools.searches, 2)

    def test_named_move_source_must_match_actual_entry(self):
        for actual in ("summer-2026", "winter-2026"):
            self.build([{**step("move_course_in_plan"), "source_term": "Summer 2026", "term": "Fall 2026"}])
            ctx = {**context(), "named_terms": [actual], "plan": [{"course_id": "se-cs146", "semester_slot": actual, "status": "in-progress"}]}
            result = self.invoke("Move CS146 from Summer 2026 to Fall 2026", ctx)
            if actual == "summer-2026":
                self.assertEqual(result["pending_action"]["source_semester_slot"], actual)
                final = self.ack(result)
                self.assertIn("from Summer 2026 to Semester 2", final["reply"])
            else:
                self.assertNotIn("__interrupt__", result)
                self.assertIn("No change was made", result["reply"])

    def test_add_ack_cannot_change_profile_or_other_courses(self):
        self.build([{**step(), "term": "Summer 2026"}])
        result = self.invoke("Add CS146 to Summer 2026", context())
        action = result["pending_action"]
        ctx = copy.deepcopy(result["app_context"])
        ctx.update(starting_term="fall-2020", named_terms=["summer-2026"], revision="tampered", plan=[{"course_id": action["course_id"], "semester_slot": "summer-2026", "status": "planned"}])
        final = self.graph.invoke(Command(resume={"action_id": action["action_id"], "tool_call_id": action["tool_call_id"], "status": "succeeded", "code": "ok", "message": "Done", "context": ctx}), self.config)
        self.assertTrue(final["error"])
        self.assertNotIn("Added CS 146", final["reply"])
