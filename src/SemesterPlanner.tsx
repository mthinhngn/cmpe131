import { ProductPageHeading } from "./ProductPageHeading";
import { slotLabel, parseSlot, derivedTermSlots, type PlanSlot } from "./academicProfile";
import { ProductHeader } from "./ProductHeader";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, Layers, Plus, X } from "lucide-react";
import { useCatalog } from "./CatalogContext";
import type { Course } from "./types";
import { PlanningStore, type Plans } from "./planning";
import { CourseDetail } from "./CourseDetail";
import "./planner-blocks.css";
import { courseSubject } from "./courseSubject";
import { PlannerCommandBar } from "./PlannerCommandBar";
import { plannerPlacements } from "./plannerData";

const LIBRARY_BATCH = 40;

const subjects = [
  { key: "major", label: "Major", codes: ["CMPE", "CS", "SE"] },
  { key: "math", label: "Math", codes: ["MATH"] },
  { key: "science", label: "Science", codes: ["PHYS", "BIOL", "CHEM"] },
  { key: "eng", label: "Engineering", codes: ["ENGR", "EE", "ISE"] },
  { key: "writing", label: "Writing", codes: ["ENGL"] },
  { key: "university", label: "University electives", codes: [] },
  { key: "technical", label: "Technical electives", codes: [] },
];
const short = (s: PlanSlot) => typeof s === "number" ? `S${s}` : slotLabel(s);

