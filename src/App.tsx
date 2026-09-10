import { useMemo, useState } from "react";
import {
  ArrowSquareOut,
  BookOpen,
  CaretRight,
  CheckCircle,
  Database,
  GraduationCap,
  MagnifyingGlass,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useCatalog } from "./CatalogContext";
import type { Course } from "./types";

function CourseDetail({ course, onClose }: { course: Course; onClose: () => void }) {
  const { courseById } = useCatalog();
  const prerequisites = course.prerequisiteCourseIds
    .map((id) => courseById.get(id))
    .filter((item): item is Course => Boolean(item));

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="course-title">
        <header className="drawer-header">
          <div><span className="course-code">{course.code}</span><h2 id="course-title">{course.title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close course details"><X size={20} /></button>
        </header>
        <div className="drawer-content">
          <div className="course-facts">
            <span><BookOpen size={17} />{course.units} units</span>
            <span><GraduationCap size={17} />Recommended term {course.recommendedSemester}</span>
          </div>
          <p>{course.description}</p>
          <section className="prerequisite-section">
            <h3>Prerequisites</h3>
            {prerequisites.length ? (
              <div className="prerequisite-list">
                {prerequisites.map((item) => (
                  <div key={item.id}><strong>{item.code}</strong><span>{item.title}</span></div>
                ))}
              </div>
            ) : <div className="no-prerequisite"><CheckCircle size={19} weight="fill" />No course prerequisite recorded in this draft.</div>}
          </section>
          <aside className="draft-warning">
            <WarningCircle size={20} weight="fill" />
            <p>This is draft imported data. Confirm the exact prerequisite wording in the official catalog before publishing it as reviewed.</p>
          </aside>
        </div>
        <footer className="drawer-footer">
          <a href={course.sourceUrl} target="_blank" rel="noreferrer">Open official source <ArrowSquareOut size={16} /></a>
        </footer>
      </aside>
    </div>
  );
}

export default function App() {
  const { catalog, mode } = useCatalog();
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
        <span className="header-program">SJSU Computer Engineering</span>
        <a className="source-link" href={catalog.programUrl} target="_blank" rel="noreferrer">Program source <ArrowSquareOut size={15} /></a>
      </header>

      <main id="top">
        <section className="page-intro">
          <div>
            <p className="eyebrow">BSCMPE GRADUATION REQUIREMENTS</p>
            <h1>Computer Engineering requirements, in one place.</h1>
            <p>Browse the draft catalog structure and inspect the prerequisite chain behind every recorded course.</p>
          </div>
          <dl className="catalog-summary">
            <div><dt>Catalog</dt><dd>{catalog.catalogYear}</dd></div>
            <div><dt>Courses</dt><dd>{catalog.courses.length}</dd></div>
            <div><dt>Data</dt><dd><Database size={15} />{mode === "database" ? "PostgreSQL" : "Local draft"}</dd></div>
          </dl>
        </section>

        <aside className="source-notice">
          <WarningCircle size={20} weight="fill" />
          <div><strong>Draft dataset</strong><p>SJSU could not be reached during this implementation pass. These records are based on the existing Fall 2024 BSCMPE prerequisite-chart reference and are not yet source-reviewed.</p></div>
          <a href={catalog.sourceUrl} target="_blank" rel="noreferrer">View chart <ArrowSquareOut size={14} /></a>
        </aside>

        <section className="requirements" aria-labelledby="requirements-title">
          <div className="requirements-toolbar">
            <div><h2 id="requirements-title">Graduation requirement groups</h2><p>{catalog.requirementGroups.length} groups in the current draft</p></div>
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
                      <span>Pending catalog review</span>
                    </div>
                  );
                  const course = catalog.courses.find((candidate) => candidate.id === item.courseId);
                  if (!course) return null;
                  return (
                    <button className="requirement-row course-row" key={item.id} onClick={() => setSelectedCourse(course)}>
                      <span className="course-code">{course.code}</span>
                      <div><strong>{course.title}</strong><p>{course.prerequisiteCourseIds.length ? `${course.prerequisiteCourseIds.length} recorded prerequisite${course.prerequisiteCourseIds.length === 1 ? "" : "s"}` : "No recorded course prerequisite"}</p></div>
                      <span className="units">{course.units} units</span>
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
