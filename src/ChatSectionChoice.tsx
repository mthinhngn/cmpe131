import { useSchedule } from "./ScheduleContext";
import { termName, requiredComponents } from "./scheduleTerms";
import { detectTimeConflicts, parseMeeting } from "./schedule";

/** Uses the same native form controls as Planning settings; no new primitive. */
export function ChatSectionChoice() {
  const schedule = useSchedule();
  const choice = schedule.pending;
  if (!choice) return null;
  const selected = choice.offerings.filter(o => choice.selected.includes(o.classNumber));
  const conflicts = detectTimeConflicts([...choice.otherOfferings, ...selected]).filter(c => c.left.courseCode === choice.code || c.right.courseCode === choice.code);
  const components = requiredComponents(choice.offerings);
  const complete = components.length > 0 && components.every(c => selected.some(o => o.component === c));
  return <div className="cr-chat-section-choice" aria-label="Choose course sections" aria-busy={choice.stage === "loading"}>
    <h3>{choice.code} <span>{termName(choice.term)}</span></h3>
    <p>{choice.message}</p>
    {choice.stage === "sections" && <>
      {components.map(component => <fieldset key={component}><legend>{component} section</legend>{choice.offerings.filter(o => o.component === component).map(o => <label key={o.classNumber} className="cr-chat-section-option">
        <input type="radio" name={`${choice.id}-${component}`} checked={choice.selected.includes(o.classNumber)} onChange={() => schedule.chooseSection(o.classNumber)} />
        <span><strong>Section {o.sectionNumber}</strong><span>{o.days || "TBA"} · {o.times || "Time TBA"}</span><span>{o.instructors.join(", ") || "Instructor TBA"}</span><span>{o.location || "Location TBA"} · {o.openSeats > 0 ? `${o.openSeats} open seats` : "Full / closed"}</span></span>
      </label>)}</fieldset>)}
      {conflicts.length > 0 && <p role="status">Time conflict with {[...new Set(conflicts.flatMap(c => [c.left.courseCode, c.right.courseCode]))].join(", ")}. You can choose another section or keep this overlap.</p>}
      {selected.some(o => parseMeeting(o).status !== "scheduled") && <p>Some meeting times are unconfirmed. Review them before enrolling.</p>}
      <p>Sections are a published snapshot. Selecting one does not enroll you.</p>
    </>}
    <div className="cr-chat-section-actions"><button type="button" onClick={schedule.cancelSections}>Cancel change</button>{choice.stage === "sections" && <button type="button" disabled={!complete} onClick={schedule.confirmSections}>Confirm sections</button>}</div>
  </div>;
}
