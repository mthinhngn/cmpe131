"""Coordinator: Course Action delegates conditional calendar and required offering lookups to the separate Web Search graph."""

from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq
from langgraph.checkpoint.memory import InMemorySaver
from .agent import AgentState
from .course_action_agent import create_course_action_agent, MODEL_ID
from .web_search_agent import create_web_search_agent
from .calendar_cache import CachedWebAgent


def create_graph(repository, model=None, web_agent=None, today=None):
    model = model if model is not None else ChatGroq(model=MODEL_ID, temperature=0, max_retries=0, timeout=35, max_tokens=1500)
    web_agent = web_agent if web_agent is not None else CachedWebAgent(create_web_search_agent())
    # Keep the action transport at the root checkpoint so suspended action state
    # remains visible to the HTTP adapter. Web Search has its own private graph.
    return create_course_action_agent(repository, model, web_agent, checkpointer=InMemorySaver(), **({"today": today} if today else {}))


def request_state(message, context):
    return {"messages": [HumanMessage(content=message)], "app_context": context, "current_term": None, "target_term": None, "web_handoff": None, "offering_evidence": None, "resolved_slot": None, "resolved_source_slot": None, "course_matches": [], "pending_action": None, "action_result": None, "step_count": 0, "decision": None, "read_requirements": [], "steps": [], "action_index": 0, "outcomes": [], "reply": "", "error": None, "events": []}


def create_runtime_graph(repository):
    from .kimi_agent import create_kimi_graph
    model = ChatGroq(model=MODEL_ID, temperature=0, max_retries=0, timeout=35, max_tokens=2500)
    return create_kimi_graph(repository, model, CachedWebAgent(create_web_search_agent()))
