import { useMemo, type CSSProperties } from "react";
import { CalendarBlank, Clock, WarningCircle, X } from "@phosphor-icons/react";
import { useCatalog } from "./CatalogContext";
import { useSchedule } from "./ScheduleContext";
import { dayLabel, detectTimeConflicts, formatMinute, parseMeeting, WEEKDAYS, type MeetingDay } from "./schedule";
import type { CourseOffering } from "./types";

const HOUR_HEIGHT = 72;
const COLORS = ["#0055a2", "#8b3f48", "#557564", "#8a6628", "#465f87", "#7a536b"];

type DisplayMeeting = {
  offering: CourseOffering;
  day: MeetingDay;
  startMinute: number;
  endMinute: number;
  lane: number;
  laneCount: number;
};

function colorFor(value: string) {
  const hash = [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

export function WeeklySchedule({ mobileOpen = false, onClose = () => undefined, readOnly = false, variant = "pane" }: { mobileOpen?: boolean; onClose?: () => void; readOnly?: boolean; variant?: "pane" | "dashboard" }) {
  const { catalog } = useCatalog();
  const { selectedOfferings, removeOffering } = useSchedule();
  const parsed = useMemo(() => selectedOfferings.map((offering) => ({ offering, meeting: parseMeeting(offering) })), [selectedOfferings]);
  const conflicts = useMemo(() => detectTimeConflicts(selectedOfferings), [selectedOfferings]);
  const conflictingClasses = new Set(conflicts.flatMap((conflict) => [conflict.left.classNumber, conflict.right.classNumber]));
  const unscheduled = parsed.filter(({ meeting }) => meeting.status !== "scheduled");
  const rawMeetings = parsed.flatMap(({ offering, meeting }) => meeting.patterns.flatMap((pattern) => pattern.days.map((day) => ({
    offering,
    day,
    startMinute: pattern.startMinute,
    endMinute: pattern.endMinute,
  }))));
  const weekendDays = (["S", "U"] as MeetingDay[]).filter((day) => rawMeetings.some((meeting) => meeting.day === day));
  const days: MeetingDay[] = [...WEEKDAYS, ...weekendDays];
  const earliest = rawMeetings.length ? Math.min(...rawMeetings.map((meeting) => meeting.startMinute)) : 8 * 60;
  const latest = rawMeetings.length ? Math.max(...rawMeetings.map((meeting) => meeting.endMinute)) : 17 * 60;
  const earliestHour = Math.floor(earliest / 60) * 60;
  const latestHour = Math.ceil(latest / 60) * 60;
  const startMinute = earliestHour < 7 * 60 ? earliestHour : Math.max(7 * 60, earliestHour - 60);
  const endMinute = latestHour > 22 * 60 ? latestHour : Math.min(22 * 60, latestHour + 60);
  const height = (endMinute - startMinute) / 60 * HOUR_HEIGHT;
  const hourLabels = Array.from({ length: (endMinute - startMinute) / 60 + 1 }, (_, index) => startMinute + index * 60);

  const displayByDay = useMemo(() => Object.fromEntries(days.map((day) => {
    const source = rawMeetings.filter((meeting) => meeting.day === day).sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute);
    const laneEnds: number[] = [];
    const assigned = source.map((meeting) => {
      let lane = laneEnds.findIndex((end) => end <= meeting.startMinute);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = meeting.endMinute;
      return { ...meeting, lane };
    });
    const laneCount = Math.max(1, laneEnds.length);
    return [day, assigned.map((meeting) => ({ ...meeting, laneCount }))];
  })) as Record<MeetingDay, DisplayMeeting[]>, [days, rawMeetings]);

  const gridStyle = { "--schedule-days": days.length } as CSSProperties;

  return <aside className={`schedule-pane ${variant === "dashboard" ? "schedule-dashboard" : ""} ${mobileOpen ? "is-mobile-open" : ""}`} aria-labelledby="weekly-schedule-title">
    <header className="schedule-pane-header">
      <div><span className="section-eyebrow">{catalog.currentTerm.name.toUpperCase()}</span><h2 id="weekly-schedule-title">Your weekly schedule</h2><p>{selectedOfferings.length} selected section{selectedOfferings.length === 1 ? "" : "s"} · Saved in this browser</p></div>
      {!readOnly && <button className="schedule-mobile-close" type="button" onClick={onClose} aria-label="Close weekly schedule"><X size={20} /></button>}
    </header>

    <div className="selected-section-list" aria-label="Selected sections">
      {selectedOfferings.map((offering) => <div key={offering.classNumber}>
        <span><strong>{offering.courseCode}</strong><small>Section {offering.sectionNumber} · {offering.component}</small></span>
        {readOnly ? <small className="locked-section-label">Locked</small> : <button type="button" onClick={() => removeOffering(offering.classNumber)} aria-label={`Remove ${offering.courseCode} section ${offering.sectionNumber} from schedule`}><X size={16} /></button>}
      </div>)}
    </div>

    {rawMeetings.length > 0 && <div className="weekly-calendar" aria-label={`${catalog.currentTerm.name} weekly schedule. A text list of selected sections and conflicts is provided around the calendar.`}>
      <div className="schedule-day-headings" style={gridStyle}><span aria-hidden="true" />{days.map((day) => <strong key={day}>{dayLabel(day).slice(0, 3)}</strong>)}</div>
      <div className="schedule-grid" style={{ ...gridStyle, height }}>
        <div className="schedule-time-axis">{hourLabels.map((minute) => <span key={minute} style={{ top: (minute - startMinute) / 60 * HOUR_HEIGHT }}>{formatMinute(minute)}</span>)}</div>
        {days.map((day) => <div className="schedule-day-column" key={day} aria-label={dayLabel(day)}>
          {displayByDay[day].map((meeting) => {
            const color = colorFor(meeting.offering.courseCode);
            const style = {
              top: (meeting.startMinute - startMinute) / 60 * HOUR_HEIGHT,
              height: Math.max(28, (meeting.endMinute - meeting.startMinute) / 60 * HOUR_HEIGHT),
              left: `calc(${meeting.lane / meeting.laneCount * 100}% + 3px)`,
              width: `calc(${100 / meeting.laneCount}% - 6px)`,
              "--schedule-color": color,
            } as CSSProperties;
            const hasConflict = conflictingClasses.has(meeting.offering.classNumber);
            const professor = meeting.offering.instructors?.join(", ") || "Professor TBA";
            const room = meeting.offering.location || "Room TBA";
            const time = `${formatMinute(meeting.startMinute)}–${formatMinute(meeting.endMinute)}`;
            return <article className={`schedule-block ${hasConflict ? "has-conflict" : ""}`} style={style} key={`${meeting.offering.classNumber}-${day}-${meeting.startMinute}`} aria-label={`${meeting.offering.courseCode}, section ${meeting.offering.sectionNumber}, ${time}, ${professor}, ${room}${hasConflict ? ", time conflict" : ""}`} title={`${meeting.offering.courseCode} · Section ${meeting.offering.sectionNumber}\n${time}\n${professor}\n${room}`}>
              <strong>{meeting.offering.courseCode} · Sec {meeting.offering.sectionNumber}</strong>
              <span className="schedule-block-time">{time}</span>
              <small className="schedule-block-professor">{professor}</small>
              <small className="schedule-block-room">{room}</small>
              {hasConflict && <WarningCircle size={14} weight="fill" aria-label="Time conflict" />}
            </article>;
          })}
        </div>)}
      </div>
    </div>}

    {unscheduled.length > 0 && <section className="unscheduled-sections" aria-labelledby="unscheduled-title"><h3 id="unscheduled-title"><Clock size={17} /> No set meeting time</h3>{unscheduled.map(({ offering }) => <p key={offering.classNumber}><strong>{offering.courseCode}</strong> · Section {offering.sectionNumber} ({offering.days || "TBA"} · {offering.times || "TBA"})</p>)}</section>}

    <footer className={`schedule-status ${conflicts.length || unscheduled.length ? "has-warning" : "is-clear"}`} aria-live="polite" aria-atomic="true">
      {conflicts.length ? <><h3><WarningCircle size={19} weight="fill" /> {conflicts.length} time conflict{conflicts.length === 1 ? "" : "s"}</h3><ul>{conflicts.map((conflict) => <li key={`${conflict.left.classNumber}-${conflict.right.classNumber}`}><strong>{conflict.left.courseCode}</strong> section {conflict.left.sectionNumber} overlaps <strong>{conflict.right.courseCode}</strong> section {conflict.right.sectionNumber} on {conflict.days.map(dayLabel).join(", ")} from {formatMinute(conflict.startMinute)} to {formatMinute(conflict.endMinute)}.</li>)}</ul></> : unscheduled.length ? <><h3><WarningCircle size={19} weight="fill" /> Schedule needs review</h3><p>{unscheduled.length} section{unscheduled.length === 1 ? " has" : "s have"} no verified meeting time, so Course Radar cannot confirm a conflict-free schedule.</p></> : <><h3><CalendarBlank size={19} weight="fill" /> No time conflicts</h3><p>Selected sections do not overlap in the published meeting snapshot.</p></>}
    </footer>
  </aside>;
}
