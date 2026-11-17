"""Local HTTP service with RAM checkpoints and one FIFO per conversation."""

import hashlib
import logging
import os
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext, asynccontextmanager
from pathlib import Path
from threading import RLock
from uuid import uuid4
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / '.env', encoding='utf-8-sig')
from fastapi import FastAPI, HTTPException, Query, Request, Response
from langgraph.types import Command
from .catalog import CatalogRepository
from .contracts import MessageInput, ActionInput, ContextInput
from .graph import create_graph, create_runtime_graph, request_state, turn_state, OPENAI_MODEL_ID
from .kimi_budget import Budget, active_budget
from .kimi_contracts import KimiHistory, KimiDecision
from .memory_repository import PostgresMemory, learn
from .identity import owner as resolve_owner
from .telemetry import trace_event, enable
from .transcripts import TranscriptService
from .transcript_routes import transcript_router
from .evidence import progress_callback

transcript_service = TranscriptService(CatalogRepository())

load_dotenv(Path(__file__).resolve().parents[1] / ".env", encoding="utf-8-sig")
log = logging.getLogger("course-radar-agent")


class RequestManager:
    def __init__(self, graph, tracing=False, memory=None):
        self.graph = graph
        self.lock = RLock()
        self.pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="course-agent")
        self.requests = {}
        self.conversations = {}
        self.tracing = tracing
        self.memory = memory
        self.thread_owners = {}
        self.guest_profiles = {}

    def public(self, record):
        return {key: record.get(key) for key in ["request_id", "status", "reply", "action", "events", "trace_id", "web_handoff", "clarification", "preferences", "memory_status", "citations", "advisor_metrics"]}

    def authorize(self, thread_id, owner):
        with self.lock:
            current = self.thread_owners.get(thread_id)
            if current is not None and current != owner:
                raise HTTPException(404, 'Conversation not found')
            self.thread_owners[thread_id] = owner

    def initial_state(self, record, context):
        if record.get('owner', '').startswith('guest:'):
            record['preferences'] = self.guest_profiles.get(record['owner'], record.get('preferences', {}))
        return turn_state(record['message'], context, history=record.get('history', []),
                          preferences=record.get('preferences', {}), owner=record.get('owner', ''))

    def owned(self, request_id, thread_id):
        record = self.requests.get(request_id)
        if not record or record["thread_id"] != thread_id:
            raise HTTPException(404, "This request is missing or expired. Start a new conversation after a server restart.")
        return record

    def submit(self, data, owner='legacy'):
        with self.lock:
            self.authorize(data.thread_id, owner)
            if data.request_id in self.requests:
                record = self.owned(data.request_id, data.thread_id)
                if record["message"] != data.message:
                    raise HTTPException(409, "Request ID was already used for a different message.")
                return self.public(record)
            if len(self.requests) >= 1000:
                raise HTTPException(503, "Local session capacity reached. Restart the agent service to clear RAM sessions.")
            conversation = self.conversations.setdefault(data.thread_id, {"active": None, "queue": deque()})
            if len(conversation["queue"]) >= 20:
                raise HTTPException(429, "This conversation already has 20 queued requests.")
            record = {"request_id": data.request_id, "thread_id": data.thread_id, "message": data.message, "status": "queued", "reply": "", "action": None, "events": [], "trace_id": hashlib.sha256(data.request_id.encode()).hexdigest()[:32], "acknowledged": set()}
            supplied = KimiHistory(history=[h.model_dump() for h in data.history], preferences=data.preferences)
            saved = self.memory.load(owner, data.thread_id) if owner.startswith('account:') and self.memory else supplied.model_dump()
            if owner.startswith('account:') and self.memory:
                self.memory.begin(owner, data.thread_id, data.request_id, data.message)
            self.requests[data.request_id] = record
            record.update(owner=owner, history=saved['history'], preferences=saved['preferences'], budget=Budget())
            if owner.startswith('guest:'):
                self.guest_profiles.setdefault(owner, saved['preferences'])
            trace_event("request.accepted", "Accepted user request.", trace_id=record["trace_id"], metadata={"thread_id": data.thread_id, "request_id": data.request_id})
            if conversation["active"] is None:
                conversation["active"] = data.request_id
                record["status"] = "running"
                self.pool.submit(self.advance, record, self.initial_state(record, data.context.model_dump()))
            else:
                conversation["queue"].append(data.request_id)
                record["events"].append({"node": "queue", "detail": "Queued behind the active request."})
                trace_event("queue.accepted", "Waiting in FIFO queue.", trace_id=record["trace_id"])
            return self.public(record)

    def context(self, request_id, data):
        with self.lock:
            record = self.owned(request_id, data.thread_id)
            if record["status"] != "needs_context":
                return self.public(record)
            record["status"] = "running"
            trace_event("queue.fresh_context", "Fresh browser context received before dequeue execution.", trace_id=record["trace_id"])
            if record['owner'].startswith('account:') and self.memory:
                record.update(self.memory.load(record['owner'], record['thread_id']))
            self.pool.submit(self.advance, record, self.initial_state(record, data.context.model_dump()))
            return self.public(record)

    def acknowledge(self, data):
        with self.lock:
            record = self.owned(data.request_id, data.thread_id)
            if data.action_id in record["acknowledged"]:
                return self.public(record)
            action = record["action"]
            if record["status"] != "awaiting_action" or not action or action["action_id"] != data.action_id or action["tool_call_id"] != data.tool_call_id:
                raise HTTPException(409, "This acknowledgement does not match the pending action.")
            record["acknowledged"].add(data.action_id)
            trace_event("http.acknowledgement", f"Browser outcome: {data.status}.", trace_id=record["trace_id"], metadata={"action_id": data.action_id, "request_id": data.request_id})
            record.update(status="running", action=None)
            result = data.model_dump(exclude={"thread_id", "request_id"})
            self.pool.submit(self.advance, record, Command(resume=result))
            return self.public(record)

    def advance(self, record, value):
        budget = record.get('budget', Budget()).start()
        budget_token = active_budget.set(budget)
        def progress(entry):
            with self.lock:
                record['events'] = [*record['events'], entry]
        progress_token = progress_callback.set(progress)
        started = time.monotonic()
        output = {}
        config = {"configurable": {"thread_id": record["thread_id"]}, "recursion_limit": 100, "metadata": {"request_id": record["request_id"], "langfuse_session_id": record["thread_id"]}}
        if isinstance(value, Command):
            config["metadata"]["action_id"] = value.resume["action_id"]
        scope = nullcontext()
        if self.tracing:
            try:
                from langfuse import get_client
                # Graph/model callbacks include student context and transcript passages.
                # Keep production traces to explicit metadata-only events; experiment data is synthetic/public.
                scope = get_client().start_as_current_observation(name="course-radar-request", trace_context={"trace_id": record["trace_id"]}, metadata={"request_id": record["request_id"], "thread_id": record["thread_id"]})
            except Exception:
                log.warning("Tracing configuration unavailable; execution will continue without it.")
                config.pop("callbacks", None)
                scope = nullcontext()
        # Telemetry scope failures must never re-execute the graph.
        try:
            scope.__enter__()
        except Exception:
            scope = nullcontext()
            scope.__enter__()
            config.pop("callbacks", None)
        try:
            output = self.graph.invoke(value, config=config)
            with self.lock:
                record["events"] = output.get("events", [])
                record['citations'] = output.get('citations', [])
                record['advisor_metrics'] = output.get('advisor_metrics', {})
                record["web_handoff"] = output.get("web_handoff")
                record["clarification"] = (output.get("pending_clarification") or {}).get("kind")
                interrupted = output.get("__interrupt__")
                if interrupted:
                    record.update(status="awaiting_action", action=interrupted[0].value["action"])
                    trace_event("http.awaiting_action", "Graph paused until the browser reports an outcome.", trace_id=record["trace_id"], metadata={"action_id": record["action"]["action_id"]})
                    return
                record.update(status="completed" if not output.get("error") else "failed", reply=output.get("reply", "Request complete."), action=None)
                try:
                    decision = output.get('kimi_decision')
                    if decision and decision.get('kind'):
                        parsed = KimiDecision.model_validate(decision)
                        if record.get('owner', '').startswith('account:') and self.memory:
                            record['preferences'] = self.memory.save(record['owner'], record['thread_id'], record['request_id'], record['message'], record['reply'], parsed.signals, parsed.forget)
                            record['memory_status'] = 'saved'
                        else:
                            record['preferences'] = learn(self.guest_profiles.get(record.get('owner'), record.get('preferences', {})), record['request_id'], record['message'], parsed.signals, parsed.forget)
                            if record.get('owner', '').startswith('guest:'):
                                self.guest_profiles[record['owner']] = record['preferences']
                            record['memory_status'] = 'browser_save_required'
                except Exception:
                    record['memory_status'] = 'failed'
                    record['reply'] += '\nConversation memory could not be saved; no action was retried.'
                self.next_request(record)
        except Exception as exc:
            # Do not expose model/provider error payloads or database credentials.
            log.warning("Agent run failed (%s).", type(exc).__name__)
            with self.lock:
                message = "The AI provider's rate limit was reached. Please wait a minute, then send the request again. No automatic retry was made." if type(exc).__name__ == "RateLimitError" else f"The agent could not complete this request ({type(exc).__name__}). Check the local service connection and try again."
                record.update(status="failed", reply=message, action=None)
                self.next_request(record)
        finally:
            if not isinstance(value, Command):
                metrics = output.get('advisor_metrics', {})
                trace_event('kimi.turn', 'Turn completed.', trace_id=record['trace_id'], metadata={
                    'request_id': record['request_id'], 'thread_id': record['thread_id'],
                    'needs': metrics.get('needs', []), 'reply_to_open': metrics.get('reply_to_open', 'none'),
                    'ended_by': 'action' if output.get('__interrupt__') else output.get('kimi_decision', {}).get('kind', 'error'),
                    'missing': (output.get('pending_clarification') or {}).get('missing'),
                    'model_rounds': metrics.get('model_rounds', 0), 'tool_calls': metrics.get('tool_calls', 0),
                    'mutation_proposals': metrics.get('mutation_proposals', 0),
                    'latency_ms': round((time.monotonic() - started) * 1000),
                    'steps': [e['node'] for e in output.get('events', []) if e.get('node', '').startswith('kimi.')],
                })
            budget.seconds = max(0, budget.seconds - (time.monotonic() - started))
            active_budget.reset(budget_token)
            progress_callback.reset(progress_token)
            try:
                scope.__exit__(None, None, None)
            except Exception:
                log.warning("Trace delivery failed; graph was not retried.")

    def next_request(self, record):
        conversation = self.conversations[record["thread_id"]]
        conversation["active"] = None
        if conversation["queue"]:
            next_id = conversation["queue"].popleft()
            conversation["active"] = next_id
            self.requests[next_id]["status"] = "needs_context"
            trace_event("queue.dequeued", "Waiting for a fresh browser snapshot.", trace_id=self.requests[next_id]["trace_id"])