export default function SemesterPlanner() {
  const [params] = useSearchParams();
  const { catalog, allCourses, program, plans: savedPlans, takenCourseIds: savedTakenCourseIds, courseById, semesterSlots, namedTerms, termOrder, planningStore, termToSlot: savedTermToSlot, startingTerm } = useCatalog();
  const [termPreview, setTermPreview] = useState<{ program: string; slots: PlanSlot[]; removed?: PlanSlot; plans?: Plans; termToSlot?: Record<string, number> } | null>(null);
  const termToSlot = termPreview?.program === program && termPreview.termToSlot ? termPreview.termToSlot : savedTermToSlot;
  const semesters = useMemo<PlanSlot[]>(() => termPreview?.program === program ? termPreview.slots : termOrder, [termPreview, program, termOrder]);
  // Course changes appear at once through the planning store's save queue.
  const plans = useMemo(() => {
    if (termPreview?.program === program && termPreview.plans) return termPreview.plans;
    const removed = termPreview?.program === program ? termPreview.removed : undefined;
    if (removed === undefined) return savedPlans;
    const next = { ...savedPlans };
    for (const [id, plan] of Object.entries(next)) if (plan.semester === removed) delete next[id];
    return next;
  }, [savedPlans, termPreview, program]);
  const takenCourseIds = savedTakenCourseIds;
  const changedCourses = useRef(new Set<string>());
  const roadmapIds = useMemo(() => new Set(catalog.courses.map(c => c.id)), [catalog.courses]);
  const subjectOf = (c: Course) => subjects.find(s => s.key === (c.plannerCategory ?? courseSubject(c.code, roadmapIds.has(c.id), program)))!;
  const tone = (c: Course): CSSProperties => ({ "--c": `var(--s-${subjectOf(c).key})`, "--c-ink": subjectOf(c).key === "writing" ? "#fff" : "#000", "--u": c.units } as CSSProperties);
  const [semester, setSemester] = useState<PlanSlot>(5);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [selected, setSelected] = useState<Course | null>(null);
  const [fullDetails, setFullDetails] = useState<Course | null>(null);
  const [target, setTarget] = useState<PlanSlot>(5);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dropOn, setDropOn] = useState<PlanSlot | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const chart = useRef<HTMLDivElement>(null);
  const draggingTerm = useRef<PlanSlot | null>(null);
  const dragging = useRef<{ id: string; program: string; planned: boolean } | null>(null);
  const libraryKey = JSON.stringify([program, semester, query, subject]);
  const [libraryPage, setLibraryPage] = useState({ key: libraryKey, limit: LIBRARY_BATCH });
  const libraryLimit = libraryPage.key === libraryKey ? libraryPage.limit : LIBRARY_BATCH;
  useEffect(() => {
    setLibraryPage(previous => previous.key === libraryKey ? previous : { key: libraryKey, limit: LIBRARY_BATCH });
    document.getElementById("pb-pills")?.scrollTo({ top: 0 });
  }, [libraryKey]);
  useEffect(() => { document.title = "Semester Planner · Course Radar"; }, []);
  useEffect(() => { changedCourses.current.clear(); setSemester(semesterSlots.includes(5) ? 5 : semesterSlots[0] ?? namedTerms[0] ?? 1); setQuery(""); setSubject(null); setError(""); setSelected(null); setFullDetails(null); }, [program]);
  useEffect(() => {
    const slot = parseSlot(params.get("semester") ?? "");
    if (typeof slot === "number" && semesterSlots.includes(slot) || typeof slot === "string" && namedTerms.includes(slot)) setSemester(slot);
  }, [params, semesterSlots, program, namedTerms]);
  useEffect(() => { if (!semesters.includes(semester)) setSemester(semesters[0] ?? 1); }, [semesters, semester]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  useEffect(() => {
    const container = chart.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!container || !active) return;
    const viewport = container.getBoundingClientRect(), column = active.getBoundingClientRect();
    if (column.left < viewport.left) container.scrollLeft += column.left - viewport.left;
    else if (column.right > viewport.right) container.scrollLeft += column.right - viewport.right;
    if (labels.current) labels.current.scrollLeft = container.scrollLeft;
  }, [semester, semesters]);
  const placements = useMemo(() => plannerPlacements(allCourses, plans, takenCourseIds, semesters), [allCourses, plans, takenCourseIds, semesters]);
  const planned = useMemo(() => placements.filter(p => !p.completed).map(p => p.course), [placements]);
  const coursesIn = (s: PlanSlot) => planned.filter(c => plans[c.id].semester === s);
  const completedIn = (s: PlanSlot) => placements.filter(p => p.completed && p.semester === s).map(p => p.course);
  const units = (cs: Course[]) => cs.reduce((n, c) => n + c.units, 0);
  const remaining = useMemo(() => allCourses.filter(c => !plans[c.id]), [allCourses, plans]);
  const results = useMemo(() => remaining.filter(c => `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase()) && (!subject || subjectOf(c).key === subject))
    .sort((a, b) => Number(b.recommendedSemester === semester) - Number(a.recommendedSemester === semester) || a.recommendedSemester - b.recommendedSemester), [remaining, query, subject, semester, roadmapIds]);
  const appendLibrary = () => setLibraryPage(previous => ({ key: libraryKey, limit: Math.min(results.length, (previous.key === libraryKey ? previous.limit : LIBRARY_BATCH) + LIBRARY_BATCH) }));
  const term = (s: PlanSlot) => typeof s === "string" ? slotLabel(s) : Object.entries(termToSlot).find(([, n]) => n === s)?.[0]?.replace(/^(\w+)-(\d+)$/, (_, season, year) => `${season[0].toUpperCase()}${season.slice(1)} ${year}`) ?? `${s % 2 ? "Fall" : "Spring"} · Year ${Math.ceil(s / 2)}`;
  // Warnings describe recorded ordering only; they never authorize or rewrite a plan.
  const issues = (c: Course, s: PlanSlot) => {
    const before = (id: string, same = false) => {
      if (takenCourseIds.has(id)) return true;
      const prerequisiteSlot = plans[id]?.semester;
      if (!prerequisiteSlot) return false;
      if (typeof s === "number" && typeof prerequisiteSlot === "number") return same ? prerequisiteSlot <= s : prerequisiteSlot < s;
      const date = (slot: PlanSlot) => typeof slot === "string" ? slot : Object.entries(termToSlot).find(([, n]) => n === slot)?.[0];
      const a = date(prerequisiteSlot), b = date(s);
      if (!a || !b) return false;
      const index = (t: string) => Number(t.split("-")[1]) * 4 + ["winter", "spring", "summer", "fall"].indexOf(t.split("-")[0]);
      return same ? index(a) <= index(b) : index(a) < index(b);
    };
    return [...c.prerequisiteCourseIds.filter(id => !before(id)).map(id => `Prerequisite: ${courseById.get(id)?.code ?? id}`), ...c.corequisiteCourseIds.filter(id => !before(id, true)).map(id => `Corequisite: ${courseById.get(id)?.code ?? id}`)];
  };
  const notifyError = (error: unknown) => {
    if (planningStore.getState().storageStatus !== "error") setError(error instanceof Error ? error.message : "Unable to save. Please try again.");
  };
  const change = async (course: Course, slot: PlanSlot) => {
    if (busy) return false;
    setError("");
    changedCourses.current.add(course.id);
    const result = savedTakenCourseIds.has(course.id)
      ? await planningStore.moveCompletedCourse(course.id, slot)
      : await planningStore.setPlan(course.id, slot, savedPlans[course.id]?.status);
    if (result.status === "error") { notifyError(Error(result.message || "Could not save the course. Please try again.")); return false; }
    return true;
  };
  const remove = async (course: Course) => {
    if (busy || !savedPlans[course.id]) return false;
    setError("");
    changedCourses.current.add(course.id);
    setSelected(null);
    const result = await planningStore.removePlan(course.id);
    if (result.status === "error") { notifyError(Error(result.message || "Could not remove the course. Please try again.")); return false; }
    return true;
  };
  const complete = (course: Course) => {
    if (busy) return;
    setError("");
    changedCourses.current.add(course.id);
    setSelected(null);
    void planningStore.toggleTakenCourse(course.id).then(result => { if (result.status === "error") notifyError(Error(result.message)); });
  };
  const run = async (action: () => Promise<unknown>) => { if (busy) return; setBusy(true); setError(""); try { await action(); } catch (error) { notifyError(error); } finally { setBusy(false); } };
  const open = (c: Course) => { setTarget(plans[c.id]?.semester ?? semester); setSelected(c); };
  const drag = (e: DragEvent, c: Course) => { dragging.current = { id: c.id, program, planned: !!plans[c.id] }; e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; };
  const endDrag = () => { draggingTerm.current = null; dragging.current = null; setDropOn(null); };
  const drop = (e: DragEvent, s: PlanSlot) => { e.preventDefault(); e.stopPropagation(); if (draggingTerm.current !== null) { const from = draggingTerm.current; endDrag(); void moveTerm(from, s); return; } endDrag(); const c = courseById.get(e.dataTransfer.getData("text/plain")); if (c) void change(c, s); };
  const canRemoveDrop = (e: DragEvent) => !busy && dragging.current?.planned && dragging.current.program === program && !(e.target as Element).closest(".pb-plot");
  const dropOutside = (e: DragEvent) => {
    if (!canRemoveDrop(e)) return;
    e.preventDefault();
    const course = courseById.get(dragging.current!.id);
    endDrag();
    if (course && plans[course.id]) void remove(course);
  };
  const extend = () => run(async () => {
    const slot = planningStore.nextSemester;
    setTermPreview({ program, slots: [...semesters, slot] }); setSemester(slot);
    try { const result = await planningStore.addSemester(); if (result.status === "error") throw Error(result.message); }
    finally { setTermPreview(null); }
  });
  const addOptional = (season: "winter" | "summer") => run(async () => {
    const base = typeof semester === "string" ? semester : Object.keys(termToSlot).find(t => termToSlot[t] === semester) ?? catalog.currentTerm.id;
    let year = Number(base.split("-")[1]) + Number(season === "winter" && base.startsWith("fall-"));
    while (semesters.includes(`${season}-${year}`)) year++;
    const slot = `${season}-${year}`;
    setTermPreview({ program, slots: [...semesters, slot] }); setSemester(slot);
    try { const result = await planningStore.addNamedTerm(slot); if (result.status === "error") throw Error(result.message); }
    finally { setTermPreview(null); }
  });
  const removeSemester = () => run(async () => {
    const slots = semesters.filter(s => s !== semester);
    setTermPreview({ program, slots, removed: semester }); setSelected(null);
    try { const result = await planningStore.removeSemester(semester); if (result.status === "error") throw Error(result.message); }
    finally { setTermPreview(null); }
  });
  const moveTerm = (from: PlanSlot, to: PlanSlot) => run(async () => {
    if (from === to) return;
    const preview = new PlanningStore(program, planningStore.getState().catalog);
    preview.restore(planningStore.getState());
    const moved = preview.moveSemester(from, to, startingTerm);
    for (const [id, plan] of Object.entries(preview.plans)) if (plan.semester !== savedPlans[id]?.semester) changedCourses.current.add(id);
    setTermPreview({ program, slots: preview.termOrder, plans: preview.plans, termToSlot: Object.fromEntries(Object.entries(derivedTermSlots(startingTerm, preview.semesterCount)).filter(([, slot]) => preview.semesterSlots.includes(slot))) }); setSemester(moved);
    try { const result = await planningStore.moveSemester(from, to); if (result.status === "error") throw Error(result.message); }
    finally { setTermPreview(null); }
  });
  const maxUnits = Math.max(22, ...semesters.map(s => [...coursesIn(s), ...completedIn(s)].reduce((n, c) => n + Math.max(2, c.units), 0)));
  const warningCount = planned.filter(c => issues(c, plans[c.id].semester).length).length;
  const heavy = semesters.filter(s => units(coursesIn(s)) > 17);
  return <div className="pb-page" onDragOver={e => { if (canRemoveDrop(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={dropOutside}>
    <a className="pb-skip" href="#pb-main">Skip to planner</a>
    <ProductHeader activePath="/planner" />
    <main className="pb-wrap" id="pb-main">
      <ProductPageHeading title="Planner" />
      {error && <p className="pb-error" role="alert">{error}</p>}
      <section className="pb-chart" aria-label="Semester workload overview" aria-busy={busy}>
        <div className="pb-chart-head"><h2><Layers size={16}/>Units per semester · each block is one course</h2><div className="pb-legend">{subjects.map(s => <span key={s.key}><i style={{ background: `var(--s-${s.key})` }}/>{s.label}</span>)}<span><i className="pb-done-key"/>Completed</span></div></div>
        <div className="pb-plot" ref={chart} role="region" aria-label="Units per semester, course blocks" tabIndex={0} style={{ "--plot-units": maxUnits } as CSSProperties} onScroll={e => { if (labels.current) labels.current.scrollLeft = e.currentTarget.scrollLeft; }}>
          <div className="pb-target"><span>15u TYPICAL FULL LOAD</span></div>
          {semesters.map((s, ci) => <div key={s} className={`pb-column${dropOn === s ? " drop-on" : ""}`} aria-current={s === semester} onDragOver={e => { e.preventDefault(); setDropOn(s); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOn(null); }} onDrop={e => drop(e, s)}>
            {completedIn(s).map(c => <div key={c.id} className="pb-block pb-done" draggable={!busy} onDragStart={e => drag(e, c)} onDragEnd={endDrag} style={{ ...tone(c), "--d": "0ms" } as CSSProperties}><button onClick={() => open(c)} aria-label={`${c.code}, completed`}>{c.code}</button><small>{c.units}</small></div>)}
            {coursesIn(s).map((c, i) => <div key={c.id} className={`pb-block${issues(c, s).length ? " pb-warn" : ""}`} title={issues(c, s).join(" · ") || c.title} draggable={!busy} onDragStart={e => drag(e, c)} onDragEnd={endDrag} style={{ ...tone(c), "--d": changedCourses.current.has(c.id) ? "0ms" : `${ci * 50 + i * 60 + 100}ms` } as CSSProperties}><button onClick={() => open(c)}>{c.code}</button><small>{c.units}</small></div>)}
          </div>)}
        </div>
        <div className="pb-labels" ref={labels}>{semesters.map(s => <button key={s} draggable={!busy} title="Drag to move this term; Alt + Left/Right also moves it" onDragStart={e => { e.stopPropagation(); draggingTerm.current = s; dragging.current = null; e.dataTransfer.setData("application/x-course-radar-term", String(s)); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={endDrag} onDragOver={e => { if (draggingTerm.current !== null) e.preventDefault(); }} onDrop={e => drop(e, s)} onKeyDown={e => {
          if (!busy && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
            e.preventDefault(); const destination = semesters[semesters.indexOf(s) + (e.key === "ArrowLeft" ? -1 : 1)];
            if (destination !== undefined) void moveTerm(s, destination);
          }
        }} aria-pressed={s === semester} aria-label={`Edit ${slotLabel(s)}, ${units(coursesIn(s))} units`} onClick={() => setSemester(s)}><b>{short(s)} · {units(coursesIn(s))}u</b><small>{term(s).split(" \u00b7 ")[0].toUpperCase()}{units(coursesIn(s)) ? ` · ${units(coursesIn(s)) > 17 ? "HEAVY LOAD" : units(coursesIn(s)) >= 12 ? "TYPICAL LOAD" : "LIGHTER LOAD"}` : completedIn(s).length ? " · DONE" : ""}</small></button>)}</div>
        <div className="pb-tools"><button className="pb-ghost" disabled={busy || planningStore.nextSemester > 100} onClick={extend}><Plus size={16}/>Semester</button><button className="pb-ghost" disabled={busy} onClick={() => addOptional("summer")}><Plus size={16}/>Summer term</button><button className="pb-ghost" disabled={busy} onClick={() => addOptional("winter")}><Plus size={16}/>Winter term</button><button className="pb-ghost" disabled={busy || !semesters.length} aria-label={`Delete ${slotLabel(semester)}`} title="Returns planned courses to the library" onClick={removeSemester}><X size={16}/>Delete selected term</button></div>
        {!semesters.length && <p className="pb-note">Add a semester, Winter or Summer term to start planning.</p>}
        <p className="pb-note">{heavy.length > 0 && <><b>{heavy.map(short).join(", ")}</b> above 17 units. </>}{warningCount > 0 && <><b>{warningCount}</b> course{warningCount !== 1 ? "s" : ""} may be out of prerequisite order. </>}Drag blocks between columns to rebalance, or outside the chart to remove. Drag term labels to move whole columns, or use Alt + Left/Right. Names and dates recalculate from their new position; later terms follow in sequence. Section choices for changed dates are cleared. Select a column, then find a course in the bar below (press /).{!planned.length && " Your plan is empty. Add a course from the bar below."}</p>
      </section>
    </main>
    <footer className="pb-footer"><div className="pb-wrap"><span>CourseRadar · {catalog.name}, {catalog.catalogYear} roadmap</span><span><a href={catalog.programUrl} target="_blank" rel="noreferrer">Official program page</a> · A planning aid, not a degree audit</span></div></footer>
    <PlannerCommandBar
      target={semesters.length ? slotLabel(semester) : "a new term"}
      unplanned={remaining.length}
      query={query} onQuery={setQuery}
      subjects={subjects} subject={subject} onSubject={setSubject}
      subjectTitle={key => key === "technical" ? "From the department technical-elective list for your major" : key === "university" ? "Other courses outside your roadmap; verify university elective credit" : undefined}
      note={subject === "technical" || subject === "university" ? <small className="pb-elective-note" role="status">{subject === "technical" ? "Department-listed technical electives for your major. Verify catalog and section restrictions." : "Other university courses outside your roadmap. Confirm elective credit with your program."}</small> : undefined}
      resultCount={results.length}
      emptyText={query ? "No matching courses. Try another code or name, or switch to Ask." : remaining.length ? "Nothing to add here. Choose another subject." : "Every catalog course is in your plan."}
      canAdd={!busy && !!semesters.length}
      onAddTop={async () => {
        const course = results[0];
        if (!course || busy || !semesters.length) return null;
        const added = await change(course, semester);
        return added ? course.code : null;
      }}
      onNearEnd={() => { if (libraryLimit < results.length) appendLibrary(); }}
      pills={results.slice(0, libraryLimit).map(c => <span className={`pb-pill${takenCourseIds.has(c.id) ? " pb-done" : ""}`} key={c.id} draggable={!busy && !!semesters.length} onDragStart={e => drag(e, c)} onDragEnd={endDrag} style={tone(c)}><button className="pb-pill-open" onClick={() => open(c)}>{c.code}</button><small>{c.units}u · {takenCourseIds.has(c.id) ? "Completed" : `S${c.recommendedSemester}`}</small><button className="pb-add" disabled={busy || !semesters.length} aria-label={`Add ${c.code} to ${slotLabel(semester)}`} onClick={() => { void change(c, semester); }}><Plus size={13}/></button></span>)}
    />
    <dialog ref={dialog} className="pb-dialog" aria-labelledby="pb-course-title" onCancel={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setSelected(null); } }} onClose={() => setSelected(null)}>{selected && <><header><small>{subjectOf(selected).label.toUpperCase()} · {selected.units} UNITS{takenCourseIds.has(selected.id) ? " · COMPLETED" : ""}</small><h2 id="pb-course-title">{selected.code}</h2><p>{selected.title}</p><button className="pb-icon" aria-label="Close course details" onClick={() => setSelected(null)}><X size={16}/></button></header>{!takenCourseIds.has(selected.id) && issues(selected, target).length > 0 && <p className="pb-warning">{issues(selected, target).join(" · ")}. Review recorded requirements before enrolling.</p>}<section><h3>About this course</h3><p>{selected.description}</p><h3>Recorded prerequisites</h3><p>{selected.prerequisiteText || "No additional prerequisite text recorded."}</p><a href={selected.sourceUrl} target="_blank" rel="noreferrer">Official course requirements <ArrowUpRight size={14}/></a></section><footer><button className="pb-ghost pb-completion" aria-pressed={takenCourseIds.has(selected.id)} disabled={busy} onClick={() => complete(selected)}>{takenCourseIds.has(selected.id) ? "Mark incomplete" : "Mark completed"}</button><button className="pb-ghost" onClick={() => { setFullDetails(selected); setSelected(null); }}>Listed sections &amp; full details<ArrowUpRight size={14}/></button><><label>Semester<select aria-label="Move or add to semester" value={target} onChange={e => setTarget(parseSlot(e.target.value))}>{semesters.map(s => <option key={s} value={s}>{slotLabel(s)} · {term(s)}</option>)}</select></label><button className="pb-btn" disabled={busy || !semesters.includes(target) || plans[selected.id]?.semester === target} onClick={() => { const course = selected; setSelected(null); void change(course, target); }}>{plans[selected.id] ? "Move course" : "Add course"}</button>{plans[selected.id] && <button className="pb-ghost" disabled={busy} onClick={() => { void remove(selected); }}>Remove from plan</button>}</></footer></>}</dialog>
    {fullDetails && <CourseDetail course={fullDetails} onClose={() => setFullDetails(null)}/>}

  </div>;
}
