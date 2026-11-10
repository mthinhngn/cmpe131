import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, ChevronDown, LayoutGrid, Search } from "lucide-react";
import { TypingPlaceholder } from "./TypingPlaceholder";
import { useChatPrompts } from "./chat-prompts";

/* Planner command bar: the course library and the shared assistant behind one input.
   Courses mode filters the library into a sheet above the bar and adds the top match on Enter.
   Ask mode hands the message to the sole ChatWidget through the "course-radar-chat" event,
   so replies, plan actions, memory and section choices stay in one assistant. */

type Mode = "courses" | "ask";
type Subject = { key: string; label: string };
type Props = {
  target: string;
  unplanned: number;
  query: string;
  onQuery: (value: string) => void;
  subjects: Subject[];
  subject: string | null;
  onSubject: (key: string | null) => void;
  subjectTitle?: (key: string) => string | undefined;
  pills: ReactNode;
  resultCount: number;
  emptyText: string;
  note?: ReactNode;
  canAdd: boolean;
  onAddTop: () => Promise<string | null>;
  onNearEnd: () => void;
};

const chat = (action: "open" | "close" | "send", text?: string) => {
  const detail: { action: typeof action; text?: string; handled?: boolean } = { action, text };
  window.dispatchEvent(new CustomEvent("course-radar-chat", { detail }));
  return !!detail.handled;
};

const RadarMark = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><path d="M12 12 18 6" /></svg>;

