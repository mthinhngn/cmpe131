import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CalendarCheck } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { Wrench } from "@phosphor-icons/react/dist/csr/Wrench";
import { Link } from "react-router-dom";
import { useCatalog } from "./CatalogContext";
import { useSchedule } from "./ScheduleContext";
import { formatMinute, type MeetingDay } from "./schedule";
import { sendAgentMessage, type ScheduleProposal } from "./agent";
import { useAgentSession } from "./AgentSessionContext";
import { WeeklySchedule } from "./WeeklySchedule";
import "./recommendations.css";

const DAYS: MeetingDay[] = ["M", "T", "W", "R", "F", "S", "U"];
const DAY_LABEL: Record<MeetingDay, string> = { M: "Monday", T: "Tuesday", W: "Wednesday", R: "Thursday", F: "Friday", S: "Saturday", U: "Sunday" };
const STARTERS = [
  {
    title: "Build my schedule",
    detail: "Use my roadmap and completed prerequisites.",
    message: "Build my Fall 2026 schedule. Use my degree roadmap and completed prerequisites even if my semester planner is empty.",
  },
  {
    title: "Check selected sections",
    detail: "Review conflicts and prerequisite concerns.",
    message: "Check my selected sections for time conflicts and prerequisite concerns.",
  },
  {
    title: "Find an alternative",
    detail: "Avoid a selected section that conflicts with unavailable time.",
    message: "Find an alternative for a selected section that conflicts with my unavailable time.",
  },
];

const toMinute = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

