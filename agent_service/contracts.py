"""Validate browser input before it enters a graph or resumes an action."""

from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


PlanSlot = Annotated[int, Field(strict=True, ge=1, le=100)] | Annotated[str, Field(pattern=r"^(winter|summer)-(19|20|21)\d{2}$")]


class PlanEntryInput(Contract):
    course_id: str = Field(min_length=1, max_length=120)
    semester_slot: PlanSlot
    status: Literal["planned", "in-progress"]


class BrowserContext(Contract):
    capabilities: list[Literal['apply_plan_changes', 'set_course_sections']] = Field(default_factory=list, max_length=2)
    selected_sections: dict[str, list[str]] = Field(default_factory=dict, max_length=30)
    additional_program_ids: list[Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)]] = Field(default_factory=list, max_length=10)
    program_id: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    page: str = Field(max_length=500)
    selected_course_id: str | None = Field(default=None, max_length=120)
    completed_course_ids: list[str] = Field(default_factory=list, max_length=500)
    plan: list[PlanEntryInput] = Field(default_factory=list, max_length=500)
    term_to_slot: dict[str, int] = Field(default_factory=dict, max_length=100)
    revision: str = Field(min_length=1, max_length=30000)
    semester_count: int = Field(ge=0, le=100)
    semester_slots: list[Annotated[int, Field(strict=True, ge=1, le=100)]] | None = Field(default=None, max_length=100)
    starting_term: str | None = Field(default=None, pattern=r"^(winter|spring|summer|fall)-(19|20|21)\d{2}$")
    named_terms: list[Annotated[str, Field(pattern=r"^(winter|summer)-(19|20|21)\d{2}$")]] = Field(default_factory=list, max_length=100)


class HistoryInput(Contract):
    role: Literal['user', 'assistant']
    content: str = Field(max_length=6000)


class MessageInput(Contract):
    history: list[HistoryInput] = Field(default_factory=list, max_length=24)
    preferences: dict = Field(default_factory=dict)
    thread_id: str = Field(min_length=16, max_length=120)
    request_id: str = Field(min_length=16, max_length=120)
    message: str = Field(min_length=1, max_length=4000)
    context: BrowserContext


class ContextInput(Contract):
    thread_id: str = Field(min_length=16, max_length=120)
    context: BrowserContext


class ActionInput(ContextInput):
    request_id: str = Field(min_length=16, max_length=120)
    action_id: str = Field(min_length=1, max_length=120)
    tool_call_id: str = Field(min_length=1, max_length=120)
    status: Literal["succeeded", "failed"]
    code: str = Field(min_length=1, max_length=100)
    message: str = Field(max_length=1000)


class RequestedStep(Contract):
    kind: Literal["open_course", "add_course_to_plan", "remove_course_from_plan", "move_course_in_plan", "find_course"]
    course_query: str = Field(description="Course code/title, or 'selected' for this course.", max_length=200)
    term: str | None = Field(default=None, description="Explicit season/year or 'next'.")
    semester_slot: int | None = Field(default=None, ge=1, le=100, description="The explicit numbered DESTINATION for add/move. 'Move from Semester 2 to Semester 5' means 5. Use null when a calendar term is supplied or the numbered destination is unspecified.")
    source_semester_slot: int | None = Field(default=None, ge=1, le=100, description="For remove/move only: the explicitly named source semester. Never the destination.")
    source_term: str | None = Field(default=None, description="For moves only: explicitly named source calendar term or current/next. The term field remains the destination. Null if no source term is supplied.", max_length=80)
    read_tools: list[Literal["find_course", "get_course", "get_plan", "resolve_term"]] = Field(default_factory=list)


class RequestPlan(Contract):
    steps: list[RequestedStep] = Field(default_factory=list, max_length=8)
    requires_web_research: bool = Field(default=False, description="True for unsupported deadline/policy/prerequisite research. Ordinary current/next term and whether a course is offered are supported; do not set this flag for them.")
    clarification: str | None = Field(default=None, description="Question/answer if no actionable course request can be resolved.", max_length=1500)
