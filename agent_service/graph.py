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
from .web_search_agent import local_today

OPENAI_MODEL_ID = os.getenv('KIMI_OPENAI_MODEL', 'gpt-4.1')


def create_graph(repository, model=None, web_agent=None, today=None):
    model = model if model is not None else ChatGroq(model=MODEL_ID, temperature=0, max_retries=0, timeout=35, max_tokens=1500)
    web_agent = web_agent if web_agent is not None else CachedWebAgent(create_web_search_agent())
    # Keep the action transport at the root checkpoint so suspended action state
    # remains visible to the HTTP adapter. Web Search has its own private graph.
    return create_course_action_agent(repository, model, web_agent, checkpointer=InMemorySaver(), **({"today": today} if today else {}))


def request_state(message, context):
    return {"messages": [HumanMessage(content=message)], "app_context": context, "current_term": None, "target_term": None, "web_handoff": None, "offering_evidence": None, "resolved_slot": None, "resolved_source_slot": None, "course_matches": [], "pending_action": None, "action_result": None, "step_count": 0, "decision": None, "read_requirements": [], "steps": [], "action_index": 0, "outcomes": [], "reply": "", "error": None, "events": []}


def turn_state(message, context, *, history=(), preferences=None, owner=''):
    state = request_state(message, context)
    state.update(kimi_count=0, kimi_observations=[], kimi_decision={}, kimi_history=list(history),
                 kimi_preferences=preferences or {}, verified_owner=owner, evidence=[], citations=[], advisor_metrics={})
    return state


def build_advisor(model, small, availability, web, *, catalog=None, transcript=None, reviews=None, today=local_today, ratings=None, direct_requirements=False, structured_requirements=False):
    from .advisor_loop import AdvisorLoop
    from .verifier import AnswerVerdict, ActionAuthorization
    from .understanding import understand, RequestUnderstanding
    understanding_judge = small.with_structured_output(RequestUnderstanding, method='function_calling')
    runtime_options = {'structured_requirements': True} if structured_requirements else {}
    advisor = AdvisorLoop(model, availability, web, catalog=catalog, transcript=transcript, reviews=reviews,
                       judge=small.with_structured_output(AnswerVerdict, method='function_calling'),
                       intent_judge=small.with_structured_output(ActionAuthorization, method='function_calling'), today=today, ratings=ratings,
                       **runtime_options)
    advisor.direct_requirements = direct_requirements
    advisor.understander = lambda message, recent, opened: understand(message, recent, opened, understanding_judge)
    return advisor


def create_runtime_graph(repository, transcript=None):
    from .kimi_agent import create_kimi_graph
    from .availability import Availability
    from .catalog_rag import CatalogRAG
    from .research_agent import ResearchAgent
    from .professor_ratings import professor_ratings
    from .verifier import ClaimLabels
    model = ChatOpenAI(model=OPENAI_MODEL_ID, temperature=0, max_retries=0, timeout=35, max_tokens=2500, api_key=os.getenv('OPENAI_API_KEY'), base_url='https://api.openai.com/v1')
    action_model = ChatGroq(model=MODEL_ID, temperature=0, max_retries=0, timeout=35, max_tokens=1500)
    small = ChatOpenAI(model=os.getenv('KIMI_SMALL_MODEL', 'gpt-4.1-mini'), temperature=0, max_retries=0, timeout=25, max_tokens=2000, api_key=os.getenv('OPENAI_API_KEY'), base_url='https://api.openai.com/v1')
    web = CachedWebAgent(create_web_search_agent())
    advisor = build_advisor(model, small, Availability(repository), web, catalog=CatalogRAG(),
                            transcript=transcript, reviews=ResearchAgent(model=small), ratings=professor_ratings,
                            direct_requirements=True, structured_requirements=True)
    advisor.claim_judge = small.with_structured_output(ClaimLabels, method='function_calling')
    return create_kimi_graph(repository, model, web, action_model=action_model, advisor=advisor)
