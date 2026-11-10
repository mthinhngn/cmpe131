"""Read → validate → browser action → acknowledgement, with explicit routing."""

import json
import os
import re
from datetime import datetime, timezone
from uuid import uuid4
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt
from .agent import AgentState
from .interpretation import Interpretation, INTERPRETATION_PROMPT
from pydantic import ValidationError
from .telemetry import trace_event
from .web_contracts import WebResult, Term, parse_term, semester_slot, slot_term, slot_label
from .web_search_agent import lookup_input, local_today

MODEL_ID = os.getenv('KIMI_MODEL', 'qwen/qwen3.8-27b')
PLAN_ACTIONS = {"add_course_to_plan", "remove_course_from_plan", "move_course_in_plan"}


def required_reads(step):
    return ["find_course", *(["get_plan"] if step["kind"] in PLAN_ACTIONS else [])]


def valid_slot(slot, context):
    return type(slot) is int and slot in (context.get("semester_slots") if context.get("semester_slots") is not None else range(1, context["semester_count"] + 1)) or isinstance(slot, str) and re.fullmatch(r"(?:winter|summer)-(?:19|20|21)\d{2}", slot) is not None


def event(state, node, detail):
    trace_event(node, detail)
    return state.get("events", []) + [{"node": node, "detail": detail, "at": datetime.now(timezone.utc).isoformat()}]


