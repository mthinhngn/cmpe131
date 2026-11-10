import { SelectionMenu } from "./components/ui/selection-menu";
import { termName, requiredComponents } from "./scheduleTerms";
import { memo, useState, type CSSProperties } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { ListBullets } from "@phosphor-icons/react/dist/csr/ListBullets";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useCatalog } from "./CatalogContext";
import { useSchedule } from "./ScheduleContext";
import { dayLabel, detectTimeConflicts, formatMinute, parseMeeting, WEEKDAYS, type MeetingDay } from "./schedule";
import type { CourseOffering } from "./types";
import { scheduleCourseColors } from "./scheduleColors";

type Props = {
  preview: CourseOffering | null;
  onCancelPreview: () => void;
  onReturnToSections: () => void;
  onConfirmPreview: () => void;
  onRemove: (offering: CourseOffering) => void;
  onInspect: (offering: CourseOffering) => void;
  onBrowse: () => void;
  notice: string;
  saving?: boolean;
};
export const ExplorerWeek = memo(function ExplorerWeek({ preview, onCancelPreview, onReturnToSections, onConfirmPreview, onRemove, onInspect, onBrowse, notice, saving = false }: Props) {
  const { catalog, allCourses, plans, termToSlot, storageStatus } = useCatalog();
  const { selectedOfferings, activeTerm, terms, setActiveTerm, sectionStatus, calendarVerified, retrySections, retryCalendar, choiceNotice, offerings } = useSchedule();
  const needsSections = allCourses.filter(c => plans[c.id] && plans[c.id].semester === (/^(winter|summer)-/.test(activeTerm) ? activeTerm : termToSlot[activeTerm]) && (!selectedOfferings.some(o => o.courseCode === c.code) || requiredComponents(offerings.filter(o => o.courseCode === c.code)).some(component => !selectedOfferings.some(o => o.courseCode === c.code && o.component === component))));
  const [view, setView] = useState<"week" | "agenda">("week");
  const replaced = preview ? selectedOfferings.filter(item => item.courseCode === preview.courseCode && item.component === preview.component) : [];
  const visible = preview ? [...selectedOfferings.filter(item => !replaced.includes(item)), preview] : selectedOfferings;
  const colors = scheduleCourseColors(selectedOfferings.map(item => item.courseCode), preview?.courseCode);
  const parsed = visible.map(offering => ({ offering, meeting: parseMeeting(offering) }));
  const meetings = parsed.flatMap(({ offering, meeting }) => meeting.patterns.flatMap((pattern, patternIndex) => pattern.days.map(day => ({ ...pattern, day, offering, patternIndex }))));
  const conflicts = detectTimeConflicts(visible);
  const conflicting = new Set(conflicts.flatMap(conflict => [conflict.left.classNumber, conflict.right.classNumber]));
  const untimed = parsed.filter(item => item.meeting.status !== "scheduled");
  const savedConflicts = detectTimeConflicts(selectedOfferings);
  const savedUntimed = selectedOfferings.filter(offering => parseMeeting(offering).status !== "scheduled");
  const days: MeetingDay[] = [...WEEKDAYS, ...(["S", "U"] as MeetingDay[]).filter(day => meetings.some(meeting => meeting.day === day))];
  // A stable daily frame prevents the week jumping every time a candidate is previewed.
  const start = Math.min(8 * 60, ...meetings.map(meeting => Math.floor(meeting.startMinute / 60) * 60));
  const end = Math.max(19 * 60, ...meetings.map(meeting => Math.ceil(meeting.endMinute / 60) * 60));
  const pixelsPerHour = 52;
  const height = (end - start) / 60 * pixelsPerHour;
  const hours = Array.from({ length: (end - start) / 60 }, (_, index) => start + index * 60);
  const scheduledCodes = new Set(selectedOfferings.map(offering => offering.courseCode));
  const units = allCourses.filter(course => scheduledCodes.has(course.code)).reduce((sum, course) => sum + course.units, 0);
  const savedMeetings = selectedOfferings.flatMap(offering => parseMeeting(offering).patterns);
  const weeklyHours = savedMeetings.reduce((sum, pattern) => sum + (pattern.endMinute - pattern.startMinute) * pattern.days.length / 60, 0);
  const meetingDays = new Set(savedMeetings.flatMap(pattern => pattern.days));
  const dayLayouts = days.map(day => {
    const entries = meetings.filter(meeting => meeting.day === day).sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
    const laneEnds: number[] = [];
    const assigned = entries.map(meeting => {
      let lane = laneEnds.findIndex(endMinute => endMinute <= meeting.startMinute);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = meeting.endMinute;
      return { ...meeting, lane };
    });
    return { day, assigned, laneCount: Math.max(1, laneEnds.length) };
  });
  const calendarMinWidth = 49 + days.length * Math.max(100, ...dayLayouts.map(layout => layout.laneCount * 86));

  return <section className="cx-week" id="explorer-week" aria-labelledby="cx-week-heading">
    <header className="cx-week-title"><div><h2 id="cx-week-heading" tabIndex={-1}>Weekly schedule</h2><div className="cx-week-meta"><SelectionMenu className="cx-term-menu" label="Schedule semester" value={activeTerm} onChange={setActiveTerm} options={terms.map(term => ({ slug:term, title:termName(term) }))} /><span>{preview ? "Preview · not saved" : selectedOfferings.length ? storageStatus === "saved" ? "Saved to your workspace" : "Schedule workspace" : "No sections selected"}</span></div></div><div className="cx-week-stats" aria-label="Saved week"><div><b>{units}</b><span>units</span></div><div><b>{weeklyHours.toLocaleString("en-US", { maximumFractionDigits: 1 })}</b><span>hours</span></div><div><b>{meetingDays.size}</b><span>days</span></div></div><div className="cx-view-switch" role="group" aria-label="Schedule view"><button type="button" aria-label="Week view" aria-pressed={view === "week"} onClick={() => setView("week")}><CalendarBlank size={16} /></button><button type="button" aria-label="Agenda view" aria-pressed={view === "agenda"} onClick={() => setView("agenda")}><ListBullets size={16} /></button></div></header>

    {!calendarVerified && <p className="cx-term-notice">Catalog semester snapshot. Current academic calendar could not yet be verified. <button type="button" onClick={retryCalendar}>Check calendar</button></p>}
    {sectionStatus !== "available" && <p className="cx-term-notice" role="status">{sectionStatus === "loading" ? "Loading sections…" : "Sections unavailable. Your semester plan is still here."}{sectionStatus === "unavailable" && <button type="button" onClick={() => retrySections()}>Retry sections</button>}</p>}
    {needsSections.length > 0 && <div className="cx-pending-courses" aria-label="Courses awaiting sections">{needsSections.map(c => <div key={c.id}><span><strong>{c.code}</strong><small>{offerings.some(o => o.courseCode === c.code) ? "Choose required sections" : "Sections unavailable. Choose later"}</small></span><button type="button" onClick={() => retrySections(c.id)}>Choose sections</button></div>)}</div>}
    {preview && <div className="cx-preview-bar"><div><strong>Section preview: {preview.courseCode} · {preview.sectionNumber}</strong><span>{replaced.length ? `Replaces section ${replaced[0].sectionNumber} of ${preview.component} when added.` : "Preview only. Add this section to save it."}</span><span>{conflicts.length ? `Preview: ${conflicts.length} time ${conflicts.length === 1 ? "conflict" : "conflicts"}. Review below.` : untimed.length ? "Preview: meeting times need review." : "Preview: no time overlaps."}</span><button type="button" className="cx-back-to-sections" onClick={onReturnToSections}>Back to sections <ArrowRight size={12} /></button></div><button type="button" className="cx-add" disabled={saving} onClick={onConfirmPreview}><Plus size={14} />{replaced.length ? "Replace section" : "Add to week"}</button><button type="button" className="cx-icon-button" aria-label="Dismiss section preview" onClick={onCancelPreview}><X size={16} /></button></div>}
    {view === "week" ? <div className="cx-calendar-scroll" tabIndex={0} aria-label="Weekly calendar; scroll horizontally on narrow screens">
      <div className="cx-calendar" style={{ "--cx-days": days.length, minWidth: calendarMinWidth } as CSSProperties}>
        <div className="cx-calendar-head"><span>Time</span>{days.map(day => <span key={day}>{dayLabel(day).slice(0, 3)}<i className={meetings.some(meeting => meeting.day === day) ? "has-class" : ""} /></span>)}</div>
        <div className="cx-calendar-body" style={{ height }}>
          <div className="cx-hour-rail">{hours.map(hour => <span key={hour} style={{ top: (hour - start) / 60 * pixelsPerHour }}>{formatMinute(hour).replace(":00", "")}</span>)}</div>
          {dayLayouts.map(({ day, assigned, laneCount }) => {
            return <div className="cx-day" key={day}>
              {hours.map(hour => <span className="cx-hour-line" key={hour} style={{ top: (hour - start) / 60 * pixelsPerHour }} />)}
              {assigned.map(meeting => {
                const isPreview = preview?.classNumber === meeting.offering.classNumber;
                return <button type="button" key={`${meeting.offering.classNumber}-${meeting.patternIndex}`} className={`cx-meeting${isPreview ? " cx-ghost" : ""}${conflicting.has(meeting.offering.classNumber) ? " cx-conflict" : ""}`} style={{ ...colors.get(meeting.offering.courseCode), top: (meeting.startMinute - start) / 60 * pixelsPerHour, height: (meeting.endMinute - meeting.startMinute) / 60 * pixelsPerHour, left: `calc(${meeting.lane / laneCount * 100}% + 3px)`, width: `calc(${100 / laneCount}% - 6px)` }} onClick={() => onInspect(meeting.offering)} title={`${isPreview ? "Preview: " : ""}${meeting.offering.courseCode} · Section ${meeting.offering.sectionNumber} · ${formatMinute(meeting.startMinute)}–${formatMinute(meeting.endMinute)} · ${meeting.offering.location || "Room TBA"}`} aria-label={`${isPreview ? "Preview: " : ""}${meeting.offering.courseCode} section ${meeting.offering.sectionNumber}, ${dayLabel(day)}, ${formatMinute(meeting.startMinute)} to ${formatMinute(meeting.endMinute)}${conflicting.has(meeting.offering.classNumber) ? ", time conflict" : ""}. Open details.`}>
                  <strong>{meeting.offering.courseCode}{isPreview && <Plus size={11} />}</strong><span>{formatMinute(meeting.startMinute)}</span><small>{meeting.offering.component} · {meeting.offering.sectionNumber}</small>{conflicting.has(meeting.offering.classNumber) && <WarningCircle size={12} aria-label="Time conflict" />}
                </button>;
              })}
              {!assigned.length && <span className="cx-free-day">No classes</span>}
            </div>;
          })}
          {!meetings.length && <div className="cx-week-empty"><span className="cx-empty-mark"><CalendarBlank size={25} weight="light" /></span><h3>No sections selected</h3><p>Choose a course to compare sections and check meeting times.</p><button type="button" onClick={onBrowse}>Browse courses <ArrowRight size={14} /></button></div>}
        </div>
      </div>
    </div> : <div className="cx-agenda">{days.map(day => {
      const entries = meetings.filter(meeting => meeting.day === day).sort((a, b) => a.startMinute - b.startMinute);
      return <section key={day}><h3>{dayLabel(day)}<span>{entries.length} {entries.length === 1 ? "meeting" : "meetings"}</span></h3>{entries.map(meeting => <button type="button" key={`${meeting.offering.classNumber}-${meeting.patternIndex}`} onClick={() => onInspect(meeting.offering)}><span>{formatMinute(meeting.startMinute)}<small>{formatMinute(meeting.endMinute)}</small></span><strong>{meeting.offering.courseCode}<small>Section {meeting.offering.sectionNumber} · {meeting.offering.location || "Room TBA"}{preview?.classNumber === meeting.offering.classNumber ? " · Preview" : ""}{conflicting.has(meeting.offering.classNumber) ? " · Time conflict" : ""}</small></strong><ArrowRight size={14} /></button>)}{!entries.length && <p>No classes</p>}</section>;
    })}</div>}
    {view === "week" && <p className="cx-calendar-hint">Scroll across the week, or switch to agenda for a list.</p>}

    {conflicts.length > 0 && <div className="cx-week-warning" role="status"><WarningCircle size={17} /><div><strong>{conflicts.length} {preview ? "potential " : ""}time {conflicts.length === 1 ? "conflict" : "conflicts"}</strong>{conflicts.map((conflict, index) => <p key={index}>{conflict.left.courseCode} ({conflict.left.sectionNumber}) and {conflict.right.courseCode} ({conflict.right.sectionNumber}) overlap on {conflict.days.map(dayLabel).join(", ")} · {formatMinute(conflict.startMinute)}–{formatMinute(conflict.endMinute)}.</p>)}</div></div>}
    {untimed.length > 0 && <div className="cx-week-warning"><Clock size={17} /><div><strong>Meeting times to review</strong>{untimed.map(({ offering }) => <p key={offering.classNumber}>{offering.courseCode} · {offering.sectionNumber}: {offering.days || "TBA"} · {offering.times || "TBA"}{preview?.classNumber === offering.classNumber ? " (preview)" : ""}. Overlaps cannot be fully checked.</p>)}</div></div>}
    <div className="cx-saved-sections" aria-label="Selected sections">{selectedOfferings.map(offering => <div className="cx-saved-section" style={colors.get(offering.courseCode)} key={offering.classNumber}><button type="button" onClick={() => onInspect(offering)} aria-label={`Review ${offering.courseCode} section ${offering.sectionNumber}`}><strong>{offering.courseCode}</strong><span>{offering.component} {offering.sectionNumber}</span></button><button type="button" aria-label={`Remove ${offering.courseCode} section ${offering.sectionNumber} from schedule`} disabled={saving} onClick={() => onRemove(offering)}><X size={13} /></button></div>)}</div>
    <footer className="cx-week-footer"><span>{selectedOfferings.length ? savedConflicts.length || savedUntimed.length ? <WarningCircle size={16} /> : <Check size={16} /> : <Plus size={16} />}</span><div><p role="status" aria-live="polite" aria-atomic="true">{choiceNotice || notice}</p><small>{selectedOfferings.length ? `${meetingDays.size} class ${meetingDays.size === 1 ? "day" : "days"} · ${selectedOfferings.length} selected ${selectedOfferings.length === 1 ? "section" : "sections"} · ${savedConflicts.length ? `${savedConflicts.length} time ${savedConflicts.length === 1 ? "conflict" : "conflicts"}` : savedUntimed.length ? "Meeting times need review" : "No time overlaps"}` : "Select a section to add it to your schedule."}</small></div></footer>
  </section>;
});