manager = None


@asynccontextmanager
async def lifespan(app):
    global manager
    memory = PostgresMemory()
    if os.getenv('KIMI_AUTH_URL'):
        memory.initialize()
        transcript_service.initialize()
    if os.getenv('LANGFUSE_PUBLIC_KEY') and os.getenv('LANGFUSE_SECRET_KEY'):
        enable()
    manager = RequestManager(create_runtime_graph(CatalogRepository(), transcript=transcript_service), tracing=bool(os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY")), memory=memory)
    yield
    manager.pool.shutdown(wait=False, cancel_futures=True)
    if manager.tracing:
        from langfuse import get_client
        get_client().flush()


app = FastAPI(title="Course Radar LangGraph", lifespan=lifespan)
app.include_router(transcript_router(transcript_service))

PUBLIC_PREFIX = '/api/v1'


class PublicPrefix:
    """Serve /api/v1/agent/* as /agent/* when a host rewrite keeps the public path (Vercel).

    Mirrors the Vite dev proxy: strip the prefix on the way in and move /agent cookies
    under /api/v1/agent on the way out, so the browser sends them back.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get('path', '') if scope['type'] == 'http' else ''
        if not path.startswith(PUBLIC_PREFIX + '/agent'):
            return await self.app(scope, receive, send)
        scope = {**scope, 'path': path[len(PUBLIC_PREFIX):], 'raw_path': scope.get('raw_path', b'')[len(PUBLIC_PREFIX):]}

        async def public_send(message):
            if message['type'] == 'http.response.start':
                message = {**message, 'headers': [
                    (k, v.replace(b'Path=/agent', b'Path=' + PUBLIC_PREFIX.encode() + b'/agent')) if k.lower() == b'set-cookie' else (k, v)
                    for k, v in message.get('headers', [])]}
            await send(message)

        await self.app(scope, receive, public_send)


@app.middleware('http')
async def origin_guard(request, call_next):
    allowed = os.getenv('WEB_ORIGIN', 'http://localhost:5175,http://127.0.0.1:5175,http://localhost:5173,http://127.0.0.1:5173').split(',')
    if request.method not in ('GET', 'HEAD', 'OPTIONS') and request.headers.get('origin') and request.headers['origin'] not in allowed:
        from fastapi.responses import JSONResponse
        return JSONResponse({'detail': 'Unapproved website origin'}, status_code=403)
    return await call_next(request)


@app.post('/agent/session')
def session(request: Request, response: Response):
    identity = resolve_owner(request, response)
    return {'kind': 'account' if identity.startswith('account:') else 'guest', 'namespace': hashlib.sha256(identity.encode()).hexdigest(),
            'latest_thread_id': manager.memory.latest_thread(identity) if identity.startswith('account:') and manager.memory else None}


@app.get('/agent/memory/{thread_id}')
def memory_history(thread_id: str, request: Request):
    identity = resolve_owner(request)
    manager.authorize(thread_id, identity)
    if not identity.startswith('account:'):
        return {'history': [], 'preferences': {}, 'storage': 'browser'}
    return {**manager.memory.load(identity, thread_id), 'storage': 'account'}

@app.get("/agent/schedule/terms")
def schedule_terms():
    from .calendar_cache import read_calendar
    return read_calendar()


@app.get("/agent/schedule/sections")
def schedule_sections(term: str = Query(pattern=r"^(fall|spring)-(19|20|21)\d{2}$")):
    from .schedule_data import read_sections
    return read_sections(term)


@app.get("/agent/health")
def health():
    return {"status": "ok", "provider": "openai", "model": OPENAI_MODEL_ID, "openai_configured": bool(os.getenv("OPENAI_API_KEY")), "groq_configured": bool(os.getenv("GROQ_API_KEY")), "web_search_configured": bool(os.getenv("TAVILY_API_KEY")), "agents": ["kimi", "web_search", "course_action"], "account_memory_configured": bool(os.getenv('KIMI_AUTH_URL')), "tracing": "configured" if manager.tracing else "not_configured", "instance_id": INSTANCE_ID}


INSTANCE_ID = str(uuid4())


@app.post("/agent/messages", status_code=202)
def messages(data: MessageInput, request: Request, response: Response):
    return manager.submit(data, resolve_owner(request, response))


@app.get("/agent/requests/{request_id}")
def request_status(request_id: str, request: Request, thread_id: str = Query(min_length=16, max_length=120)):
    with manager.lock:
        manager.authorize(thread_id, resolve_owner(request))
        return manager.public(manager.owned(request_id, thread_id))


@app.post("/agent/requests/{request_id}/context")
def context(request_id: str, data: ContextInput, request: Request):
    manager.authorize(data.thread_id, resolve_owner(request))
    return manager.context(request_id, data)


@app.post("/agent/action-results")
def action_results(data: ActionInput, request: Request):
    manager.authorize(data.thread_id, resolve_owner(request))
    return manager.acknowledge(data)


@app.get("/agent/graph")
def graph_view():
    from .web_search_agent import create_web_search_agent
    return {"mermaid": manager.graph.get_graph(xray=True).draw_mermaid(), "web_search_mermaid": create_web_search_agent().get_graph().draw_mermaid()}


# Production entrypoint (agent_service/Dockerfile); local `uvicorn agent_service.server:app` is unchanged.
asgi = PublicPrefix(app)
