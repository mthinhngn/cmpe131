"""Kimi's closed task vocabulary. Model proposals are not execution evidence."""
from typing import Literal
from pydantic import Field, model_validator
from .contracts import Contract
from .interpretation import ActionIntent


class HistoryMessage(Contract):
    role: Literal['user', 'assistant']
    content: str = Field(max_length=6000)


class PreferenceSignal(Contract):
    category: Literal['wording', 'source']
    value: str = Field(max_length=50)
    evidence: str = Field(min_length=1, max_length=150)
    polarity: Literal['prefer', 'avoid'] = 'prefer'


class KimiDecision(Contract):
    kind: Literal['answer', 'clarify', 'read', 'research', 'course_action', 'memory']
    reply: str = Field(default='', max_length=3000, description='User-facing response for answer/clarify/memory. Greetings should warmly offer concrete Course Radar help, never merely echo the greeting or return a name. Use only a user-provided name; do not invent one.')
    steps: list[ActionIntent] = Field(default_factory=list, max_length=8)
    group: Literal['none', 'swap', 'replace'] = Field(description='Set swap for exchanging courses, replace for substitution, none otherwise. Atomic operations must use this group with course_queries instead of independent steps.')
    course_queries: list[str] = Field(max_length=2, description='REQUIRED: for swap/replace supply both course codes in request order; otherwise supply []. The executor looks up both courses and their saved slots.')
    resume_pending: bool = Field(default=False, description='Latest reply continues pending clarification. Starting-term resume requires a saved profile; otherwise provide completed remaining steps.')
    query: str = Field(default='', max_length=500)
    # Public-only queries. Never accept model-selected tool names, URLs or code.
    searches: list[str] = Field(default_factory=list, max_length=3)
    research_sources: list[Literal['reddit', 'ratemyprofessors', 'web']] = Field(default_factory=list, max_length=3)
    section_term: str | None = Field(default=None, pattern=r'^(fall|spring)-(19|20|21)\d{2}$')
    section_numbers: list[str] = Field(default_factory=list, max_length=4)
    constraints: list[str] = Field(default_factory=list, max_length=8)
    signals: list[PreferenceSignal] = Field(default_factory=list, max_length=5)
    forget: Literal['none', 'wording', 'source', 'all'] = 'none'

    @model_validator(mode='after')
    def valid_group(self):
        grouped = self.group != 'none'
        selecting = bool(self.section_numbers)
        executing = bool(self.steps) or grouped or selecting
        if self.kind != 'course_action' and executing:
            raise ValueError('Only course_action may contain steps, a group, or section selection')
        if self.kind == 'course_action':
            if not executing and not self.resume_pending:
                raise ValueError('course_action requires steps, a course pair, or section selection')
            if selecting and (grouped or self.steps):
                raise ValueError('Section selection cannot compete with planner actions')
            if selecting and (not self.query.strip() or not self.section_term):
                raise ValueError('Section selection requires a course query and section term')
            if not selecting and (self.query or self.section_term):
                raise ValueError('Planner actions use course_queries or steps, not section/query fields')
        if self.kind in ('read', 'research') and not self.query.strip():
            raise ValueError('Reads and research require a query')
        if self.kind == 'research' and not self.section_term:
            raise ValueError('Instructor research requires an explicit section term')
        if self.kind in ('answer', 'clarify', 'memory') and not self.reply.strip():
            raise ValueError('A response requires user-facing reply text')
        if self.kind not in ('read', 'research', 'course_action') and (self.query or self.section_term):
            raise ValueError('A response cannot contain an ignored read request')
        if self.searches or (self.research_sources and self.kind != 'research'):
            raise ValueError('Use research_sources on research; application code constructs public searches')
        if self.kind != 'course_action' and self.resume_pending:
            raise ValueError('Only course_action may resume unfinished actions')
        if self.group == 'swap' and len(self.course_queries) != 2 and (len(self.steps) != 2 or any(s.kind != 'move_course_in_plan' for s in self.steps)):
            raise ValueError('A swap requires two moves')
        if self.group == 'replace' and len(self.course_queries) != 2 and (len(self.steps) != 2 or [s.kind for s in self.steps] != ['remove_course_from_plan', 'add_course_to_plan']):
            raise ValueError('A replacement requires remove then add')
        if self.course_queries and (self.group == 'none' or self.steps):
            raise ValueError('Course pairs require a group and cannot compete with explicit steps')
        return self


class KimiHistory(Contract):
    history: list[HistoryMessage] = Field(default_factory=list, max_length=24)
    preferences: dict = Field(default_factory=dict)
