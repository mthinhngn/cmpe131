import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowSquareOut,
  BookOpen,
  CalendarBlank,
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  Database,
  GraduationCap,
  MapPin,
  MagnifyingGlass,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { useCatalog } from "./CatalogContext";
import { CourseStateBadge } from "./CourseState";
import type { Course } from "./types";

export function CourseDetail({ course, onClose }: { course: Course; onClose: () => void }) {
  const { catalog, courseById, takenCourseIds, toggleTakenCourse, plans, setPlan, removePlan } = useCatalog();
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select, summary, input') ?? []).filter(element => element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", listener);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", listener); origin?.focus(); };
  }, []);
  const isTaken = takenCourseIds.has(course.id);
  const [selectedTerm, setSelectedTerm] = useState(catalog.currentTerm.name);
  const hasTermData = selectedTerm === catalog.currentTerm.name;
  const semesterChoices = Array.from({ length: 5 }, (_, index) => 2026 - index)
    .flatMap((year) => [`Fall ${year}`, `Spring ${year}`]);
  const prerequisites = course.prerequisiteCourseIds
    .map((id) => courseById.get(id))
    .filter((item): item is Course => Boolean(item));
  const corequisites = course.corequisiteCourseIds
    .map((id) => courseById.get(id))
    .filter((item): item is Course => Boolean(item));
  const offerings = hasTermData ? catalog.offerings.filter((offering) => offering.courseCode === course.code) : [];
  const scheduleSnapshotDate = catalog.currentTerm.fetchedAt
    ? new Date(catalog.currentTerm.fetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Not available";

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside ref={dialog} className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="course-title">
        <header className="drawer-header">
          <div><span className="course-code">{course.code}</span><h2 id="course-title">{course.title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close course details"><X size={20} /></button>
        </header>
        <div className="drawer-content">
          <section className="taken-control" aria-label="Course completion">
            <button type="button" aria-pressed={isTaken} onClick={() => { if (!isTaken) removePlan(course.id); toggleTakenCourse(course.id); }}>
              <CheckCircle size={19} weight={isTaken ? "fill" : "regular"} />
              {isTaken ? "Already taken · Undo" : "Mark as already taken"}
            </button>
            <p role="status">{isTaken ? "Marked with a red line on your chart." : "Mark this course to cross it out on your chart."} Marks reset when you refresh.</p>
          </section>
          <section className="plan-controls" aria-label="Plan this course">
            <label>Plan semester<select value={plans[course.id]?.semester ?? ""} onChange={event => { if (event.target.value) setPlan(course.id, Number(event.target.value)); else removePlan(course.id); }}><option value="">Not planned</option>{catalog.requirementGroups.map((group, index) => <option key={group.id} value={index + 1}>Semester {index + 1}</option>)}</select></label>
            {plans[course.id] && <label>Course status<select value={plans[course.id].status} onChange={event => setPlan(course.id, plans[course.id].semester, event.target.value as "planned" | "in-progress")}><option value="planned">Planned</option><option value="in-progress">In progress</option></select></label>}
            <p>Session draft · Changes reset on refresh. Planning does not enroll you.</p>
          </section>
          <div className="course-facts">
            <span><BookOpen size={17} />{course.units} {course.units === 1 ? "unit" : "units"}</span>
            <span><GraduationCap size={17} />Recommended semester {course.recommendedSemester}</span>
          </div>
          <p>{course.description}</p>
          {catalog.requirementGroups.flatMap((group) => group.items).find((item) => item.courseId === course.id)?.description && <p>{catalog.requirementGroups.flatMap((group) => group.items).find((item) => item.courseId === course.id)?.description}</p>}
          <section className="prerequisite-section">
            <h3>Prerequisites</h3>
            {prerequisites.length ? (
              <div className="prerequisite-list">
                {prerequisites.map((item) => (
                  <div key={item.id}><strong>{item.code}</strong><span>{item.title}</span></div>
                ))}
              </div>
            ) : <div className="no-prerequisite"><CheckCircle size={19} weight="fill" />No roadmap course prerequisite recorded.</div>}
            {course.prerequisiteText && <p>{course.prerequisiteText}</p>}
          </section>
          {corequisites.length > 0 && <section className="prerequisite-section"><h3>Corequisites</h3><div className="prerequisite-list">{corequisites.map((item) => <div key={item.id}><strong>{item.code}</strong><span>{item.title}</span></div>)}</div></section>}
          <section className="offerings-section">
            <header className="offerings-header">
              <div><span className="current-term-label">Semester</span>
                <details className="semester-picker" onKeyDown={(event) => {
                  if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
                }} onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
                }}>
                  <summary>{selectedTerm} <CaretDown size={16} /></summary>
                  <div className="semester-options" role="group" aria-label="Choose semester">
                    {semesterChoices.map((term) => <button type="button" key={term} aria-pressed={selectedTerm === term} onClick={(event) => {
                      setSelectedTerm(term);
                      const picker = event.currentTarget.closest("details");
                      if (picker) { picker.open = false; picker.querySelector("summary")?.focus(); }
                    }}><span>{term}</span>{term === catalog.currentTerm.name && <small>Current</small>}</button>)}
                  </div>
                </details>
              </div>
              <span>{hasTermData ? `${offerings.length} listed` : "Data pending"}</span>
            </header>
            {hasTermData && <p className="offerings-note">All SJSU-listed sections are shown, including sections with no open seats. Snapshot: {scheduleSnapshotDate}. Click a section to find its professor on Rate My Professors.</p>}
            {offerings.length ? <div className="offering-list">
              {offerings.map((offering) => {
                const isOpen = offering.openSeats > 0;
                return <article className="offering-card" key={offering.classNumber} onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a, summary, details")) return;
                  const details = event.currentTarget.querySelector("details");
                  if (details) details.open = !details.open;
                }}>
                  <header>
                    <div><strong>Section {offering.sectionNumber}</strong><span>Class #{offering.classNumber} · {offering.component}</span></div>
                    <span className={`seat-status ${isOpen ? "open" : "full"}`}>{isOpen ? `${offering.openSeats} open` : "0 open seats"}</span>
                  </header>
                  <dl>
                    <div><dt><Clock size={15} />Meeting</dt><dd>{offering.days || "TBA"} · {offering.times || "TBA"}</dd></div>
                    <div><dt><MapPin size={15} />Mode</dt><dd>{offering.mode}{offering.location ? ` · ${offering.location}` : ""}</dd></div>
                    <div><dt><CalendarBlank size={15} />Dates</dt><dd>{offering.dates}</dd></div>
                    <div><dt><UsersThree size={15} />Professor</dt><dd>{offering.instructors?.join(", ") || "Not announced"}</dd></div>
                  </dl>
                  <details className="professor-links">
                    <summary>Section {offering.sectionNumber} · Rate My Professors</summary>
                    {offering.instructors?.length ? offering.instructors.map((name) => (
                      <a key={name} href={`https://www.ratemyprofessors.com/search/professors/881?q=${encodeURIComponent(name)}`} target="_blank" rel="noreferrer">Find {name} <ArrowSquareOut size={14} /></a>
                    )) : <p>SJSU has not announced a professor for this section.</p>}
                  </details>
                </article>;
              })}
            </div> : <div className="no-offerings" role="status">{hasTermData ? `This course is not listed in the ${selectedTerm} schedule.` : `${selectedTerm} section data is not available yet. Choose ${catalog.currentTerm.name} to view available data.`}</div>}
          </section>
        </div>
        <footer className="drawer-footer">
          {hasTermData ? <a href={catalog.currentTerm.sourceUrl} target="_blank" rel="noreferrer">Open {catalog.currentTerm.name} schedule <ArrowSquareOut size={16} /></a> : <a href={course.sourceUrl} target="_blank" rel="noreferrer">Open course catalog <ArrowSquareOut size={16} /></a>}
        </footer>
      </aside>
    </div>
  );
}

