"""One budget shared by Kimi and specialist calls in a request."""
import time
from contextvars import ContextVar
from dataclasses import dataclass

active_budget = ContextVar('kimi_budget', default=None)


@dataclass
class Budget:
    searches: int = 3
    fetches: int = 6
    decisions: int = 6
    seconds: float = 90
    deadline: float = 0

    def start(self):
        self.deadline = time.monotonic() + self.seconds
        return self

    def spend(self, kind):
        if time.monotonic() >= self.deadline or getattr(self, kind) <= 0:
            raise ValueError('Request budget exhausted; no further actions were attempted.')
        setattr(self, kind, getattr(self, kind) - 1)


def charge(kind, deadline):
    budget = active_budget.get()
    if budget:
        budget.spend(kind)
        return min(deadline, budget.deadline)
    return deadline


def ensure_time():
    budget = active_budget.get()
    if budget and time.monotonic() >= budget.deadline:
        raise ValueError('Request budget exhausted; no further actions were attempted.')
