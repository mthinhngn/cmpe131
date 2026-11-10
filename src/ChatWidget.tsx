import { useSchedule } from "./ScheduleContext";
import { ChatSectionChoice } from "./ChatSectionChoice";
import { TypingPlaceholder } from "./TypingPlaceholder";
import { useChatPrompts } from "./chat-prompts";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUp, BookOpen, CalendarMinus, CalendarPlus, ChevronDown, SquarePen } from "lucide-react";
import { useCatalog } from "./CatalogContext";
import { CourseDetail } from "./CourseDetail";
import { AgentError, agentFetch, agentSession, contextRevision, type AgentContext, type AgentRequest, type BrowserAction, type ConversationItem, type Receipt, type AgentSession } from "./agent-client";

import { readConversation, saveConversation, readReceipt, reserveAction, saveReceipt, restoredItems, accountItems } from "./kimi-memory";
import type { Course } from "./types";
import "./chat-widget.css";

/** The single assistant surface; both agents use the same browser action transport. */
export function ChatWidget() {
  const prompts = useChatPrompts();
  const catalog = useCatalog();
  const schedule = useSchedule();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<"compact" | "conversation">("compact");
  const open = state === "conversation";
  const setOpen = (value: boolean) => setState(value ? "conversation" : "compact");
  const [keyboard, setKeyboard] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [health, setHealth] = useState<{ model: string; tracing: string; instance_id?: string } | null>(null);
  const [memoryReady, setMemoryReady] = useState(false);
  const session = useRef<AgentSession | null>(null);
  const preferences = useRef<Record<string, unknown>>({});
  const generation = useRef(0);
  const writes = useRef(Promise.resolve());
  const [openedCourse, setOpenedCourse] = useState<Course | null>(null);
  const [threadId, setThreadId] = useState<string>(() => crypto.randomUUID());
  const input = useRef<HTMLTextAreaElement>(null);
  const widget = useRef<HTMLElement>(null);
  const suppressFocusOpen = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLElement>(null);
  const pressedInsideAt = useRef(0);
  const fresh = useRef(new Set<string>());
  const glow = useRef(0);
  const [sent, setSent] = useState(0);
  const busy = useRef(new Set<string>());
  const receipts = useRef(new Map<string, Receipt>());
  const snapshot = useRef<AgentContext>(null!);
  const latest = useRef({ catalog, items, threadId, schedule });
  latest.current = { catalog, items, threadId, schedule };
  const context = { program_id: catalog.program, additional_program_ids: catalog.additionalPrograms, page: location.pathname, selected_course_id: catalog.selectedCourseId, completed_course_ids: [...catalog.takenCourseIds], plan: Object.entries(catalog.plans).map(([course_id, value]) => ({ course_id, semester_slot: value.semester, status: value.status })), term_to_slot: catalog.termToSlot, semester_count: catalog.semesterCount, semester_slots: catalog.semesterSlots, starting_term: catalog.startingTerm, named_terms: catalog.namedTerms, capabilities: ["apply_plan_changes", "set_course_sections"] as AgentContext["capabilities"], selected_sections: schedule.selectionsByTerm };
  snapshot.current = { ...context, revision: contextRevision({ ...context, workspace_revision: catalog.planningStore.getState().revision }) };

  useEffect(() => {
    if (schedule.pending) { setOpenedCourse(null); setState("conversation"); }
  }, [schedule.pending?.id]);

  const checkConnection = () => agentFetch<{ model: string; tracing: string; instance_id?: string }>("/health").then(result => { setHealth(result); setError(""); }).catch(() => { setHealth(null); setError("The assistant is offline. Start the agent service, then check the connection."); });
  useEffect(() => { void checkConnection(); }, []);
  useEffect(() => {
    let stopped = false;
    const restore = async (force = false) => {
      const attempt = ++generation.current;
      setMemoryReady(false);
      try {
        const identity = await agentSession(force);
        if (stopped || attempt !== generation.current) return;
        if (!identity.namespace) { setMemoryReady(true); return; } // Older service: keep an ephemeral conversation.
        if (session.current?.namespace === identity.namespace) { setMemoryReady(true); return; }
        session.current = identity;
        receipts.current.clear(); preferences.current = {};
        setItems([]); setOpenedCourse(null); setThreadId(crypto.randomUUID());
        let saved;
        try { saved = await readConversation(identity); }
        catch { setError("Browser memory is unavailable. Chat will work, but actions need storage to prevent repeats."); }
        if (stopped || attempt !== generation.current) return;
        if (saved) {
          const status = await agentFetch<{ instance_id?: string }>("/health");
          if (stopped || attempt !== generation.current) return;
          preferences.current = saved.preferences ?? {};
          setThreadId(saved.threadId);
          setItems(restoredItems(saved.items, !!status.instance_id && status.instance_id === saved.instanceId));
        }
        const accountThread = saved?.threadId ?? identity.latest_thread_id;
        if (identity.kind === "account" && accountThread) {
          const memory = await agentFetch<{ history: { role: string; content: string }[]; preferences: Record<string, unknown> }>(`/memory/${encodeURIComponent(accountThread)}`);
          if (stopped || attempt !== generation.current) return;
          preferences.current = memory.preferences;
          setThreadId(accountThread);
          if (!saved || saved.items.every(item => ["completed", "failed"].includes(item.request.status))) setItems(accountItems(memory.history));
        }
      } catch (cause) {
        if (stopped || attempt !== generation.current) return;
        if (cause instanceof AgentError && cause.status === 404) return;
        session.current = null; preferences.current = {}; receipts.current.clear(); setItems([]); setThreadId(crypto.randomUUID());
        setError(cause instanceof Error ? cause.message : "Conversation memory is unavailable.");
      } finally { if (!stopped && attempt === generation.current) setMemoryReady(true); }
    };
    const changed = () => { session.current = null; setItems([]); preferences.current = {}; receipts.current.clear(); void restore(true); };
    const focused = () => { void restore(); };
    void restore();
    window.addEventListener("focus", focused);
    window.addEventListener("course-radar-auth-change", changed);
    return () => { stopped = true; generation.current++; window.removeEventListener("focus", focused); window.removeEventListener("course-radar-auth-change", changed); };
  }, []);
  useEffect(() => {
    const identity = session.current;
    if (!memoryReady || !identity) return;
    const saved = { threadId, items, preferences: preferences.current, instanceId: health?.instance_id };
    writes.current = writes.current.then(async () => { await saveConversation(identity, saved); }).catch(() => setError("Conversation memory could not be saved. Keep this tab open."));
  }, [items, threadId, memoryReady, health?.instance_id]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    if (schedule.pending) widget.current?.querySelector(".cr-chat-section-choice")?.scrollIntoView({ block: "start" });
    else end.current?.scrollIntoView({ block: "nearest" });
  }, [items, open, schedule.pending?.id, schedule.pending?.stage, schedule.choiceNotice]);

  const minimize = () => {
    if (latest.current.schedule.pending) return;
    setState("compact");
    suppressFocusOpen.current = true;
    input.current?.focus();
    suppressFocusOpen.current = false;
  };
  // Section confirmation stays visible until it is confirmed or canceled.
  const openFromComposer = () => {
    if (!suppressFocusOpen.current) setState("conversation");
  };
  const newConversation = () => {
    setThreadId(crypto.randomUUID()); setItems([]); receipts.current.clear(); setError("");
    input.current?.focus();
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && widget.current?.contains(document.activeElement)) {
        event.preventDefault();
        setKeyboard(true);
        minimize();
      }
    };
    // Reading, scrolling, or choosing inside the chat keeps it open; anywhere else hides the conversation.
    const outside = (event: PointerEvent) => {
      if (latest.current.schedule.pending) return;
      if ((event.target as Element | null)?.closest?.("[data-chat-companion]")) return;
      if (!widget.current?.contains(event.target as Node)) setState("compact");
    };
    window.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, []);
  const focusLeft = () => {
    setTimeout(() => {
      if (latest.current.schedule.pending) return;
      const pressedInside = performance.now() - pressedInsideAt.current < 400;
      if (document.activeElement?.closest("[data-chat-companion]")) return;
      if (!pressedInside && !widget.current?.contains(document.activeElement)) setState("compact");
    }, 0);
  };
  const followPointer = (event: ReactPointerEvent<HTMLElement>) => {
    const panel = windowRef.current;
    if (!panel || glow.current) return;
    const { clientX, clientY } = event;
    glow.current = requestAnimationFrame(() => {
      const box = panel.getBoundingClientRect();
      panel.style.setProperty("--cr-chat-mx", `${clientX - box.left}px`);
      panel.style.setProperty("--cr-chat-my", `${clientY - box.top}px`);
      glow.current = 0;
    });
  };

  const update = (request: AgentRequest) => {
    if (request.preferences) preferences.current = request.preferences;
    setItems(previous => previous.map(item => item.request.request_id === request.request_id ? { ...item, request } : item));
  };

  async function apply(action: BrowserAction): Promise<Receipt> {
    const cached = receipts.current.get(action.action_id);
    const reconcile = (receipt: Receipt): Receipt => receipt.context.revision === snapshot.current.revision ? receipt : { status: "failed", code: "outcome_unknown", message: "This action already has a receipt, but the current state changed. It was not executed again.", context: snapshot.current };
    if (cached) return reconcile(cached);
    const identity = session.current;
    if (identity) {
      const saved = await readReceipt(identity, action.action_id);
      if (saved?.state === "done") return reconcile(saved.receipt);
      if (saved || !await reserveAction(identity, action.action_id)) return { status: "failed", code: "outcome_unknown", message: "This action was already started. Check your current plan; it was not executed again.", context: snapshot.current };
    }
    const active = latest.current.catalog;
    const finish = async (receipt: Receipt) => {
      receipts.current.set(action.action_id, receipt);
      if (identity) await saveReceipt(identity, action.action_id, receipt);
      return receipt;
    };
    const failure = (message: string, code = "stale_context"): Receipt => {
      const receipt: Receipt = { status: "failed", code, message, context: snapshot.current };
      receipts.current.set(action.action_id, receipt);
      return receipt;
    };
    let result: Receipt;
    if (snapshot.current.revision !== action.expected_revision || active.program !== action.program_id || identity?.namespace !== session.current?.namespace) {
      result = failure("The page or plan changed while the agent was working. No action was applied; send the request again.");
    } else {
      try {
        const saved = await active.planningStore.agentAction(action, true);
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (saved.status === "error") result = failure(saved.message, "save_failed");
        else {
          if (action.kind === "open_course") {
            const course = active.courseById.get(action.course_id);
            if (!course) throw Error("Course not found.");
            flushSync(() => { active.selectCourse(course.id); setOpenedCourse(course); setOpen(false); });
          } else if (action.kind !== "set_course_sections") {
            flushSync(() => navigate("/planner"));
          }
          result = { status: "succeeded", code: "saved", message: saved.message, context: snapshot.current };
        }
      } catch (cause) { result = failure(cause instanceof Error ? cause.message : "The change could not be saved.", "save_failed"); }
    }
    return finish(result);
  }

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (!memoryReady) return;
      const epoch = generation.current;
      const conversation = latest.current.threadId;
      for (const item of latest.current.items) {
        const id = item.request.request_id;
        if (["completed", "failed"].includes(item.request.status) || busy.current.has(id)) continue;
        busy.current.add(id);
        try {
          let request = await agentFetch<AgentRequest>(`/requests/${id}?thread_id=${encodeURIComponent(latest.current.threadId)}`);
          if (request.status === "needs_context") request = await agentFetch<AgentRequest>(`/requests/${id}/context`, { thread_id: latest.current.threadId, context: snapshot.current });
          if (epoch !== generation.current || conversation !== latest.current.threadId) return;
          if (request.status === "awaiting_action" && request.action) {
            const action = request.action;
            const current = request.web_handoff?.current_term;
            if (current) { flushSync(() => latest.current.schedule.observeCalendar(current)); }
            const receipt = await apply(action);
            request = await agentFetch<AgentRequest>("/action-results", { thread_id: latest.current.threadId, request_id: id, action_id: action.action_id, tool_call_id: action.tool_call_id, ...receipt });
          }
          if (!stopped && epoch === generation.current) { update(request); setError(""); }
        } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : "Connection lost. Reconnect to check the pending action."); }
        finally { busy.current.delete(id); }
      }
    };
    const timer = setInterval(() => { void poll(); }, 900);
    return () => { stopped = true; clearInterval(timer); };
  }, [memoryReady]);

  // A page can host its own input for this same assistant (the Planner command bar).
  // It opens, closes and sends through these events; replies, actions and memory stay here.
  // The Planner hosts its own input (PlannerCommandBar); no second composer renders there.
  const companion = location.pathname.replace(/\/$/, "") === "/planner";
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;
  const readyRef = useRef(false);
  readyRef.current = !!schedule.pending || (!sending && memoryReady && catalog.storageStatus === "saved");
  useEffect(() => {
    const command = (event: Event) => {
      const detail = (event as CustomEvent<{ action: "open" | "close" | "send"; text?: string; handled?: boolean }>).detail;
      if (!detail) return;
      if (detail.action === "open") setState("conversation");
      else if (detail.action === "close") { if (!latest.current.schedule.pending) setState("compact"); }
      else if (detail.action === "send" && detail.text?.trim() && readyRef.current) { detail.handled = true; void sendRef.current(detail.text); }
    };
    window.addEventListener("course-radar-chat", command);
    return () => window.removeEventListener("course-radar-chat", command);
  }, []);

  // Companion inputs (the Planner command bar) follow the panel when it opens or closes on its own.
  useEffect(() => { window.dispatchEvent(new CustomEvent("course-radar-chat-state", { detail: { open } })); }, [open]);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || sending || !memoryReady || catalog.storageStatus !== "saved") return;
    if (schedule.pending) {
      setOpen(true); setQuery("");
      if (/^(cancel|cancel change|never mind|nevermind)$/i.test(message)) schedule.cancelSections();
      else if (/^(confirm|confirm sections|done)$/i.test(message)) schedule.confirmSections();
      else {
        const matches = schedule.pending.offerings.filter(o => o.classNumber === message || o.sectionNumber === message.replace(/^section\s+/i, ""));
        if (matches.length === 1) schedule.chooseSection(matches[0].classNumber);
        else setError("Choose a section below for each component, then select Confirm sections. You can also type its class number, confirm, or cancel.");
      }
      return;
    }
    setOpen(true); setSending(true); setError("");
    const awaitingStart = items.at(-1)?.request.clarification === "starting_term";
    const startReply = message.match(/^(?:(?:my )?starting term (?:is )?)?(winter|spring|summer|fall)[ -]+((?:19|20|21)\d{2})[.!]?$/i);
    if (startReply && (awaitingStart || /^my starting term|^starting term/i.test(message))) {
      try { await catalog.setStartingTerm(`${startReply[1].toLowerCase()}-${startReply[2]}`); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); }
      catch { setError("Unable to save your starting term. Check browser storage permissions."); setSending(false); return; }
    }
    const requestId = crypto.randomUUID();
    busy.current.add(requestId);
    fresh.current.add(requestId);
    setSent(count => count + 1);
    // Keep the request in the UI even if the response is lost after acceptance.
    setItems(previous => [...previous, { query: message, request: { request_id: requestId, status: "running", reply: "", action: null, events: [], trace_id: "" } }]);
    setQuery("");
    const epoch = generation.current;
    const history = items.flatMap(item => [{ role: "user", content: item.query }, ...(["completed", "failed"].includes(item.request.status) ? [{ role: "assistant", content: item.request.reply }] : [])]).slice(-24);
    try {
      const request = await agentFetch<AgentRequest>("/messages", { thread_id: threadId, request_id: requestId, message, context: snapshot.current, history, preferences: preferences.current });
      if (epoch === generation.current) update(request);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reach the assistant."); }
    finally { busy.current.delete(requestId); setSending(false); input.current?.focus(); }
  }

  const pending = items.filter(item => !["completed", "failed"].includes(item.request.status)).length;
  const suggestions = [
    { text: prompts[0], detail: "See its record and recorded prerequisites", Icon: BookOpen },
    { text: prompts[1], detail: "Place it in your personal plan", Icon: CalendarPlus },
    { text: prompts[2], detail: "Take it out of your personal plan", Icon: CalendarMinus },
  ];
  const working = (status: AgentRequest["status"]) => status === "queued" ? "Queued behind your previous request" : status === "needs_context" ? "Refreshing your plan" : status === "awaiting_action" ? "Updating your plan" : "Checking your request";
  return <>
    {!openedCourse && <aside ref={widget} className="cr-chat-widget" data-state={state} data-keyboard={keyboard} data-companion={companion || undefined} aria-label="Course Radar assistant"
      onKeyDownCapture={() => setKeyboard(true)} onPointerDownCapture={() => { setKeyboard(false); pressedInsideAt.current = performance.now(); }} onBlur={focusLeft}>
      <section ref={windowRef} id="cr-chat-window" className="cr-chat-window" role="dialog" aria-modal="false" aria-labelledby="cr-chat-title" aria-hidden={!open} inert={!open} onPointerMove={followPointer}>
        <header className="cr-chat-header">
          <span className="cr-chat-mark" data-busy={pending > 0 || sending} aria-hidden="true"><svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="13.5"/><circle cx="18" cy="18" r="7.2"/><path d="M18 18 28.4 7.6"/><circle className="cr-chat-mark-dot" cx="28.5" cy="7.4" r="3.1"/><circle className="cr-chat-mark-center" cx="18" cy="18" r="2"/></svg></span>
          <h2 id="cr-chat-title">Course Radar assistant</h2>
          <button className="cr-chat-icon-button" type="button" aria-label="New conversation" title="New conversation" onClick={newConversation}><SquarePen size={17} aria-hidden="true"/></button>
          <button className="cr-chat-icon-button" type="button" aria-label="Minimize chat" disabled={!!schedule.pending} title={schedule.pending ? "Confirm or cancel the section choice first" : "Hide (Esc)"} onClick={minimize}><ChevronDown size={19} aria-hidden="true"/></button>
        </header>
        <div className="cr-chat-messages" role="log" aria-label="Course Radar conversation" aria-live="polite" aria-relevant="additions text">
          <div className="cr-chat-message cr-chat-message-assistant"><p>Hi there. Explore course records, review recorded prerequisites, and compare listed sections in Course Radar.</p></div>
          {!items.length && !error && !schedule.pending && <div className="cr-chat-suggestions" aria-label="Suggested questions">
            {suggestions.map(({ text, detail, Icon }, index) => <button key={text} className="cr-chat-suggestion" type="button" style={{ "--i": index } as CSSProperties} onClick={() => { void sendMessage(text); }}>
              <span className="cr-chat-suggestion-tile" aria-hidden="true"><Icon size={17}/></span>
              <span className="cr-chat-suggestion-text"><strong>{text}</strong><span>{detail}</span></span>
            </button>)}
          </div>}
          {items.map(({ query: text, request }) => <div className="cr-chat-turn" key={request.request_id}>
            <p className="cr-chat-message-user">{text}</p>
            <div className="cr-chat-message cr-chat-message-assistant">
              {request.reply
                ? <Reply text={request.reply} failed={request.status === "failed"} animate={fresh.current.has(request.request_id)}/>
                : <p className="cr-chat-working" role="status"><span className="cr-chat-dots" aria-hidden="true"><i/><i/><i/></span>{working(request.status)}</p>}
              {!!request.web_handoff?.citations.length && <ul className="cr-chat-sources" aria-label="Official sources">{request.web_handoff.citations.map(source => <li key={source.source_id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>}
              {request.events.length > 0 && <details className="cr-chat-run"><summary>Run details · {request.events.length} events</summary><ol>{request.events.map((entry, i) => <li key={i}><strong>{entry.node}</strong><span>{entry.detail}</span></li>)}</ol></details>}
            </div>
          </div>)}
          <ChatSectionChoice />
          {schedule.choiceNotice && <p className="cr-chat-choice-notice" role="status">{schedule.choiceNotice}</p>}
          {error && <div className="cr-chat-error"><p role="alert">{error}</p><button type="button" onClick={() => { void checkConnection(); }}>Check connection</button><button type="button" onClick={newConversation}>New conversation</button></div>}
          <div ref={end}/>
        </div>
        <p className="cr-chat-preview-note">{pending ? `${pending} request${pending === 1 ? "" : "s"} in progress. ` : ""}{health ? "Personal plan saved to your workspace. Verify official requirements." : "Assistant offline. Check the connection to continue."}</p>
      </section>
      {!companion && <form className="cr-chat-composer" onSubmit={event => { event.preventDefault(); void sendMessage(query); }}>
        <label className="cr-chat-sr-only" htmlFor="cr-chat-message">Message Course Radar</label>
        <div className="cr-chat-input-wrap">
        <textarea ref={input} id="cr-chat-message" rows={1} maxLength={4000} value={query}
          placeholder="Ask about your courses..." aria-controls="cr-chat-window" aria-expanded={open}
          data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false"
          onChange={event => { setQuery(event.target.value); openFromComposer(); }}
          onFocus={openFromComposer} onClick={openFromComposer}
          onKeyDown={event => {
            if (state === "compact" && (event.key.length === 1 || event.key === "Enter" || event.key === "ArrowDown")) openFromComposer();
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !event.repeat) {
              event.preventDefault(); event.currentTarget.form?.requestSubmit();
            }
          }}/>
        {!query && <TypingPlaceholder text="Ask about your courses..." loop={!open} phrases={prompts} />}
        </div>
        <button type="submit" disabled={!query.trim() || sending || !memoryReady || catalog.storageStatus !== "saved"} aria-label="Send message">
          <ArrowUp key={sent} className={sent ? "cr-chat-send-fly" : undefined} size={20} aria-hidden="true"/>
        </button>
      </form>}
    </aside>}
    {openedCourse && <CourseDetail course={openedCourse} onClose={() => { setOpenedCourse(null); setOpen(true); }}/>}
  </>;
}

/** Fresh replies resolve word by word; restored history renders as plain text. */
function Reply({ text, failed, animate }: { text: string; failed: boolean; animate: boolean }) {
  const className = failed ? "cr-chat-failed" : undefined;
  if (!animate) return <p className={className}>{text}</p>;
  let index = 0;
  return <p className={className}>{text.split(/(\s+)/).map((part, i) => /^\s*$/.test(part) ? part : <span key={i} className="cr-chat-word" style={{ "--i": Math.min(index++, 40) } as CSSProperties}>{part}</span>)}</p>;
}