export default function App() {
  const { catalog, mode, program, selectProgram } = useCatalog();
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleGroups = useMemo(() => catalog.requirementGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!normalizedSearch) return true;
      if (item.type === "placeholder") return `${item.label} ${item.description}`.toLowerCase().includes(normalizedSearch);
      const course = catalog.courses.find((candidate) => candidate.id === item.courseId);
      return Boolean(course && `${course.code} ${course.title}`.toLowerCase().includes(normalizedSearch));
    }),
  })).filter((group) => group.items.length), [catalog, normalizedSearch]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top"><span className="brand-mark"><GraduationCap size={21} weight="fill" /></span><span>Course Radar</span></a>
        <Link className="header-program header-chart-link" to="/prerequisite-chart">Prerequisite chart</Link>
        <a className="source-link" href={catalog.programUrl} target="_blank" rel="noreferrer">Program source <ArrowSquareOut size={15} /></a>
      </header>

      <main id="top">
        <section className="page-intro">
          <div>
            <label className="program-picker">Degree program
              <select value={program} onChange={(event) => { setSelectedCourse(null); setSearch(""); selectProgram(event.target.value); }}>
                <option value="computer-engineering">Computer Engineering — BS</option>
                <option value="software-engineering">Software Engineering — BS</option>
              </select>
            </label>
            <p className="eyebrow">{catalog.abbreviation} GRADUATION REQUIREMENTS</p>
            <h1>{catalog.name} requirements, in one place.</h1>
            <p>Browse the official 2026-2027 four-year roadmap and inspect the prerequisite chain behind every recorded course.</p>
          </div>
          <dl className="catalog-summary">
            <div><dt>Catalog</dt><dd>{catalog.catalogYear}</dd></div>
            <div><dt>Courses</dt><dd>{catalog.courses.length}</dd></div>
            <div><dt>Data</dt><dd><Database size={15} />{mode === "database" ? "PostgreSQL" : "Local reviewed dataset"}</dd></div>
          </dl>
        </section>

        <aside className="source-notice">
          <CheckCircle size={20} weight="fill" />
          <div><strong>2026-2027 source reviewed</strong><p>Roadmap courses, units, recommended semesters, and recorded prerequisite text were checked against the official SJSU catalog on {catalog.lastVerifiedAt}.</p></div>
          <a href={catalog.sourceUrl} target="_blank" rel="noreferrer">View roadmap <ArrowSquareOut size={14} /></a>
        </aside>

        <section className="requirements" aria-labelledby="requirements-title">
          <div className="requirements-toolbar">
            <div><h2 id="requirements-title">Four-year roadmap</h2><p>{catalog.requirementGroups.length} semesters in the 2026-2027 catalog</p></div>
            <label className="search-field">
              <MagnifyingGlass size={19} />
              <span className="sr-only">Search requirements</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search course code or title" />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={16} /></button>}
            </label>
          </div>

          {visibleGroups.length ? visibleGroups.map((group) => (
            <article className="requirement-group" key={group.id}>
              <header className="group-header">
                <div><h3>{group.title}</h3><p>{group.description}</p></div>
                <span>{group.items.length} {group.items.length === 1 ? "item" : "items"}</span>
              </header>
              <div className="requirement-list">
                {group.items.map((item) => {
                  if (item.type === "placeholder") return (
                    <div className="requirement-row placeholder-row" key={item.id}>
                      <div className="placeholder-icon"><GraduationCap size={18} /></div>
                      <div><strong>{item.label}</strong><p>{item.description}</p></div>
                      <span>Requirement choice</span>
                    </div>
                  );
                  const course = catalog.courses.find((candidate) => candidate.id === item.courseId);
                  if (!course) return null;
                  return (
                    <button className="requirement-row course-row" key={item.id} onClick={() => setSelectedCourse(course)}>
                      <span className="course-code">{course.code}</span>
                      <div><strong>{course.title}</strong><p>{item.description ?? (course.prerequisiteCourseIds.length ? `${course.prerequisiteCourseIds.length} recorded prerequisite${course.prerequisiteCourseIds.length === 1 ? "" : "s"}` : "No recorded course prerequisite")}</p></div>
                      <CourseStateBadge course={course} compact />
                      <span className="units">{course.units} {course.units === 1 ? "unit" : "units"}</span>
                      <CaretRight size={17} />
                    </button>
                  );
                })}
              </div>
            </article>
          )) : (
            <div className="empty-state"><MagnifyingGlass size={28} /><h3>No matching requirements</h3><p>Try another course code or title.</p><button onClick={() => setSearch("")}>Clear search</button></div>
          )}
        </section>
      </main>

      <footer className="site-footer"><span>{catalog.dataVersion}</span><p>Planning reference only. Official SJSU catalog requirements take precedence.</p></footer>
      {selectedCourse && <CourseDetail course={selectedCourse} onClose={() => setSelectedCourse(null)} />}
    </div>
  );
}
