"""Exercise the real graph/checkpointer with deterministic model/database adapters."""

import copy
import time
import unittest
from uuid import uuid4
from langchain_core.messages import AIMessage
from langgraph.types import Command
from fastapi import HTTPException
from agent_service.contracts import MessageInput, ActionInput, ContextInput
from agent_service.interpretation import Interpretation, ActionIntent
from agent_service.web_contracts import parse_term
from agent_service.graph import create_graph as real_create_graph, request_state
from calendar_fixture import fixture_agent


def create_graph(repository, model=None):
    return real_create_graph(repository, model, web_agent=fixture_agent())
from agent_service.server import RequestManager


def context():
    return {"program_id": "software-engineering", "page": "/courses", "selected_course_id": None, "completed_course_ids": [], "plan": [], "starting_term": "spring-2026", "term_to_slot": {"spring-2027": 3}, "revision": "v1", "semester_count": 8}


def step(kind="add_course_to_plan", query="CS146"):
    return {"kind": kind, "course_query": query, "term": "next", "semester_slot": None, "read_tools": []}


def intent(value):
    # Old executor fixtures are adapted only in tests; production never accepts
    # the ambiguous flat language schema at its interpretation boundary.
    def target(slot, term):
        if term:
            if term in ('current', 'next'): return dict(kind='relative_term', relation=term)
            try: parsed = parse_term(term)
            except ValueError: return None
            return dict(kind='calendar_term', season=parsed.season, year=parsed.year)
        return dict(kind='numbered_semester', number=slot) if slot else None
    kind = value['kind']
    source = target(value.get('source_semester_slot'), value.get('source_term'))
    destination = target(value.get('semester_slot'), value.get('term'))
    if kind == 'remove_course_from_plan': source, destination = source or destination, None
    if kind in ('find_course', 'open_course'): source, destination = None, None
    return ActionIntent(kind=kind, course_query=value['course_query'], source=source, destination=destination)


class Model:
    def __init__(self, steps):
        self.steps = steps

    def with_structured_output(self, *args, **kwargs):
        return self

    def invoke(self, messages):
        return {"raw": AIMessage(content=""), "parsed": Interpretation(steps=[intent(s) for s in self.steps], resume_pending=getattr(self, "resume_pending", False)), "parsing_error": None}


class Repository:
    def __init__(self, mode="ok"):
        self.calls = 0
        self.mode = mode

    def find(self, program, query, course_id=None):
        self.calls += 1
        if self.mode == "error":
            raise TimeoutError("must not retry")
        if self.mode == "empty":
            return []
        result = [{"course_id": "se-cs146", "code": "CS 146", "title": "Data Structures and Algorithms", "program_id": program}]
        return result * (2 if self.mode == "ambiguous" else 1)