def create_course_action_agent(repository, model, web_agent, checkpointer=None, today=local_today):
    planner = model.with_structured_output(Interpretation, method="function_calling", include_raw=True)

    def load_context(state):
        return {"decision": None, "events": event(state, "course_action.load_context", "Course Action loaded context and will select calendar/offering lookups as needed.")}

    def run_lookup(state, kind, **kwargs):
        output = web_agent.invoke(lookup_input(kind, **kwargs), {"recursion_limit": 40})
        result = WebResult.model_validate(output["result"]).model_dump(mode="json")
        if result["kind"] != kind:
            raise ValueError("Mismatched web lookup kind")
        return result, [*state["events"], *output.get("events", [])]

    def public_evidence(state, **updates):
        evidence = {**(state.get("web_handoff") or {}), **updates}
        evidence["citations"] = list({s["source_id"]: s for result in (evidence.get("calendar"), evidence.get("offering")) if result for s in result.get("citations", [])}.values())
        evidence["current_term"] = (evidence.get("calendar") or {}).get("current_term")
        return evidence

    def calendar_context(state):
        cache = state.get("calendar_cache")
        now = today().isoformat()
        if cache and cache["as_of"] <= now <= cache["valid_until"]:
            return cache, event(state, "course_action.calendar_cache", "Reused verified calendar within its teaching period.")
        return run_lookup(state, "calendar")

    def resolve_destination(state):
        step, context = state["steps"][state["action_index"]], state["app_context"]
        updates = {"decision": "continue", "events": state["events"], "resolved_slot": None, "resolved_source_slot": step.get("source_semester_slot"), "target_term": None}

        def ask_profile():
            remaining_steps = [dict(s) for s in state["steps"][state["action_index"]:]]
            remaining_steps[0]["course_query"] = state["course_matches"][0]["code"]
            return {**updates, "reply": "What was your starting academic term? Reply with a term such as Fall 2024. I will save it and continue this request using the verified calendar while it remains valid.", "decision": "respond", "pending_clarification": {"kind": "starting_term", "program_id": context["program_id"], "steps": remaining_steps}}
        raw = (step.get("term") or "").strip().lower()
        if step["kind"] in {"find_course", "open_course"}:
            return updates
        slot = step.get("semester_slot") if step["kind"] != "remove_course_from_plan" else step.get("source_semester_slot")
        if not raw and slot is None:
            if step["kind"] == "remove_course_from_plan": return updates
            return {"reply": "Which planner semester or calendar term should I use?", "decision": "respond", "pending_clarification": {"kind": "destination", "program_id": context["program_id"], "steps": state["steps"][state["action_index"]:]}}
        relative = raw in {"current", "current semester", "this semester", "next", "next semester", "học kỳ hiện tại", "học kỳ tới", "học kỳ sau"}
        term = None
        if relative:
            cache, updates["events"] = calendar_context(state)
            if cache["status"] != "verified":
                return {**updates, "error": cache["message"] or "The calendar could not be verified.", "decision": "respond", "web_handoff": public_evidence(state, calendar=cache)}
            updates["calendar_cache"] = cache
            updates["web_handoff"] = public_evidence(state, calendar=cache)
            updates["current_term"] = cache["current_term"]
            target = cache["next_term"] if raw in {"next", "next semester", "học kỳ tới", "học kỳ sau"} else cache["current_term"]
            term = Term.model_validate(target)
        elif raw:
            try: term = parse_term(raw)
            except ValueError:
                return {"reply": "Specify a numbered semester or a term such as Fall 2026.", "decision": "respond"}
        needs_start = (term is not None and term.season in {"fall", "spring"}) or (slot is not None and step["kind"] in {"add_course_to_plan", "move_course_in_plan"})
        if needs_start and not context.get("starting_term"):
            return ask_profile()
        if term:
            calculated = semester_slot(context.get("starting_term"), term)
            if slot is not None and slot != calculated:
                return {**updates, "reply": "The explicit term and numbered semester disagree with your saved starting term. Please clarify.", "decision": "respond"}
            slot = calculated
        elif slot is not None and step["kind"] in {"add_course_to_plan", "move_course_in_plan"}:
            term = slot_term(context["starting_term"], slot)
        if type(slot) is int and not valid_slot(slot, context):
            return {**updates, "reply": "That term is outside your existing numbered planner range. Extend the planner or correct the starting term first.", "decision": "respond"}
        if term and context.get("starting_term"):
            mapped = context.get("term_to_slot", {}).get(term.id)
            if mapped is not None and mapped != slot:
                return {**updates, "reply": "The browser term mapping disagrees with the saved starting term. Refresh the profile before continuing.", "decision": "respond"}
        if step["kind"] == "move_course_in_plan" and step.get("source_term"):
            source = step["source_term"].strip().lower()
            if source in {"current", "current semester", "this semester", "next", "next semester"}:
                cache, updates["events"] = calendar_context({**state, **updates})
                if cache["status"] != "verified":
                    return {**updates, "error": cache["message"] or "The source semester could not be verified.", "decision": "respond", "web_handoff": public_evidence(state, calendar=cache)}
                updates.update(calendar_cache=cache, current_term=cache["current_term"], web_handoff=public_evidence(state, calendar=cache))
                source_term = Term.model_validate(cache["next_term"] if source.startswith("next") else cache["current_term"])
            else:
                try: source_term = parse_term(source)
                except ValueError:
                    return {**updates, "reply": "Specify the move's source term clearly.", "decision": "respond"}
            if source_term.season in {"fall", "spring"} and not context.get("starting_term"):
                return ask_profile()
            source_slot = semester_slot(context.get("starting_term"), source_term)
            if step.get("source_semester_slot") is not None and step["source_semester_slot"] != source_slot:
                return {**updates, "reply": "The source term and source semester number disagree. No change was made.", "decision": "respond"}
            updates["resolved_source_slot"] = source_slot
        return {**updates, "resolved_slot": slot, "target_term": term.model_dump() if term else None, "events": event({"events": updates["events"]}, "course_action.resolve_destination", f"Resolved {slot_label(slot)}" if slot is not None else "No destination required.")}

    def monitored(state):
        cache = state.get("calendar_cache") or {}
        return cache.get("status") == "verified" and state.get("target_term") in [cache.get("current_term"), cache.get("next_term")]

    def verify_offering(state):
        step = state["steps"][state["action_index"]]
        if step["kind"] not in {"add_course_to_plan", "move_course_in_plan"}: return {"decision": "continue"}
        course = state["course_matches"][0]
        term = Term.model_validate(state["target_term"])
        updates = {}
        if term.season in {"fall", "spring"}:
            if term.year > today().year + 1 or term.year < today().year - 1:
                return {"offering_evidence": None, "decision": "continue", "events": event(state, "course_action.long_range_plan", "Distant graduation term; planner only without a calendar or section lookup.")}
            cache, events = calendar_context(state)
            updates = {"calendar_cache": cache, "events": events, "web_handoff": public_evidence(state, calendar=cache)}
            state = {**state, **updates}
            if cache["status"] != "verified":
                return {**updates, "error": "The academic calendar could not be verified. Please retry before scheduling this term.", "decision": "respond"}
            if not monitored(state):
                return {**updates, "offering_evidence": None, "decision": "continue", "events": event(state, "course_action.long_range_plan", "Outside the current/next Fall/Spring window; planner only, without section selection.")}
        result, events = run_lookup(state, "offering", target_term=term.id, course_code=course["code"])
        evidence = public_evidence(state, offering=result)
        if monitored(state) and result["status"] in {"failed", "not_verified", "not_offered"}:
            # Browser will keep a personal plan and show unavailable sections, never
            # inventing meeting times. Optional terms retain their existing checks.
            result = {**result, "target_term": term.model_dump(), "course_code": course["code"], "warning": "Sections unavailable. Keep this course in your personal plan and choose a section later in Schedule."}
            return {**updates, "offering_evidence": result, "web_handoff": public_evidence(state, offering=result), "decision": "continue", "events": events}
        if result["status"] != "verified":
            return {"error": result["message"] or "Course availability could not be verified. No planner change was made.", "decision": "respond", "web_handoff": evidence, "events": events}
        if result["course_code"] != course["code"] or result["target_term"] != state["target_term"]:
            return {"error": "Offering evidence did not match the requested course and term.", "decision": "respond", "events": events}
        return {**updates, "offering_evidence": result, "web_handoff": evidence, "decision": "continue", "events": event({"events": events}, "handoff.web_search_to_course_action", f"Verified {course['code']} in {term.season.title()} {term.year}; Course Action may validate the planner change.")}

    def select_read_tools(state):
        if state["step_count"] >= 8:
            return {"error": "The request reached its read limit. No further actions were taken; please clarify your request.", "decision": "respond"}
        if state["steps"]:
            steps, messages = state["steps"], []
        else:
            pending = state.get("pending_clarification")
            if pending and pending["program_id"] != state["app_context"]["program_id"]:
                pending = None
            context = state["app_context"]
            conversation = [m for m in state["messages"] if isinstance(m, HumanMessage) or isinstance(m, AIMessage) and not m.tool_calls and m.content][-8:]
            compact = {key: context.get(key) for key in ("program_id", "selected_course_id", "starting_term", "semester_count")}
            inputs = [SystemMessage(content=INTERPRETATION_PROMPT),
                      SystemMessage(content=json.dumps({"context": compact, "pending_clarification": pending}, ensure_ascii=False)), *conversation]
            events = state["events"]
            plan = None
            # One initial interpretation plus two schema repair attempts. Provider
            # failures propagate; they are not repeated as parsing failures.
            for attempt in range(3):
                from .kimi_budget import charge
                import time
                charge('decisions', time.monotonic() + 90)
                result = planner.invoke(inputs)
                try:
                    if result.get("parsing_error") or result.get("parsed") is None:
                        raise ValueError("Invalid structured output")
                    plan = Interpretation.model_validate(result["parsed"])
                    if plan.resume_pending and not pending:
                        raise ValueError("There is no pending clarification to resume")
                    break
                except (ValidationError, ValueError) as exc:
                    plan = None
                    events = event({"events": events}, "course_action.interpretation", f"Invalid interpretation attempt {attempt + 1}/3; no action dispatched.")
                    # Report schema paths/types, never provider bodies or input values.
                    issues = [{"field": list(e["loc"]), "type": e["type"]} for e in exc.errors(include_input=False)][:12] if isinstance(exc, ValidationError) else [{"type": "invalid_structure_or_pending_state"}]
                    inputs.append(SystemMessage(content="Your output failed validation: " + json.dumps(issues) + ". Return a complete valid interpretation of the same request; preserve all conditions. Do not invent missing values."))
            if plan is None:
                return {"error": "The model returned an invalid action plan. Please clarify your request.", "decision": "respond", "events": events}
            raw = result.get("raw")
            messages = ([raw] + [ToolMessage(content=plan.model_dump_json(), tool_call_id=call["id"]) for call in raw.tool_calls]) if raw is not None else []
            if plan.research or any(s.conditions for s in plan.steps):
                return {"messages": messages, "pending_clarification": None, "reply": "The requested research or execution condition is not available yet in Course Action. I have not attempted any course actions from this request.", "decision": "respond", "events": event({"events": events}, "select_read_tools", "Unresolved conditions; dependent actions blocked.")}
            if plan.clarification:
                return {"messages": messages, "pending_clarification": {"kind": "intent", "program_id": context["program_id"], "steps": [s.execution_step() for s in plan.steps], "question": plan.clarification}, "reply": plan.clarification, "decision": "respond", "events": events}
            if plan.resume_pending and pending["kind"] == "starting_term" and not plan.steps:
                if not context.get("starting_term"):
                    return {"reply": "Save your starting academic term before I continue.", "decision": "respond", "events": events}
                steps = pending["steps"]
            else:
                steps = [s.execution_step() for s in plan.steps]
            if not steps:
                return {"messages": messages, "pending_clarification": None, "reply": "Which course would you like to find, open, add, remove, or move?", "decision": "respond", "events": events}
            state = {**state, "events": events}
        step = steps[state["action_index"]]
        required = required_reads(step)
        requirements = [{"key": name, "tool": name, "arguments": {"course_query": step["course_query"], "term": step["term"]}, "status": "pending", "tool_call_id": str(uuid4()), "context_revision": None} for name in required]
        return {"messages": messages, "steps": steps, "step_count": state["step_count"] + 1, "course_matches": [], "target_term": None, "read_requirements": requirements, "pending_action": None, "action_result": None, "web_handoff": None, "offering_evidence": None, "pending_clarification": None, "decision": "read_tools", "events": event(state, "select_read_tools", "Required reads: " + ", ".join(required))}

    def execute_read_tools(state):
        context = state["app_context"]
        step = state["steps"][state["action_index"]]
        requirements, messages = [], []
        updates = {}
        events = state["events"][:]
        for index, requirement in enumerate(state["read_requirements"]):
            item = dict(requirement)
            name = item["tool"]
            call_id = item["tool_call_id"]
            try:
                if name in {"find_course", "get_course"}:
                    selected = context["selected_course_id"] if step["course_query"].lower() == "selected" else None
                    matches = repository.find(context["program_id"], step["course_query"], selected)
                    updates["course_matches"] = matches
                    value = matches
                elif name == "get_plan":
                    value = context["plan"]
                else:
                    value = state["web_handoff"]["target_term"]
                    updates["target_term"] = value
                item.update(status="succeeded", context_revision=context["revision"])
                events = event({"events": events}, name, "Read succeeded.")
                messages.extend([AIMessage(content="", tool_calls=[{"name": name, "args": item["arguments"], "id": call_id, "type": "tool_call"}]), ToolMessage(content=json.dumps(value), tool_call_id=call_id)])
            except Exception as exc:
                item["status"] = "failed"
                # Do not leak connection strings, credentials, or provider error bodies.
                error = str(exc) if isinstance(exc, ValueError) else f"{name} failed ({type(exc).__name__}). Check the catalog connection and try again."
                requirements.extend([item, *state["read_requirements"][index + 1:]])
                events = event({"events": events}, name, "Read failed; no retry.")
                return {**updates, "read_requirements": requirements, "error": error, "decision": "respond", "messages": messages, "events": events}
            requirements.append(item)
        return {**updates, "messages": messages, "read_requirements": requirements, "events": events}

    def inspect_results(state):
        if state["error"]:
            return {"decision": "respond"}
        if state["action_index"] >= len(state["steps"]):
            return {"decision": "respond", "events": event(state, "inspect_results", "All requested steps completed.")}
        if not state["read_requirements"]:
            return {"decision": "read_more", "events": event(state, "inspect_results", "Read prerequisites for the next requested action.")}
        if state["steps"][state["action_index"]]["course_query"].lower() == "selected" and not state["app_context"]["selected_course_id"]:
            return {"reply": "Which course do you mean? Open a course or tell me its code before I add it.", "decision": "respond", "pending_clarification": {"kind": "course", "program_id": state["app_context"]["program_id"], "steps": state["steps"][state["action_index"]:]}, "events": event(state, "inspect_results", "No selected course; ask the user.")}
        matches = state["course_matches"]
        if len(matches) != 1:
            text = "No matching course was found in the selected program." if not matches else "Which course do you mean? " + "; ".join(f'{c["code"]}: {c["title"]}' for c in matches)
            return {"reply": text, "decision": "respond", "pending_clarification": {"kind": "course", "program_id": state["app_context"]["program_id"], "steps": state["steps"][state["action_index"]:]}, "events": event(state, "inspect_results", "Course lookup requires clarification.")}
        step, course = state["steps"][state["action_index"]], matches[0]
        if step["kind"] == "find_course":
            return {"reply": f'{course["code"]} — {course["title"]}.', "action_index": state["action_index"] + 1, "read_requirements": [], "decision": "read_more" if state["action_index"] + 1 < len(state["steps"]) else "respond"}
        term = state["target_term"]
        slot = state.get("resolved_slot")
        action = {"action_id": str(uuid4()), "tool_call_id": str(uuid4()), "expected_revision": state["app_context"]["revision"], "kind": step["kind"], "course_id": course["course_id"], "course_code": course["code"], "program_id": course["program_id"]}
        if step["kind"] in PLAN_ACTIONS:
            action.update(target_term=term, semester_slot=slot)
            previous = next((p for p in state["app_context"]["plan"] if p["course_id"] == course["course_id"]), None)
            action["source_semester_slot"] = state.get("resolved_source_slot")
            if step["kind"] == "remove_course_from_plan" and action["source_semester_slot"] is None:
                action["source_semester_slot"] = slot
                if term and action["source_semester_slot"] is None:
                    return {"reply": "Which planner semester represents that term? No course was removed.", "decision": "respond"}
            if previous:
                action["previous_semester_slot"] = previous["semester_slot"]
                action["previous_status"] = previous["status"]
        return {"pending_action": action, "decision": "validate_action", "events": event(state, "inspect_results", f'Proposed {step["kind"]} for {course["code"]}.')}

    def validate_action(state):
        action = state["pending_action"]
        if not action:
            return {"error": "No validated action was proposed.", "decision": "respond"}
        step = state["steps"][state["action_index"]]
        if action.get("semester_slot") != state.get("resolved_slot") and action["kind"] != "open_course":
            return {"error": "The action disagrees with the resolved destination.", "decision": "respond"}
        needs_sections = state.get("target_term") and (state["target_term"]["season"] in {"winter", "summer"} or monitored(state))
        if action["kind"] in {"add_course_to_plan", "move_course_in_plan"} and needs_sections:
            evidence = WebResult.model_validate(state.get("offering_evidence") or {})
            allowed = {"verified", "failed", "not_verified", "not_offered"} if monitored(state) else {"verified"}
            if evidence.kind != "offering" or evidence.status not in allowed or evidence.course_code != action["course_code"] or not evidence.target_term or evidence.target_term.model_dump() != state["target_term"]:
                return {"error": "A matching fresh course-offering check is required.", "decision": "respond"}
        if state["target_term"] and state["app_context"].get("starting_term"):
            term = Term.model_validate(state["target_term"])
            if semester_slot(state["app_context"]["starting_term"], term) != state.get("resolved_slot"):
                return {"error": "The resolved semester no longer matches the profile.", "decision": "respond"}
        required = set(required_reads(state["steps"][state["action_index"]]))
        evidence = {r["tool"]: r for r in state["read_requirements"]}
        if any(r["status"] == "failed" for r in evidence.values()):
            return {"error": "A required read failed. No action was taken.", "decision": "respond"}
        if any(name not in evidence or evidence[name]["status"] != "succeeded" or evidence[name]["context_revision"] != state["app_context"]["revision"] for name in required):
            return {"pending_action": None, "decision": "read_more", "events": event(state, "validate_action", "Missing/stale read evidence: read again.")}
        if len(state["course_matches"]) != 1 or action["course_id"] != state["course_matches"][0]["course_id"] or action["program_id"] != state["app_context"]["program_id"]:
            return {"error": "The course does not match the active program.", "decision": "respond"}
        if action["kind"] == "add_course_to_plan":
            if action["course_id"] in state["app_context"]["completed_course_ids"]:
                return {"reply": f'{action["course_code"]} is marked completed. I have not changed your completion record or plan.', "decision": "respond"}
            if not valid_slot(action.get("semester_slot"), state["app_context"]):
                return {"reply": "Choose an existing planner semester for this term before adding the course.", "decision": "respond"}
            previous = next((p for p in state["app_context"]["plan"] if p["course_id"] == action["course_id"]), None)
            if previous:
                return {"reply": f'{action["course_code"]} is already in {slot_label(previous["semester_slot"])}. I have not moved or duplicated it.', "decision": "respond"}
        if action["kind"] in {"remove_course_from_plan", "move_course_in_plan"}:
            previous = next((p for p in state["app_context"]["plan"] if p["course_id"] == action["course_id"]), None)
            if not previous:
                return {"reply": f'{action["course_code"]} is not in your semester plan. No change was made.', "decision": "respond"}
            source = action.get("source_semester_slot")
            if source is not None and source != previous["semester_slot"]:
                return {"reply": f'{action["course_code"]} is in {slot_label(previous["semester_slot"])}, not {slot_label(source)}. No change was made.', "decision": "respond"}
            if action["kind"] == "move_course_in_plan":
                slot = action.get("semester_slot")
                if not valid_slot(slot, state["app_context"]):
                    return {"reply": "Which planner semester should I move the course to? Specify a destination such as Semester 5.", "decision": "respond"}
                if slot == previous["semester_slot"]:
                    return {"reply": f'{action["course_code"]} is already in {slot_label(slot)}. No change was needed.', "decision": "respond"}
                if action["course_id"] in state["app_context"]["completed_course_ids"]:
                    return {"reply": "This course is marked completed. I have not changed your completion record or plan.", "decision": "respond"}
        return {"decision": "execute_action", "events": event(state, "validate_action", "All required reads and action arguments validated.")}

    def execute_action(state):
        from .kimi_budget import ensure_time
        ensure_time()
        action = state["pending_action"]
        return {"messages": [AIMessage(content="", tool_calls=[{"name": action["kind"], "args": {k: action[k] for k in ["course_id", "semester_slot", "target_term"] if k in action}, "id": action["tool_call_id"], "type": "tool_call"}])], "events": event(state, "execute_action", "Prepared command; waiting for browser execution.")}

    def receive_action_result(state):
        action = state["pending_action"]
        # This node re-enters on resume. No side effects precede interrupt().
        result = interrupt({"action": action})
        if result["action_id"] != action["action_id"] or result["tool_call_id"] != action["tool_call_id"]:
            raise ValueError("Mismatched browser acknowledgement")
        outcome = {**result, "kind": action["kind"], "course_code": action["course_code"], "semester_slot": action.get("semester_slot"), "target_term": action.get("target_term"), "previous_semester_slot": action.get("previous_semester_slot"), "warning": (state.get("offering_evidence") or {}).get("warning", "")}
        if result["status"] == "succeeded":
            before_context, after_context = state["app_context"], result["context"]
            before_others = {p["course_id"]: p for p in before_context["plan"] if p["course_id"] != action["course_id"]}
            after_others = {p["course_id"]: p for p in after_context["plan"] if p["course_id"] != action["course_id"]}
            expected_named = set(before_context.get("named_terms", []))
            if action["kind"] in {"add_course_to_plan", "move_course_in_plan"} and isinstance(action.get("semester_slot"), str):
                expected_named.add(action["semester_slot"])
            if before_others != after_others or before_context["program_id"] != after_context["program_id"] or before_context.get("starting_term") != after_context.get("starting_term") or before_context["semester_count"] != after_context["semester_count"] or set(before_context["completed_course_ids"]) != set(after_context["completed_course_ids"]) or expected_named != set(after_context.get("named_terms", [])):
                outcome.update(status="failed", message="The browser changed unrelated plan, profile or completion data. The requested action was not confirmed.")
        if result["status"] == "succeeded" and action["kind"] == "add_course_to_plan":
            if not any(p["course_id"] == action["course_id"] and p["semester_slot"] == action["semester_slot"] for p in result["context"]["plan"]):
                outcome.update(status="failed", message="The browser plan did not contain the requested course in the requested slot.")
        if result["status"] == "succeeded" and action["kind"] == "open_course" and result["context"]["selected_course_id"] != action["course_id"]:
            outcome.update(status="failed", message="The browser did not confirm the requested course was open.")
        if result["status"] == "succeeded" and action["kind"] in {"remove_course_from_plan", "move_course_in_plan"}:
            actual = [p for p in result["context"]["plan"] if p["course_id"] == action["course_id"]]
            valid = not actual if action["kind"] == "remove_course_from_plan" else len(actual) == 1 and actual[0]["semester_slot"] == action["semester_slot"] and actual[0]["status"] == action["previous_status"]
            before = {p["course_id"]: p for p in state["app_context"]["plan"] if p["course_id"] != action["course_id"]}
            after = {p["course_id"]: p for p in result["context"]["plan"] if p["course_id"] != action["course_id"]}
            if not valid or before != after or set(result["context"]["completed_course_ids"]) != set(state["app_context"]["completed_course_ids"]):
                outcome.update(status="failed", message="The browser did not confirm the requested planner change with other courses and completion records preserved.")
        error = outcome["message"] if outcome["status"] == "failed" else None
        return {"action_result": outcome, "app_context": result["context"], "outcomes": [*state["outcomes"], outcome], "action_index": state["action_index"] + 1, "pending_action": None, "read_requirements": [], "error": error, "messages": [ToolMessage(content=json.dumps({k: v for k, v in outcome.items() if k != "context"}), tool_call_id=action["tool_call_id"])], "events": event(state, "receive_action_result", f'{action["course_code"]}: {outcome["status"]}.')}

    def respond(state):
        lines = []
        for outcome in state["outcomes"]:
            if outcome["status"] == "succeeded":
                if outcome["kind"] == "open_course":
                    lines.append(f'Opened {outcome["course_code"]}.')
                elif outcome["kind"] == "remove_course_from_plan":
                    lines.append(f'Removed {outcome["course_code"]} from {slot_label(outcome["previous_semester_slot"])}.')
                elif outcome["kind"] == "move_course_in_plan":
                    lines.append(f'Moved {outcome["course_code"]} from {slot_label(outcome["previous_semester_slot"])} to {slot_label(outcome["semester_slot"])}.')
                else:
                    term = outcome["target_term"]
                    destination = f'{term["season"].title()} {term["year"]} ({slot_label(outcome["semester_slot"])})' if term and type(outcome["semester_slot"]) is int else slot_label(outcome["semester_slot"])
                    lines.append(f'Added {outcome["course_code"]} to {destination}.')
                if outcome.get("warning"): lines.append(outcome["warning"])
        calendar = (state.get("web_handoff") or {}).get("calendar")
        if calendar and calendar["status"] == "verified":
            current, following = calendar["current_term"], calendar["next_term"]
            lines.insert(0, f"Calendar verified as of {calendar['as_of']} (America/Los_Angeles): current {current['season'].title()} {current['year']}; next {following['season'].title()} {following['year']}.")
        if state["error"]:
            lines.append(state["error"])
            if state["action_index"] < len(state["steps"]):
                lines.append("Remaining actions were not attempted.")
        elif state["reply"]:
            lines.append(state["reply"])
        text = "\n".join(lines) or "What course would you like to find, open, add, remove, or move in your plan?"
        # Completion wording is deterministic so the model cannot invent success.
        return {"reply": text, "messages": [AIMessage(content=text)], "decision": "respond", "events": event(state, "respond", "Returned confirmed outcomes or clarification.")}

    def route_after_selection(state):
        if state["error"] or state["step_count"] > 8:
            return "respond"
        return "read_tools" if state["decision"] == "read_tools" else "respond"

    def route_after_inspection(state):
        if state["error"] or state["step_count"] > 8:
            return "respond"
        return state["decision"] if state["decision"] in {"read_more", "validate_action", "respond"} else "respond"

    def route_after_validation(state):
        return state["decision"] if state["decision"] in {"read_more", "execute_action", "respond"} else "respond"

    def route_after_acknowledgement(state):
        return "respond" if state["error"] else "inspect_results"

    def route_catalog(state):
        if state["error"]: return "respond"
        if len(state["course_matches"]) != 1: return "inspect_results"
        if state["steps"][state["action_index"]]["course_query"].lower() == "selected" and not state["app_context"]["selected_course_id"]: return "inspect_results"
        return "resolve_destination"

    builder = StateGraph(AgentState)
    nodes = {"resolve_destination": resolve_destination, "verify_offering": verify_offering, "load_context": load_context, "select_read_tools": select_read_tools, "execute_read_tools": execute_read_tools, "inspect_results": inspect_results, "validate_action": validate_action, "execute_action": execute_action, "receive_action_result": receive_action_result, "respond": respond}
    for name, function in nodes.items(): builder.add_node(name, function)
    builder.add_edge(START, "load_context")
    builder.add_edge("load_context", "select_read_tools")
    builder.add_conditional_edges("select_read_tools", route_after_selection, {"read_tools": "execute_read_tools", "respond": "respond"})
    builder.add_conditional_edges("execute_read_tools", route_catalog)
    builder.add_conditional_edges("resolve_destination", lambda s: "respond" if s.get("decision") == "respond" else "verify_offering")
    builder.add_conditional_edges("verify_offering", lambda s: "respond" if s.get("decision") == "respond" else "inspect_results")
    builder.add_conditional_edges("inspect_results", route_after_inspection, {"read_more": "select_read_tools", "validate_action": "validate_action", "respond": "respond"})
    builder.add_conditional_edges("validate_action", route_after_validation, {"read_more": "select_read_tools", "execute_action": "execute_action", "respond": "respond"})
    builder.add_edge("execute_action", "receive_action_result")
    builder.add_conditional_edges("receive_action_result", route_after_acknowledgement, {"inspect_results": "inspect_results", "respond": "respond"})
    builder.add_edge("respond", END)
    return builder.compile(checkpointer=checkpointer)