export function Recommendations() {
  const { catalog, program, plans, takenCourseIds, mode } = useCatalog();
  const { selectedClassNumbers, selectedOfferings, replaceSchedule } = useSchedule();
  const { messages, setMessages, draft, setDraft, pending, setPending, unavailableTimes, setUnavailableTimes } = useAgentSession();
  const [day, setDay] = useState<MeetingDay>("M");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [windowError, setWindowError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [applyNotice, setApplyNotice] = useState("");
  const conversationEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { conversationEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, pending, applyNotice]);

  const addUnavailable = () => {
    const next = { day, startMinute: toMinute(start), endMinute: toMinute(end) };
    if (next.endMinute <= next.startMinute) { setWindowError("End time must be later than start time."); return; }
    setUnavailableTimes((current) => [...current, next]);
    setWindowError("");
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, content };
    const history = messages.slice(-8).map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setPending(true);
    setApplyNotice("");
    try {
      const response = await sendAgentMessage({
        message: content,
        history,
        program,
        catalogYear: catalog.catalogYear,
        termId: catalog.currentTerm.id,
        completedCourseIds: [...takenCourseIds],
        planEntries: Object.entries(plans).map(([courseId, entry]) => ({ courseId, ...entry })),
        selectedClassNumbers,
        unavailableTimes,
        preferences: {},
      });
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: response.message, response }]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      const content = detail === "Failed to fetch"
        ? "The scheduling API is unavailable. Start the NestJS API and PostgreSQL, then try again. Your manual planner and schedule builder still work."
        : detail || "The scheduling assistant is unavailable. Your manual planner and schedule builder still work.";
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content }]);
    } finally {
      setPending(false);
    }
  };

  const applyProposal = (proposal: ScheduleProposal) => {
    const result = replaceSchedule(proposal.sections.map((section) => section.classNumber), proposal.lockedClassNumbers ?? selectedClassNumbers);
    if (!result.ok) { setApplyNotice(result.error); return; }
    setConfirming(null);
    setApplyNotice(`Applied ${proposal.sections.length} sections to your browser schedule. You can review them in Course explorer.`);
  };

  return <main className="recommendations-page" aria-labelledby="recommendations-title">
    <header className="recommendations-intro">
      <div className="recommendations-intro-copy">
        <h1 id="recommendations-title">Build a schedule that fits.</h1>
        <p>Tell Course Radar what you need this term. It checks your degree roadmap, completed prerequisites, listed sections and unavailable times before suggesting a schedule.</p>
        <button className="primary-button recommendations-start" type="button" onClick={() => document.getElementById("agent-message")?.focus()}>
          Start with a prompt <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
      <aside className="recommendations-principle" aria-label="How schedule recommendations work">
        <div className="recommendations-principle-title"><Sparkle size={18} aria-hidden="true" /><h2>Built around your plan</h2></div>
        <p>{catalog.currentTerm.name} sections are a dated snapshot. Every selected section stays locked while the assistant explores the rest of your roadmap.</p>
        <Link to="/courses">Review course sections <ArrowRight size={15} aria-hidden="true" /></Link>
      </aside>
    </header>

    <div className="recommendations-workbench">
      <section className="panel agent-chat" aria-labelledby="assistant-heading">
        <div className="agent-chat-header">
          <span id="assistant-heading"><Sparkle size={19} aria-hidden="true" /> Gemini scheduling agent</span>
          <small>Session-only conversation</small>
        </div>
        <div className="agent-conversation" aria-live="polite">
          {messages.map((message) => <article className={`agent-message ${message.role}`} key={message.id}>
            <span className="agent-message-role">{message.role === "user" ? "You" : "Course Radar"}</span>
            <p>{message.content}</p>
            {message.response?.activities.length ? <details className="agent-activity"><summary><Wrench size={15} aria-hidden="true" /> {message.response.activities.length} tool checks</summary>{message.response.activities.map((activity, index) => <div key={`${activity.tool}-${index}`}><strong>{activity.label}</strong><span>{activity.summary}</span></div>)}</details> : null}
            {message.response?.warnings.map((warning) => <p className="agent-inline-warning" key={warning}><WarningCircle size={15} aria-hidden="true" /> {warning}</p>)}
            {message.response?.proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} confirming={confirming === proposal.id} onRequestApply={() => setConfirming(proposal.id)} onCancel={() => setConfirming(null)} onApply={() => applyProposal(proposal)} />)}
          </article>)}
          {pending && <div className="agent-thinking" role="status"><span className="agent-thinking-dot" /> Checking your planner and catalog…</div>}
          {applyNotice && <p className="apply-notice" role="status"><CheckCircle size={17} aria-hidden="true" /> {applyNotice}</p>}
          <div ref={conversationEnd} />
        </div>
        {!messages.some((message) => message.role === "user") && <div className="starter-prompts" aria-label="Starter prompts">
          <p>Start with a suggestion</p>
          <div className="recommendations-prompt-list">{STARTERS.map((item) => <button type="button" key={item.title} onClick={() => setDraft(item.message)}><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}</div>
        </div>}
        <form className="agent-composer" onSubmit={submit}>
          <label htmlFor="agent-message">Message the scheduling assistant</label>
          <div><textarea id="agent-message" rows={3} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="For example: I cannot attend Tuesday mornings. Can you adjust my schedule?" disabled={pending} /><button type="submit" disabled={!draft.trim() || pending} aria-label="Send message"><PaperPlaneTilt size={20} weight="fill" aria-hidden="true" /></button></div>
          <small>Do not enter protected student records. This demo uses the Gemini free tier.</small>
        </form>
      </section>

      <aside className="agent-sidebar recommendations-sidebar" aria-label="Schedule context and controls">
        <section className="current-schedule-dashboard recommendations-schedule" aria-labelledby="current-schedule-heading">
          <div className="current-schedule-intro">
            <div className="recommendations-schedule-title"><h2 id="current-schedule-heading">Current schedule</h2><span>Hard-locked</span></div>
            <p>{selectedOfferings.length ? "These sections stay in every proposal. Change them in Course explorer before asking the assistant to replace one." : "No sections are locked. The assistant can start from your roadmap and completed prerequisites, even if your semester plan is empty."}</p>
          </div>
          {selectedOfferings.length ? <WeeklySchedule readOnly variant="dashboard" /> : <div className="current-schedule-empty"><CalendarCheck size={24} aria-hidden="true" /><strong>No sections selected yet</strong><span>Start with a schedule prompt and the assistant will use the earliest eligible degree requirements.</span><Link to="/courses">Browse course sections <ArrowRight size={15} aria-hidden="true" /></Link></div>}
        </section>

        <section className="panel availability-panel">
          <div className="panel-heading"><h2>Unavailable time</h2><Clock size={19} aria-hidden="true" /></div>
          <p>Add times the candidate generator must avoid.</p>
          <div className="availability-fields">
            <label>Day<select value={day} onChange={(event) => setDay(event.target.value as MeetingDay)}>{DAYS.map((value) => <option key={value} value={value}>{DAY_LABEL[value]}</option>)}</select></label>
            <label>From<input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label>
            <label>To<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          </div>
          <button className="secondary-button" type="button" onClick={addUnavailable}><Plus size={16} aria-hidden="true" /> Add unavailable time</button>
          {windowError && <p className="field-error" role="alert">{windowError}</p>}
          <div className="availability-list">{unavailableTimes.map((window, index) => <div key={`${window.day}-${window.startMinute}-${window.endMinute}-${index}`}><span>{DAY_LABEL[window.day]} · {formatMinute(window.startMinute)}–{formatMinute(window.endMinute)}</span><button type="button" onClick={() => setUnavailableTimes((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove unavailable time ${DAY_LABEL[window.day]}`}><Trash size={15} aria-hidden="true" /></button></div>)}{!unavailableTimes.length && <small>No unavailable times added.</small>}</div>
        </section>

        <section className="agent-context recommendations-context">
          <div className="panel-heading"><h2>Context sent each turn</h2><CalendarCheck size={19} aria-hidden="true" /></div>
          <dl>
            <div><dt>Planner entries</dt><dd>{Object.keys(plans).length || "Optional"}</dd></div>
            <div><dt>Completed courses</dt><dd>{takenCourseIds.size}</dd></div>
            <div><dt>Locked sections</dt><dd>{selectedClassNumbers.length}</dd></div>
            <div><dt>Catalog source</dt><dd>{mode === "database" ? "PostgreSQL" : "Unavailable"}</dd></div>
          </dl>
          <p>The roadmap and completed prerequisites remain the source of truth when the planner is empty. Chat stays available while you navigate and clears on refresh.</p>
        </section>
      </aside>
    </div>
  </main>;
}

function ProposalCard({ proposal, confirming, onRequestApply, onCancel, onApply }: { proposal: ScheduleProposal; confirming: boolean; onRequestApply: () => void; onCancel: () => void; onApply: () => void }) {
  return <section className="schedule-proposal" aria-label={`${proposal.title} schedule proposal`}>
    <div className="proposal-heading"><div><span>Schedule proposal</span><h3>{proposal.title}</h3></div><small>{proposal.metrics.totalUnits !== undefined ? `${proposal.metrics.totalUnits} units · ` : ""}{proposal.metrics.campusDays} campus days · {proposal.metrics.gapMinutes} gap min</small></div>
    <div className="proposal-sections">{proposal.sections.map((section) => <article key={section.classNumber}>
      <div><strong>{section.courseCode}</strong><span>{section.component} · Section {section.sectionNumber} {section.source ? <em className={`proposal-source ${section.source}`}>{section.source}</em> : null}</span></div>
      <div><strong>{section.days || "TBA"} · {section.times || "TBA"}</strong><span>{section.location || "Location TBA"}</span></div>
      <div><strong>{section.instructors.join(", ") || "Instructor TBA"}</strong><span>Class #{section.classNumber} · {section.openSeats} seats at snapshot</span></div>
    </article>)}</div>
    {proposal.decisionTrace && <details className="agent-decision-trace"><summary>Why this schedule</summary><p>{proposal.decisionTrace.eligibleCourses.length} courses passed the prerequisite frontier. The engine examined {proposal.decisionTrace.examinedCombinations} bounded combinations and preserved {proposal.decisionTrace.lockedClassNumbers.length} hard lock{proposal.decisionTrace.lockedClassNumbers.length === 1 ? "" : "s"}.</p>{proposal.decisionTrace.replacements.map((replacement) => <p key={`${replacement.skippedCourseCode}-${replacement.chosenCourseCode}`}><strong>{replacement.chosenCourseCode}</strong> replaced {replacement.skippedCourseCode}: {replacement.reason}</p>)}</details>}
    {proposal.warnings.map((warning) => <p className="agent-inline-warning" key={warning}><WarningCircle size={15} aria-hidden="true" /> {warning}</p>)}
    {confirming ? <div className="proposal-confirm"><p>Add the proposed open sections while preserving every locked section?</p><button type="button" className="primary-button" onClick={onApply}>Confirm apply</button><button type="button" onClick={onCancel}>Cancel</button></div> : <button type="button" className="primary-button proposal-apply" onClick={onRequestApply}><CalendarCheck size={17} aria-hidden="true" /> Apply this schedule</button>}
  </section>;
}
