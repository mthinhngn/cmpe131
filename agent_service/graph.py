"""Coordinator: Course Action delegates conditional calendar and required offering lookups to the separate Web Search graph."""

import os
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langgraph.checkpoint.memory import InMemorySaver
from .agent import AgentState
from .course_action_agent import create_course_action_agent, MODEL_ID
from .web_search_agent import create_web_search_agent
from .calendar_cache import CachedWebAgent

OPENAI_MODEL_ID = os.getenv('KIMI_OPENAI_MODEL', 'gpt-4.1')


def create_graph(repository, model=None, web_agent=None, today=None):
    model = model if model is not None else ChatGroq(model=MODEL_ID, temperature=0, max_retries=0, timeout=35, max_tokens=1500)
    web_agent = web_agent if web_agent is not None else CachedWebAgent(create_web_search_agent())
    # Keep the action transport at the root checkpoint so suspended action state
    # remains visible to the HTTP adapter. Web Search has its own private graph.
    return create_course_action_agent(repository, model, web_agent, checkpointer=InMemorySaver(), **({"today": today} if today else {}))


def request_state(message, context):
    return {"messages": [HumanMessage(content=message)], "app_context": context, "current_term": None, "target_term": None, "web_handoff": None, "offering_evidence": None, "resolved_slot": None, "resolved_source_slot": None, "course_matches": [], "pending_action": None, "action_result": None, "step_count": 0, "decision": None, "read_requirements": [], "steps": [], "action_index": 0, "outcomes": [], "reply": "", "error": None, "events": []}


def create_runtime_graph(repository, transcript=None):
    from .kimi_agent import create_kimi_graph
    from .advisor_loop import AdvisorLoop
    from .availability import Availability
    from .catalog_rag import CatalogRAG
    from .research_agent import ResearchAgent
    from .verifier import Verdict, ActionAuthorization
    model = ChatOpenAI(model=OPENAI_MODEL_ID, temperature=0, max_retries=0, timeout=35, max_tokens=2500, api_key=os.getenv('OPENAI_API_KEY'), base_url='https://api.openai.com/v1')
    action_model = ChatGroq(model=MODEL_ID, temperature=0, max_retries=0, timeout=35, max_tokens=1500)
    small = ChatOpenAI(model=os.getenv('KIMI_SMALL_MODEL', 'gpt-4.1-mini'), temperature=0, max_retries=0, timeout=25, max_tokens=2000, api_key=os.getenv('OPENAI_API_KEY'), base_url='https://api.openai.com/v1')
    web = CachedWebAgent(create_web_search_agent())
    advisor = AdvisorLoop(model, Availability(repository), web, catalog=CatalogRAG(), transcript=transcript,
                          reviews=ResearchAgent(model=small), judge=small.with_structured_output(Verdict, method='function_calling'),
                          intent_judge=small.with_structured_output(ActionAuthorization, method='function_calling'))
    return create_kimi_graph(repository, model, web, action_model=action_model, advisor=advisor)
