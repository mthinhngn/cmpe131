"""Private Web Search state and the validated handoff to Course Action."""

from datetime import date
from typing import Literal, TypedDict
from pydantic import Field, model_validator
from .contracts import Contract

SEASONS = ("winter", "spring", "summer", "fall")


class Term(Contract):
    season: Literal["winter", "spring", "summer", "fall"]
    year: int = Field(ge=1900, le=2200)

    @property
    def id(self):
        return f"{self.season}-{self.year}"

    @property
    def index(self):
        return self.year * 4 + SEASONS.index(self.season)

    def academic(self, source="web"):
        return {"id": self.id, "season": self.season, "year": self.year, "source": source}


def parse_term(value):
    import re
    match = re.fullmatch(r"(winter|spring|summer|fall)[\s-]+(\d{4})", (value or "").strip().lower())
    if not match:
        raise ValueError("Specify a term such as Summer 2025.")
    return Term(season=match[1], year=int(match[2]))


def next_term(term):
    return Term(season="spring", year=term.year + 1) if term.season == "fall" else Term(season="fall", year=term.year)


def regular_start(starting_term):
    term = parse_term(starting_term)
    return Term(season={"winter": "spring", "summer": "fall"}.get(term.season, term.season), year=term.year)


def semester_slot(starting_term, target):
    if target.season in {"winter", "summer"}:
        return target.id
    start = regular_start(starting_term)
    return 1 + 2 * (target.year - start.year) + int(target.season == "fall") - int(start.season == "fall")


def slot_term(starting_term, slot):
    start = regular_start(starting_term)
    index = start.year * 2 + int(start.season == "fall") + slot - 1
    return Term(season="fall" if index % 2 else "spring", year=index // 2)


def slot_label(slot):
    return f"Semester {slot}" if type(slot) is int else (slot or "").replace("-", " ").title()


class CalendarPeriod(Term):
    start: date
    end: date
    source_id: str
    term_quote: str = Field(min_length=4, max_length=1000)
    start_quote: str = Field(min_length=4, max_length=1500)
    end_quote: str = Field(min_length=4, max_length=1500)

    @model_validator(mode="after")
    def ordered(self):
        start_year_valid = self.start.year == self.year or (
            self.season == "winter" and self.start.year == self.year - 1 and self.start.month == 12
        )
        if self.end < self.start or not start_year_valid or self.end.year != self.year or (self.end - self.start).days > 200:
            raise ValueError("Invalid term teaching period.")
        return self


class CalendarExtraction(Contract):
    periods: list[CalendarPeriod] = Field(default_factory=list, max_length=20)


class Citation(Contract):
    source_id: str
    title: str
    url: str
    retrieved_at: str
    content_hash: str


class WebResult(Contract):
    kind: Literal["calendar", "offering"]
    status: Literal["verified", "not_offered", "not_verified", "failed"]
    as_of: date
    citations: list[Citation] = Field(default_factory=list)
    current_term: Term | None = None
    next_term: Term | None = None
    valid_until: date | None = None
    periods: list[CalendarPeriod] = Field(default_factory=list, max_length=20)
    target_term: Term | None = None
    course_code: str | None = None
    sections: list[dict] = Field(default_factory=list, max_length=200)
    warning: str = ""
    message: str = ""
    error_code: str | None = None

    @model_validator(mode="after")
    def grounded(self):
        if self.status in {"verified", "not_offered"} and not self.citations:
            raise ValueError("Verified web evidence requires fetched-source citations.")
        if self.status == "verified":
            if self.kind == "calendar" and (not self.current_term or not self.next_term or not self.valid_until or not self.periods):
                raise ValueError("Calendar result lacks teaching-period evidence.")
            if self.kind == "offering" and (not self.target_term or not self.course_code or not self.sections):
                raise ValueError("Offering result lacks exact course/term sections.")
        return self


class WebSearchState(TypedDict, total=False):
    kind: str
    course_code: str
    as_of: str
    deadline: float
    round: int
    query: str
    candidates: list[dict]
    sources: list[dict]
    periods: list[dict]
    fetched_urls: list[str]
    current_term: dict | None
    target_term: str | None
    decision: str
    status: str
    message: str
    error_code: str | None
    events: list[dict]
    result: dict