export function PlannerCommandBar(props: Props) {
  const prompts = useChatPrompts();
  const [mode, setModeState] = useState<Mode>("courses");
  // Focus handlers fire before React re-renders, so they read the mode from a ref.
  const modeRef = useRef<Mode>("courses");
  const setMode = (next: Mode) => { modeRef.current = next; setModeState(next); };
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const group = useRef<HTMLSpanElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const toastTimer = useRef(0);
  const swapTimer = useRef(0);
  const enterTimer = useRef(0);
  const activeRef = useRef(false);
  activeRef.current = active;
  const value = mode === "courses" ? props.query : message;
  const placeholder = mode === "courses" ? (active ? `Add a course to ${props.target}…` : "Find a course…") : "Ask about your courses...";

  useLayoutEffect(() => {
    const on = group.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]'), thumb = group.current?.querySelector<HTMLElement>(".pb-cmd-thumb");
    if (on && thumb) { thumb.style.width = `${on.offsetWidth}px`; thumb.style.transform = `translateX(${on.offsetLeft - 3}px)`; }
  }, [mode, active]);

  const flash = (text: string) => { setToast(text); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(""), 1800); };

  const page = () => root.current?.closest<HTMLElement>(".pb-page") ?? null;
  // Keyboard actions skip motion for the next two frames; pointer actions keep it.
  const instant = () => {
    const el = page(); if (!el) return;
    el.dataset.cmdInstant = "";
    requestAnimationFrame(() => requestAnimationFrame(() => { delete el.dataset.cmdInstant; }));
  };
  // The library's first rows cascade in only when it opens from the pointer.
  const cascade = () => {
    const el = root.current; if (!el) return;
    el.dataset.entering = "";
    window.clearTimeout(enterTimer.current);
    enterTimer.current = window.setTimeout(() => { delete el.dataset.entering; }, 700);
  };

  const switchMode = (next: Mode, viaKeyboard = false) => {
    if (next === mode) { field.current?.focus(); return; }
    if (viaKeyboard) instant();
    const pageEl = page();
    if (pageEl && active && !viaKeyboard) {
      const page = pageEl;
      page.dataset.cmdSwap = next === "ask" ? "to-ask" : "to-courses";
      window.clearTimeout(swapTimer.current);
      swapTimer.current = window.setTimeout(() => { delete page.dataset.cmdSwap; }, 520);
    }
    if (!active && next === "courses" && !viaKeyboard) cascade();
    setActive(true);
    setMode(next);
    if (next === "ask") { chat("open"); if (props.query && !message) { setMessage(props.query); props.onQuery(""); } }
    else chat("close");
    field.current?.focus();
  };
  const activate = () => {
    if (!activeRef.current && modeRef.current === "courses" && !page()?.hasAttribute("data-cmd-instant")) cascade();
    setActive(true); if (modeRef.current === "ask") chat("open");
  };
  const deactivate = (viaKeyboard = false) => { if (viaKeyboard) instant(); setActive(false); if (modeRef.current === "ask") chat("close"); };

  useEffect(() => {
    const slash = (event: KeyboardEvent) => {
      const typing = (event.target as Element | null)?.closest?.("input, textarea, select, [contenteditable], dialog");
      if (event.key === "/" && !typing) { event.preventDefault(); instant(); field.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (root.current?.contains(target) || target?.closest?.(".cr-chat-widget, dialog")) return;
      setActive(false);
    };
    const follow = (event: Event) => {
      const open = (event as CustomEvent<{ open: boolean }>).detail?.open;
      if (open && modeRef.current !== "ask") { setMode("ask"); setActive(true); }
      else if (open) setActive(true);
      else if (modeRef.current === "ask") setActive(false);
    };
    window.addEventListener("course-radar-chat-state", follow);
    window.addEventListener("keydown", slash);
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", slash); window.removeEventListener("course-radar-chat-state", follow); document.removeEventListener("pointerdown", outside); window.clearTimeout(toastTimer.current); window.clearTimeout(swapTimer.current); window.clearTimeout(enterTimer.current); };
  }, []);

  const submit = async () => {
    if (mode === "courses") {
      if (!props.query.trim() || !props.canAdd || !props.resultCount) return;
      const added = await props.onAddTop();
      if (added) { flash(`Added ${added} to ${props.target}`); props.onQuery(""); }
    } else if (message.trim()) {
      if (chat("send", message)) setMessage("");
      else flash("The assistant is still connecting. Try again in a moment.");
    }
  };

  const ready = mode === "courses" ? !!props.query.trim() && props.canAdd && props.resultCount > 0 : !!message.trim();
  return <div ref={root} className={`pb-cmd${active ? " active" : ""} ${mode}`} data-chat-companion>
    <section ref={sheet} className="pb-cmd-sheet" aria-label="Course library" aria-hidden={!(active && mode === "courses")} inert={!(active && mode === "courses")}>
      <div className="pb-cmd-page">
        <header className="pb-cmd-head">
          <span className="pb-cmd-mark" aria-hidden="true"><LayoutGrid size={15} /></span>
          <h2>Course library</h2>
          <button type="button" className="pb-cmd-icon" aria-label="Hide course library" title="Hide (Esc)" onClick={() => deactivate()}><ChevronDown size={19} aria-hidden="true" /></button>
        </header>
        <div className="pb-cmd-filters">
          <div className="pb-subjects" role="group" aria-label="Filter by subject">
            <button type="button" aria-pressed={props.subject === null} onClick={() => { props.onSubject(null); field.current?.focus(); }}>All</button>
            {props.subjects.map(s => <button type="button" key={s.key} aria-pressed={props.subject === s.key} title={props.subjectTitle?.(s.key)} onClick={() => { props.onSubject(s.key); field.current?.focus(); }}><i style={{ background: `var(--s-${s.key})` }} />{s.label}</button>)}
          </div>
          {props.note}
        </div>
        <div id="pb-pills" className="pb-cmd-pills" onScroll={e => { const el = e.currentTarget; if (el.scrollHeight - el.clientHeight - el.scrollTop < 240) props.onNearEnd(); }}>
          {props.pills}
          {!props.resultCount && <small className="pb-cmd-empty">{props.emptyText}</small>}
        </div>
        <p className="pb-cmd-foot">Adding to {props.target} · {props.unplanned} unplanned. Drag a course onto the chart, press +, or Enter for the top match.</p>
      </div>
    </section>
    <div className="pb-cmd-bar">
      <span ref={group} className="pb-cmd-mode" role="group" aria-label="Command bar mode"><i className="pb-cmd-thumb" aria-hidden="true" />
        <button type="button" aria-pressed={mode === "courses"} onClick={() => switchMode("courses")}><LayoutGrid size={15} aria-hidden="true" /><span className="pb-cmd-label">Courses</span></button>
        <button type="button" aria-pressed={mode === "ask"} onClick={() => switchMode("ask")}><RadarMark /><span className="pb-cmd-label">Ask</span></button>
      </span>
      <span className="pb-cmd-field">{mode === "courses" && <Search size={16} aria-hidden="true" />}
        <span className="pb-cmd-input">
        <input ref={field} type="text" autoComplete="off" value={value} spellCheck={mode === "ask"}
          aria-label={mode === "courses" ? "Search course library" : "Message Course Radar"}
          placeholder={placeholder}
          data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false"
          onFocus={activate} onClick={activate}
          onChange={e => {
            const next = e.target.value;
            if (mode === "courses" && next.startsWith("?")) { setMode("ask"); setMessage(next.slice(1)); chat("open"); return; }
            if (mode === "courses") props.onQuery(next); else { setMessage(next); if (!activeRef.current) chat("open"); }
            setActive(true);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
            if (e.key === "Tab" && !e.shiftKey && value.length === 0) { e.preventDefault(); switchMode(mode === "courses" ? "ask" : "courses", true); }
            if (e.key === "Escape") { e.preventDefault(); deactivate(true); field.current?.blur(); }
            if (e.key === "ArrowUp" && mode === "courses") { e.preventDefault(); sheet.current?.querySelector<HTMLElement>(".pb-pill button")?.focus(); }
          }} />
        {!value && <TypingPlaceholder text={placeholder} loop={!active} phrases={prompts} />}
        </span>
      </span>
      <button type="button" className={`pb-cmd-go${ready ? " ready" : ""}`} disabled={!ready} aria-label={mode === "courses" ? "Add top match" : "Send message"} onClick={() => void submit()}><ArrowUp size={18} aria-hidden="true" /></button>
    </div>
    <p className={`pb-cmd-toast${toast ? " show" : ""}`} role="status">{toast}</p>
  </div>;
}
