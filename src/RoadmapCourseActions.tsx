import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { useCatalog } from "./CatalogContext";
import { useRoadmapTakenIds, useToggleRoadmapCompletion } from "./roadmapCompletion";
import { SelectionMenu } from "./components/ui/selection-menu";
import "./components/ui/ui.css";
import { requirementCategory, requirementMatches, geAreas } from "../api/src/requirement-choices";
import "./roadmap-course-actions.css";

export function RoadmapCourseActions({ courseId, requirementId, onClose, onChoose }: {
  courseId: string; requirementId?: string; onClose: () => void; onChoose: () => void;
}) {
  const { courseById, storageStatus } = useCatalog();
  const takenIds = useRoadmapTakenIds();
  const toggle = useToggleRoadmapCompletion();
  const course = courseById.get(courseId);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus({ preventScroll: true }); }, []);
  if (!course) return null;
  const completed = takenIds.has(courseId);
  return <section className="rm-course-actions nodrag nopan" role="dialog" aria-label={`${course.code} course actions`} onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
  }}>
    <header><div><strong>{course.code}</strong><h3>{course.title}</h3></div><button type="button" aria-label="Close course actions" onClick={onClose}><X size={16}/></button></header>
    <p>{course.units} units{completed ? " · Completed" : " · Not completed"}</p>
    <button ref={first} className="rm-primary rm-completion" type="button" aria-pressed={completed} disabled={storageStatus !== "saved"} onClick={() => { toggle(courseId); onClose(); }}><Check size={16}/>{completed ? "Mark incomplete" : "Mark completed"}</button>
    {requirementId && <button className="rm-secondary" type="button" onClick={onChoose}>Change elective</button>}
  </section>;
}

export function RoadmapRequirementPicker({ requirementId, onClose, onChosen }: { requirementId: string; onClose: () => void; onChosen: (courseId: string) => void }) {
  const { allCourses, planningStore, requirementChoices, takenCourseIds, storageStatus } = useCatalog();
  const catalog = planningStore.getState().catalog;
  const requirement = catalog.requirementGroups.flatMap(group => group.items).find(item => item.id === requirementId);
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [limit, setLimit] = useState(40);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const attempted = useRef<string | null>(null);
  const takenIds = useRoadmapTakenIds();
  const toggleCompletion = useToggleRoadmapCompletion();
  const candidates = useMemo(() => requirement ? allCourses.filter(course => requirementMatches(course, requirement, catalog)) : [], [allCourses, requirement, catalog]);
  const subjects = useMemo(() => [...new Set(candidates.map(course => course.code.split(" ")[0]))].sort(), [candidates]);
  const filtered = candidates.filter(course => (!subject || course.code.startsWith(`${subject} `)) && `${course.code} ${course.title}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    return () => { node?.close(); document.body.style.overflow = overflow; origin?.focus({ preventScroll: true }); };
  }, []);
  if (!requirement) return null;
  const category = requirementCategory(requirement);
  const slotDone = takenIds.has(requirementId);
  return createPortal(<dialog ref={dialog} className="rm-picker" aria-labelledby="rm-picker-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><h2 id="rm-picker-title">Choose {requirement.label ?? "an elective"}</h2></div><button type="button" aria-label="Close course picker" disabled={!!busy} onClick={onClose}><X size={20}/></button></header>
    <div className="rm-picker-summary"><p>{requirement.description}{slotDone ? " · Completed" : ""}</p>
      <button className="rm-completion" type="button" aria-pressed={slotDone} disabled={!!busy || storageStatus !== "saved"} onClick={() => { toggleCompletion(requirementId); onClose(); }}>{slotDone ? "Mark incomplete" : "Mark completed"}</button></div>
    <div className="rm-picker-filters"><label>Search courses<input autoFocus type="search" placeholder="Course code or title" value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }}/></label>
      <div className="rm-picker-field"><span>Subject</span><SelectionMenu label="Subject" value={subject} onChange={value => { setSubject(value); setLimit(40); }} options={[{ slug: "", title: "All subjects" }, ...subjects.map(value => ({ slug: value, title: value }))]}/></div>
    </div>
    <div className="rm-picker-caption"><span>{category === "ge" || category === "review" ? requirement.label : category === "technical" ? "Technical electives" : "University electives"}</span><span>{filtered.length} {filtered.length === 1 ? "course" : "courses"}</span></div>
    <p className="rm-picker-note">{category === "ge" ? "Matches recorded GE satisfaction statements. " : "Verify your program’s credit and elective restrictions. "}Choosing a course saves it to your plan. This is a personal selection, not a degree audit.</p>
    {error && <p role="alert">{error}</p>}
    {storageStatus === "error" && <button className="rm-secondary" type="button" disabled={!!busy} onClick={async () => {
      setBusy(attempted.current); setError("");
      await planningStore.retry();
      const saved = planningStore.getState();
      if (saved.storageStatus === "saved" && attempted.current && saved.requirementChoices?.[saved.program]?.[requirementId] === attempted.current) onChosen(attempted.current);
      else setError(saved.storageError || "Could not save this choice. Try again.");
      setBusy(null);
    }}>Retry save</button>}
    <div className="rm-picker-results" aria-label="Matching courses" aria-busy={!!busy}>
      {filtered.slice(0, limit).map(course => {
        const selected = requirementChoices[requirementId] === course.id;
        const otherRequirement = Object.entries(requirementChoices).some(([id, chosen]) => id !== requirementId && chosen === course.id);
        return <article key={course.id}><div><strong>{course.code} <span>{course.units} units</span></strong><h3>{course.title}</h3>
          {category === "ge" && <small>Recorded GE: {geAreas(course.description).join(", ")}</small>}
          {takenCourseIds.has(course.id) && <small>Completed</small>}
          {otherRequirement && <small>Selected for another requirement</small>}
          <a href={course.sourceUrl} target="_blank" rel="noreferrer">Official course</a></div>
          <button className="rm-secondary" type="button" aria-label={`Choose ${course.code}`} disabled={!!busy || storageStatus !== "saved" || otherRequirement} onClick={async () => {
            setBusy(course.id); setError(""); attempted.current = course.id;
            try {
              const result = await planningStore.command("chooseRequirement", { requirementId, id: course.id });
              if (result.status === "error") throw Error(result.message);
              onChosen(course.id);
            } catch (error) { setError(error instanceof Error ? error.message : "Could not save this choice. Try again."); }
            finally { setBusy(null); }
          }}>{busy === course.id ? "Saving…" : selected ? "Selected" : "Choose course"}</button></article>;
      })}
      {!filtered.length && <p>No matching courses with recorded eligibility. Try another search or subject. Check the official requirements for missing catalog details.</p>}
      {filtered.length > limit && <button className="rm-secondary" type="button" onClick={() => setLimit(value => value + 40)}>Show more courses</button>}
    </div>
  </dialog>, document.body);
}