class GraphTests(unittest.TestCase):
    def run_graph(self, steps=None, ctx=None, repo=None, message="Add CS146"):
        graph = create_graph(repo or Repository(), Model(steps if steps is not None else [step()]))
        config = {"configurable": {"thread_id": str(uuid4())}}
        output = graph.invoke(request_state(message, ctx or context()), config)
        return graph, config, output

    def ack(self, output, ctx=None, success=True):
        action = output["__interrupt__"][0].value["action"]
        snapshot = copy.deepcopy(ctx or output["app_context"])
        snapshot["revision"] += "+1"
        if action["kind"] == "open_course":
            snapshot["selected_course_id"] = action["course_id"]
        elif success and action["kind"] == "remove_course_from_plan":
            snapshot["plan"] = [p for p in snapshot["plan"] if p["course_id"] != action["course_id"]]
        elif success and action["kind"] == "move_course_in_plan":
            for entry in snapshot["plan"]:
                if entry["course_id"] == action["course_id"]:
                    entry["semester_slot"] = action["semester_slot"]
        elif success:
            snapshot["plan"].append({"course_id": action["course_id"], "semester_slot": action["semester_slot"], "status": "planned"})
        return {"action_id": action["action_id"], "tool_call_id": action["tool_call_id"], "status": "succeeded" if success else "failed", "code": "ok" if success else "browser_failed", "message": "Done" if success else "Browser failed", "context": snapshot}

    def test_add_requires_reads_then_actual_plan_membership(self):
        graph, config, output = self.run_graph()
        self.assertFalse(output["reply"])
        self.assertEqual({r["tool"] for r in output["read_requirements"]}, {"find_course", "get_plan"})
        self.assertTrue(all(r["status"] == "succeeded" for r in output["read_requirements"]))
        self.assertEqual(output["pending_action"]["target_term"], {"season": "spring", "year": 2027})
        final = graph.invoke(Command(resume=self.ack(output)), config)
        self.assertIn("Added CS 146", final["reply"])
        self.assertEqual(final["app_context"]["plan"][0]["semester_slot"], 3)

    def test_success_claim_without_plan_membership_is_rejected(self):
        graph, config, output = self.run_graph()
        result = self.ack(output)
        result["context"]["plan"] = []
        final = graph.invoke(Command(resume=result), config)
        self.assertTrue(final["error"])
        self.assertNotIn("Added CS 146", final["reply"])

    def test_open_needs_no_term_mapping(self):
        ctx = context(); ctx["term_to_slot"] = {}
        graph, config, output = self.run_graph([step("open_course")], ctx)
        self.assertEqual(len(output["read_requirements"]), 1)
        final = graph.invoke(Command(resume=self.ack(output)), config)
        self.assertIn("Opened CS 146", final["reply"])

    def test_missing_mapping_asks_without_action(self):
        ctx = context(); ctx["term_to_slot"] = {}; ctx["starting_term"] = None
        _, _, result = self.run_graph(ctx=ctx)
        self.assertNotIn("__interrupt__", result)
        self.assertIn("starting academic term", result["reply"])

    def test_failed_read_is_not_retried(self):
        repo = Repository("error")
        _, _, result = self.run_graph(repo=repo)
        self.assertEqual(repo.calls, 1)
        self.assertTrue(result["error"])
        self.assertIsNone(result["pending_action"])

    def test_empty_and_ambiguous_lookup_never_dispatch(self):
        for mode in ["empty", "ambiguous"]:
            with self.subTest(mode=mode):
                _, _, result = self.run_graph(repo=Repository(mode))
                self.assertNotIn("__interrupt__", result)
                self.assertIsNone(result["pending_action"])

    def test_sequential_actions_wait_for_each_ack(self):
        graph, config, first = self.run_graph([step("open_course"), step()])
        self.assertEqual(first["pending_action"]["kind"], "open_course")
        second = graph.invoke(Command(resume=self.ack(first)), config)
        self.assertEqual(second["pending_action"]["kind"], "add_course_to_plan")
        self.assertEqual(second["action_index"], 1)
        final = graph.invoke(Command(resume=self.ack(second)), config)
        self.assertEqual(len(final["outcomes"]), 2)
        self.assertIn("Opened CS 146", final["reply"])
        self.assertIn("Added CS 146", final["reply"])

    def test_action_failure_stops_remaining_steps(self):
        graph, config, first = self.run_graph([step("open_course"), step()])
        final = graph.invoke(Command(resume=self.ack(first, success=False)), config)
        self.assertNotIn("__interrupt__", final)
        self.assertEqual(len(final["outcomes"]), 1)
        self.assertIn("Remaining actions were not attempted", final["reply"])

    def test_existing_or_completed_course_not_overwritten(self):
        for field, value in [("plan", [{"course_id": "se-cs146", "semester_slot": 2, "status": "in-progress"}]), ("completed_course_ids", ["se-cs146"])]:
            ctx = context(); ctx[field] = value
            _, _, result = self.run_graph(ctx=ctx)
            self.assertNotIn("__interrupt__", result)
            self.assertEqual(result["app_context"][field], value)

    def test_this_course_requires_a_real_selection(self):
        _, _, output = self.run_graph([step(query="selected")])
        self.assertNotIn("__interrupt__", output)
        self.assertIn("Which course", output["reply"])

    def test_invalid_term_and_out_of_range_slot_do_not_act(self):
        for replacement in [{"term": "sometime"}, {"semester_slot": 20, "term": None}]:
            requested = {**step(), **replacement}
            _, _, output = self.run_graph([requested], message="Add CS146 to Semester 20" if "semester_slot" in replacement else "Add CS146 sometime")
            self.assertNotIn("__interrupt__", output)
            self.assertNotEqual(output["decision"], "execute_action")

    def test_model_cannot_invent_a_missing_semester_mapping(self):
        ctx = context(); ctx["term_to_slot"] = {}; ctx["starting_term"] = None
        _, _, output = self.run_graph([{**step(), "semester_slot": 4}], ctx)
        self.assertNotIn("__interrupt__", output)
        self.assertIn("starting academic term", output["reply"])

    def test_current_semester_declaration_is_not_the_target_slot(self):
        ctx = context(); ctx["starting_term"] = "spring-2024"; ctx["term_to_slot"] = {"fall-2026": 6, "spring-2027": 7}
        _, _, output = self.run_graph([step()], ctx, message="Current semester is semester 6. Add CS146 to next semester")
        self.assertEqual(output["pending_action"]["semester_slot"], 7)

    def test_current_and_next_terms_use_separate_slots(self):
        ctx = context(); ctx["starting_term"] = "spring-2024"; ctx["term_to_slot"] = {"fall-2026": 6, "spring-2027": 7}
        _, _, current = self.run_graph([{**step(), "term": "current"}], ctx, message="Add CS146 to my current semester")
        self.assertEqual(current["pending_action"]["semester_slot"], 6)
        self.assertEqual(current["pending_action"]["target_term"], {"season": "fall", "year": 2026})
        _, _, upcoming = self.run_graph(ctx=ctx, message="Add CS146 to my next semester")
        self.assertEqual(upcoming["pending_action"]["semester_slot"], 7)

    def test_mapping_correction_does_not_claim_a_course_moved(self):
        ctx = context(); ctx["starting_term"] = "spring-2024"; ctx["term_to_slot"] = {"fall-2026": 6, "spring-2027": 7}
        _, _, output = self.run_graph(steps=[], ctx=ctx, message="Next semester is semester 7")
        self.assertNotIn("__interrupt__", output)
        self.assertIsNone(output["pending_action"])
        self.assertEqual(output["app_context"]["starting_term"], "spring-2024")

    def test_find_then_open_preserves_request_order(self):
        graph, config, output = self.run_graph([step("find_course"), step("open_course")])
        self.assertEqual(output["action_index"], 1)
        final = graph.invoke(Command(resume=self.ack(output)), config)
        self.assertIn("Opened CS 146", final["reply"])

    def test_bad_structured_model_output_ends_without_reads(self):
        class BrokenModel(Model):
            def invoke(self, messages):
                return {"parsed": None, "parsing_error": ValueError("invalid")}
        repo = Repository()
        graph = create_graph(repo, BrokenModel([]))
        output = graph.invoke(request_state("Open CS146", context()), {"configurable": {"thread_id": str(uuid4())}})
        self.assertEqual(repo.calls, 0)
        self.assertIn("invalid action plan", output["reply"])

    def planned_context(self):
        ctx = context()
        ctx["term_to_slot"] = {}
        ctx["plan"] = [{"course_id": "se-cs146", "semester_slot": 2, "status": "in-progress"}, {"course_id": "other-course", "semester_slot": 3, "status": "planned"}]
        return ctx

    def test_remove_without_term_mapping_preserves_other_courses(self):
        graph, config, output = self.run_graph([{**step("remove_course_from_plan"), "term": None}], self.planned_context(), message="Remove CS146 from my plan")
        self.assertEqual({r["tool"] for r in output["read_requirements"]}, {"find_course", "get_plan"})
        final = graph.invoke(Command(resume=self.ack(output)), config)
        self.assertIn("Removed CS 146 from Semester 2", final["reply"])
        self.assertEqual(final["app_context"]["plan"], [self.planned_context()["plan"][1]])

    def test_move_preserves_status_without_remapping_calendar(self):
        graph, config, output = self.run_graph([{**step("move_course_in_plan"), "term": None, "semester_slot": 5, "source_semester_slot": 2}], self.planned_context(), message="Move CS146 from Semester 2 to Semester 5")
        final = graph.invoke(Command(resume=self.ack(output)), config)
        self.assertIn("Moved CS 146 from Semester 2 to Semester 5", final["reply"])
        self.assertEqual(final["app_context"]["plan"][0]["status"], "in-progress")
        self.assertEqual(final["app_context"]["term_to_slot"], {})

    def test_missing_course_wrong_source_and_same_destination_never_act(self):
        cases = [
            ({**step("remove_course_from_plan"), "term": None}, context(), "Remove CS146"),
            ({**step("remove_course_from_plan"), "term": None, "source_semester_slot": 3}, self.planned_context(), "Remove CS146 from Semester 3"),
            ({**step("move_course_in_plan"), "term": None, "semester_slot": 5, "source_semester_slot": 3}, self.planned_context(), "Move CS146 from Semester 3 to Semester 5"),
            ({**step("move_course_in_plan"), "term": None, "semester_slot": 2}, self.planned_context(), "Move CS146 to Semester 2"),
            ({**step("move_course_in_plan"), "term": None}, self.planned_context(), "Move CS146"),
            ({**step("move_course_in_plan"), "term": None, "semester_slot": 20}, self.planned_context(), "Move CS146 to Semester 20"),
        ]
        for requested, ctx, message in cases:
            with self.subTest(message=message):
                _, _, output = self.run_graph([requested], ctx, message=message)
                self.assertNotIn("__interrupt__", output)
                self.assertEqual(output["app_context"]["plan"], ctx["plan"])

    def test_move_to_next_term_uses_profile_progression(self):
        ctx = self.planned_context(); ctx["starting_term"] = "fall-2024"; ctx["term_to_slot"] = {"spring-2027": 6}
        _, _, output = self.run_graph([step("move_course_in_plan")], ctx, message="Move CS146 to next semester")
        self.assertEqual(output["pending_action"]["semester_slot"], 6)

    def test_false_remove_or_move_ack_is_rejected(self):
        for kind in ["remove_course_from_plan", "move_course_in_plan"]:
            with self.subTest(kind=kind):
                graph, config, output = self.run_graph([{**step(kind), "term": None, "semester_slot": 5 if kind == "move_course_in_plan" else None}], self.planned_context(), message="Change CS146 to Semester 5")
                receipt = self.ack(output)
                receipt["context"]["plan"] = self.planned_context()["plan"]
                final = graph.invoke(Command(resume=receipt), config)
                self.assertTrue(final["error"])
                self.assertNotIn("Removed CS 146", final["reply"])
                self.assertNotIn("Moved CS 146", final["reply"])

    def test_move_then_remove_waits_and_reads_fresh_context(self):
        requested = [{**step("move_course_in_plan"), "term": None, "semester_slot": 5}, {**step("remove_course_from_plan"), "term": None}]
        graph, config, output = self.run_graph(requested, self.planned_context(), message="Move CS146 to Semester 5 then remove it")
        second = graph.invoke(Command(resume=self.ack(output)), config)
        self.assertEqual(second["pending_action"]["previous_semester_slot"], 5)
        final = graph.invoke(Command(resume=self.ack(second)), config)
        self.assertIn("Moved CS 146", final["reply"])
        self.assertIn("Removed CS 146 from Semester 5", final["reply"])

    def test_change_plan_uses_the_resolved_catalog_id_for_any_course(self):
        class OtherRepository:
            def __init__(self, course):
                self.course = course
            def find(self, program, query, course_id=None):
                return [{**self.course, "program_id": program}]
        for course in [{"course_id": "catalog-math30", "code": "MATH 30", "title": "Calculus I"}, {"course_id": "catalog-cmpe142", "code": "CMPE 142", "title": "Operating Systems"}]:
            for kind in ["move_course_in_plan", "remove_course_from_plan"]:
                with self.subTest(code=course["code"], kind=kind):
                    ctx = context(); ctx["plan"] = [{"course_id": course["course_id"], "semester_slot": 2, "status": "planned"}]
                    requested = {**step(kind, course["title"]), "term": None, "semester_slot": 5 if kind == "move_course_in_plan" else None}
                    graph, config, output = self.run_graph([requested], ctx, OtherRepository(course), message=f'Change {course["title"]} to Semester 5')
                    self.assertEqual(output["pending_action"]["course_id"], course["course_id"])
                    final = graph.invoke(Command(resume=self.ack(output)), config)
                    self.assertIn(course["code"], final["reply"])
                    self.assertFalse(final["error"])

    def test_move_without_destination_cannot_use_model_suggested_term_read(self):
        requested = {**step("move_course_in_plan"), "term": None, "read_tools": ["resolve_term"]}
        _, _, output = self.run_graph([requested], self.planned_context(), message="Move CS146")
        self.assertNotIn("__interrupt__", output)
        self.assertIn("Which planner semester", output["reply"])

    def test_open_and_numbered_remove_do_not_call_web(self):
        from calendar_fixture import CalendarTools
        for kind in ("open_course", "remove_course_from_plan"):
            tools = CalendarTools()
            graph = real_create_graph(Repository(), Model([{**step(kind), "term": None}]), web_agent=fixture_agent(tools))
            output = graph.invoke(request_state("Remove CS146" if kind.startswith("remove") else "Open CS146", self.planned_context()), {"configurable": {"thread_id": str(uuid4())}})
            self.assertIn("__interrupt__", output)
            self.assertEqual((tools.searches, tools.fetches), (0, 0))

    def test_conflicting_saved_mapping_blocks_move(self):
        ctx = self.planned_context(); ctx["term_to_slot"] = {"spring-2027": 6}
        _, _, output = self.run_graph([step("move_course_in_plan")], ctx, message="Move CS146 to next semester")
        self.assertNotIn("__interrupt__", output)
        self.assertIn("mapping disagrees", output["reply"])

    def test_numbered_answer_to_move_clarification_is_preserved(self):
        model = Model([{**step("move_course_in_plan"), "term": None}])
        graph = create_graph(Repository(), model)
        config = {"configurable": {"thread_id": str(uuid4())}}
        ctx = self.planned_context()
        first = graph.invoke(request_state("Move CS146", ctx), config)
        self.assertNotIn("__interrupt__", first)
        model.steps = [{**step("move_course_in_plan"), "term": None, "semester_slot": 5}]
        second = graph.invoke(request_state("5", ctx), config)
        self.assertEqual(second["pending_action"]["semester_slot"], 5)

    def test_required_policy_research_cannot_be_dropped_before_action(self):
        class ResearchModel(Model):
            def invoke(self, messages):
                return {"raw": AIMessage(content=""), "parsed": Interpretation(steps=[intent(s) for s in self.steps], research=["Verify the add deadline"]), "parsing_error": None}
        repo = Repository()
        graph = create_graph(repo, ResearchModel([step()]))
        output = graph.invoke(request_state("Check the add deadline, then add CS146", context()), {"configurable": {"thread_id": str(uuid4())}})
        self.assertNotIn("__interrupt__", output)
        self.assertEqual(repo.calls, 0)
        self.assertIn("not available yet", output["reply"])

    def test_change_ack_cannot_change_other_courses_or_completion(self):
        for field in ["plan", "completed_course_ids"]:
            with self.subTest(field=field):
                graph, config, output = self.run_graph([{**step("remove_course_from_plan"), "term": None}], self.planned_context(), message="Remove CS146")
                receipt = self.ack(output)
                receipt["context"][field] = [] if field == "plan" else ["other-course"]
                final = graph.invoke(Command(resume=receipt), config)
                self.assertTrue(final["error"])

    def test_explicit_add_slot_requires_profile_for_offering_term(self):
        graph, config, output = self.run_graph([{**step(), "term": None, "semester_slot": 3}], message="Add CS146 to Semester 3")
        self.assertEqual(output["pending_action"]["semester_slot"], 3)
        self.assertEqual(output["web_handoff"]["calendar"]["status"], "verified")
        final = graph.invoke(Command(resume=self.ack(output)), config)
        self.assertIn("Spring 2027 (Semester 3)", final["reply"])


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.manager = RequestManager(create_graph(Repository(), Model([step("open_course")])))
        self.thread = str(uuid4())

    def tearDown(self):
        self.manager.pool.shutdown(wait=True)

    def submit(self, message="Open CS146"):
        return self.manager.submit(MessageInput(thread_id=self.thread, request_id=str(uuid4()), message=message, context=context()))

    def wait(self, request_id, status):
        end = time.monotonic() + 3
        while time.monotonic() < end:
            with self.manager.lock:
                record = self.manager.owned(request_id, self.thread)
                if record["status"] == status:
                    return dict(record)
            time.sleep(.005)
        self.fail(f"Did not reach {status}")

    def result(self, record, action_id=None):
        action = record["action"]
        ctx = context(); ctx["selected_course_id"] = action["course_id"]; ctx["revision"] = "v2"
        return ActionInput(thread_id=self.thread, request_id=record["request_id"], action_id=action_id or action["action_id"], tool_call_id=action["tool_call_id"], status="succeeded", code="opened", message="Opened", context=ctx)

    def test_fifo_requires_fresh_context_and_deduplicates_ack(self):
        first = self.submit(); a = self.wait(first["request_id"], "awaiting_action")
        second = self.submit(); third = self.submit()
        self.assertEqual(second["status"], "queued")
        self.manager.acknowledge(self.result(a))
        self.wait(first["request_id"], "completed")
        self.wait(second["request_id"], "needs_context")
        self.assertEqual(self.manager.requests[third["request_id"]]["status"], "queued")
        self.manager.acknowledge(self.result(a))  # Duplicate cannot advance a second time.
        self.assertEqual(self.manager.requests[second["request_id"]]["status"], "needs_context")
        ctx = context(); ctx["revision"] = "fresh-v3"
        self.manager.context(second["request_id"], ContextInput(thread_id=self.thread, context=ctx))
        b = self.wait(second["request_id"], "awaiting_action")
        self.assertEqual(b["action"]["expected_revision"], "fresh-v3")

    def test_wrong_ack_and_other_conversation_cannot_advance(self):
        first = self.submit(); a = self.wait(first["request_id"], "awaiting_action")
        with self.assertRaises(HTTPException):
            self.manager.acknowledge(self.result(a, action_id="wrong"))
        with self.assertRaises(HTTPException):
            self.manager.owned(first["request_id"], str(uuid4()))
        self.assertEqual(self.manager.requests[first["request_id"]]["status"], "awaiting_action")

    def test_duplicate_message_not_enqueued_twice(self):
        data = MessageInput(thread_id=self.thread, request_id=str(uuid4()), message="Open CS146", context=context())
        first = self.manager.submit(data)
        self.manager.submit(data)
        self.assertEqual(len(self.manager.requests), 1)
        self.assertEqual(len(self.manager.conversations[self.thread]["queue"]), 0)
        self.wait(first["request_id"], "awaiting_action")

    def test_new_server_has_no_old_checkpoints_or_requests(self):
        first = self.submit()
        self.wait(first["request_id"], "awaiting_action")
        fresh = RequestManager(create_graph(Repository(), Model([step()])))
        try:
            with self.assertRaises(HTTPException):
                fresh.owned(first["request_id"], self.thread)
        finally:
            fresh.pool.shutdown(wait=True)


if __name__ == "__main__":
    unittest.main()
