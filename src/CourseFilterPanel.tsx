import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { NativeSelect } from "./components/ui/native-select";
import { Button } from "./components/ui/button";
import { COMPONENT_LABELS, DEFAULT_FILTERS, MODE_LABELS, filterGroups, type CourseFilters as Filters } from "./courseFilters";
import "./course-filters.css";

type Props = {
  applied: Filters; onApply: (value: Filters) => void;
  open: boolean; onOpenChange: (open: boolean) => void;
  subjects: string[]; components: string[]; instructors: string[];
  counts: { all: number | string; scheduled: number | string; open: number | string };
  termLabel: string;
};
const DAYS = [["M", "Mon"], ["T", "Tue"], ["W", "Wed"], ["R", "Thu"], ["F", "Fri"], ["S", "Sat"], ["U", "Sun"]];
export function CourseFilterControls({ applied, onApply, open, onOpenChange, subjects, components, instructors, counts, termLabel }: Props) {
  const [draft, setDraft] = useState(applied);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLSelectElement>(null);
  const panel = useRef<HTMLFormElement>(null);
  const pointer = useRef(false);
  const groups = filterGroups(applied);
  const change = <K extends keyof Filters>(key: K, value: Filters[K]) => { setDraft(previous => ({ ...previous, [key]: value })); setError(""); };
  const toggle = (key: "subjects" | "modes" | "components" | "days", value: string) => change(key, draft[key].includes(value) ? draft[key].filter(v => v !== value) : [...draft[key], value]);
  const close = () => { onOpenChange(false); trigger.current?.focus({ preventScroll: true }); };
  const instructorSuggestions = useMemo(() => draft.instructor.trim().length >= 2 ? instructors.filter(name => name.toLowerCase().includes(draft.instructor.toLowerCase())).slice(0, 8) : [], [instructors, draft.instructor]);
  useLayoutEffect(() => {
    if (!open) return;
    first.current?.focus({ preventScroll: true });
    if (pointer.current) panel.current?.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 180, easing: "cubic-bezier(.23,1,.32,1)" });
  }, [open]);
  return <>
    <div className="cx-filters cx-filter-toolbar" role="group" aria-label="Course filters">
      <button type="button" aria-pressed={applied.scope === "all"} onClick={() => onApply({ ...applied, scope: "all" })}>All<span>{counts.all}</span></button>
      <button type="button" aria-pressed={applied.scope === "scheduled"} onClick={() => onApply({ ...applied, scope: applied.scope === "scheduled" ? "all" : "scheduled" })}>In your week<span>{counts.scheduled}</span></button>
      <button type="button" aria-pressed={applied.availability === "open"} onClick={() => onApply({ ...applied, availability: applied.availability === "open" ? "any" : "open" })}>Open seats<span>{counts.open}</span></button>
      <button ref={trigger} className="cx-filter-trigger" type="button" aria-expanded={open} aria-controls="cx-filter-panel" onClick={event => {
        pointer.current = event.detail > 0;
        if (open) close(); else { setDraft(applied); setSubjectSearch(""); setError(""); onOpenChange(true); }
      }}><SlidersHorizontal size={14} aria-hidden="true"/>Filters{groups.length > 0 && <span>{groups.length}</span>}</button>
    </div>
    {!open && groups.length > 0 && <div className="cx-active-filters" aria-label="Applied filters">{groups.map(({ key, label }) => <button type="button" key={key} title={label} aria-label={`Remove filter: ${label}`} onClick={() => { onApply({ ...applied, [key]: DEFAULT_FILTERS[key] }); trigger.current?.focus({ preventScroll: true }); }}><span>{label}</span><X size={12} aria-hidden="true"/></button>)}<button className="cx-filter-clear" type="button" onClick={() => { onApply(DEFAULT_FILTERS); trigger.current?.focus({ preventScroll: true }); }}>Clear all</button></div>}
    {open && <form ref={panel} id="cx-filter-panel" className="cx-filter-panel" aria-label="Filter courses" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }} onSubmit={event => {
      event.preventDefault();
      if (draft.after && draft.before && draft.after >= draft.before) { setError("End time must be later than start time."); return; }
      if (draft.minUnits && draft.maxUnits && Number(draft.minUnits) > Number(draft.maxUnits)) { setError("Maximum units must be at least the minimum."); return; }
      onApply({ ...draft, instructor: draft.instructor.trim() }); close();
    }}>
      <header className="cx-filter-panel-head"><div><h3>Filter courses</h3><p>{termLabel}</p></div><button type="button" aria-label="Close filters" onClick={close}><X size={18}/></button></header>
      <div className="cx-filter-body">
        <fieldset><legend>Course selection</legend>
          <label className="cx-filter-field">Show<NativeSelect aria-label="Show" ref={first} value={draft.scope} onChange={event => change("scope", event.target.value as Filters["scope"])}><option value="all">All courses</option><option value="degree">My degree</option><option value="scheduled">In your week</option></NativeSelect></label>
          <label className="cx-filter-check"><input type="checkbox" checked={draft.offered} onChange={event => change("offered", event.target.checked)}/>Offered this term</label>
          <label className="cx-filter-field">Availability<NativeSelect aria-label="Availability" value={draft.availability} onChange={event => change("availability", event.target.value as Filters["availability"])}><option value="any">Any availability</option><option value="open">Open seats</option><option value="full">No open seats</option><option value="unknown">Seats not listed</option></NativeSelect></label>
        </fieldset>
        <fieldset><legend>Subject</legend><input aria-label="Find a subject" type="search" placeholder="Find a subject, e.g. CMPE" value={subjectSearch} onChange={event => setSubjectSearch(event.target.value)}/>
          <div className="cx-subject-options">{subjects.filter(s => s.toLowerCase().includes(subjectSearch.toLowerCase())).map(subject => <label className="cx-filter-check" key={subject}><input type="checkbox" checked={draft.subjects.includes(subject)} onChange={() => toggle("subjects", subject)}/>{subject}</label>)}</div>
          {!subjects.some(s => s.toLowerCase().includes(subjectSearch.toLowerCase())) && <p className="cx-filter-hint">No matching subjects.</p>}
        </fieldset>
        <fieldset><legend>Instruction mode</legend><div className="cx-filter-options">{Object.entries(MODE_LABELS).map(([mode, label]) => <label className="cx-filter-check" key={mode}><input type="checkbox" checked={draft.modes.includes(mode)} onChange={() => toggle("modes", mode)}/>{label}</label>)}</div></fieldset>
        <fieldset><legend>Meeting days &amp; times</legend><span className="cx-filter-label">Only these days</span><div className="cx-filter-days">{DAYS.map(([day, label]) => <button key={day} type="button" aria-pressed={draft.days.includes(day)} onClick={() => toggle("days", day)}>{label}</button>)}</div>
          <div className="cx-filter-pair"><label className="cx-filter-field">Starts at or after<input type="time" value={draft.after} onChange={event => change("after", event.target.value)}/></label><label className="cx-filter-field">Ends at or before<input type="time" value={draft.before} onChange={event => change("before", event.target.value)}/></label></div>
          <label className="cx-filter-field">Meeting information<NativeSelect aria-label="Meeting information" value={draft.meeting} onChange={event => change("meeting", event.target.value as Filters["meeting"])}><option value="any">Any meeting information</option><option value="scheduled">Scheduled meetings</option><option value="unscheduled">No scheduled meetings</option><option value="review">Needs review</option></NativeSelect></label>
          <label className="cx-filter-check"><input type="checkbox" checked={draft.includeUnknown} onChange={event => change("includeUnknown", event.target.checked)}/>Include sections with unknown times</label>
        </fieldset>
        <fieldset><legend>Units &amp; instructor</legend><div className="cx-filter-pair"><label className="cx-filter-field">Minimum units<input type="number" min="0" max="99" step="0.5" placeholder="Any" value={draft.minUnits} onChange={event => change("minUnits", event.target.value)}/></label><label className="cx-filter-field">Maximum units<input type="number" min="0" max="99" step="0.5" placeholder="Any" value={draft.maxUnits} onChange={event => change("maxUnits", event.target.value)}/></label></div>
          <label className="cx-filter-field">Instructor<input type="search" list="cx-filter-instructors" placeholder="Search instructor names" value={draft.instructor} onChange={event => change("instructor", event.target.value)}/></label><datalist id="cx-filter-instructors">{instructorSuggestions.map(name => <option key={name} value={name}/>)}</datalist>
        </fieldset>
        <fieldset><legend>Class type</legend><div className="cx-filter-options">{components.map(component => <label className="cx-filter-check" key={component}><input type="checkbox" checked={draft.components.includes(component)} onChange={() => toggle("components", component)}/>{COMPONENT_LABELS[component] ?? component}</label>)}</div></fieldset>
        <fieldset><legend>Degree year</legend><label className="cx-filter-field">Recommended placement<NativeSelect aria-label="Recommended placement" value={draft.year} onChange={event => change("year", event.target.value as Filters["year"])}><option value="any">Any degree year</option><option value="early">Years 1–2</option><option value="late">Years 3–4</option></NativeSelect></label><p className="cx-filter-hint">Applies to courses with a mapped degree semester.</p></fieldset>
      </div>
      {error && <p className="cx-filter-error" role="alert">{error}</p>}
      <footer className="cx-filter-actions"><Button variant="ghost" onClick={() => { setDraft(DEFAULT_FILTERS); setError(""); }}>Clear</Button><Button type="submit">Apply filters</Button></footer>
    </form>}
  </>;
}
