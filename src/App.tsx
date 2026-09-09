import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  BookOpen,
  CalendarBlank,
  CaretRight,
  Clock,
  FunnelSimple,
  GitBranch,
  GraduationCap,
  Info,
  MagnifyingGlass,
  MapPin,
  X,
} from "@phosphor-icons/react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { MAJOR, TERM, allCourseById, getCourseSections, majors, roadmaps, scheduleSource, type MajorName } from "./data";
import type { Availability, Course, Section } from "./types";

const days = ["All days", "Mon", "Tue", "Wed", "Thu"];
const statusLabel: Record<Availability, string> = {
  open: "Open",
  closed: "Closed",
  waitlist: "Waitlist",
  unknown: "Unknown",
};

type SavedSelection = {
  major: MajorName;
  term: string;
  startSeason: "Fall" | "Spring";
  startYear: number;
  setMajor: (value: MajorName) => void;
  setTerm: (value: string) => void;
  setStartSeason: (value: "Fall" | "Spring") => void;
  setStartYear: (value: number) => void;
};

function useSavedSelection(): SavedSelection {
  const savedMajor = localStorage.getItem("course-radar-major");
  const [major, setMajorState] = useState<MajorName>(() => majors.includes(savedMajor as MajorName) ? savedMajor as MajorName : MAJOR);
  const [term, setTermState] = useState(() => localStorage.getItem("course-radar-term") || TERM);
  const [startSeason, setStartSeasonState] = useState<"Fall" | "Spring">(() => localStorage.getItem("course-radar-start-season") === "Spring" ? "Spring" : "Fall");
  const [startYear, setStartYearState] = useState(() => Number(localStorage.getItem("course-radar-start-year")) || 2026);

  const setMajor = (value: MajorName) => {
    setMajorState(value as MajorName);
    localStorage.setItem("course-radar-major", value);
  };
  const setTerm = (value: string) => {
    setTermState(value);
    localStorage.setItem("course-radar-term", value);
  };
  const setStartSeason = (value: "Fall" | "Spring") => {
    setStartSeasonState(value);
    localStorage.setItem("course-radar-start-season", value);
  };
  const setStartYear = (value: number) => {
    setStartYearState(value);
    localStorage.setItem("course-radar-start-year", String(value));
  };

  return { major, term, startSeason, startYear, setMajor, setTerm, setStartSeason, setStartYear };
}

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Course Radar home">
      <span className="brand-mark"><GitBranch size={20} weight="bold" /></span>
      <span>Course Radar</span>
    </Link>
  );
}

function Header() {
  const location = useLocation();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav aria-label="Primary navigation">
          <Link className={location.pathname === "/" ? "nav-link active" : "nav-link"} to="/">Courses</Link>
          <Link className={location.pathname === "/roadmap" ? "nav-link active" : "nav-link"} to="/roadmap">Roadmap</Link>
        </nav>
        <a className="source-link header-source" href={scheduleSource} target="_blank" rel="noreferrer">
          SJSU source <ArrowSquareOut size={15} />
        </a>
      </div>
    </header>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell"><Header />{children}</div>;
}

function FilterSelect({ label, value, children, onChange }: { label: string; value: string; children: React.ReactNode; onChange: (value: string) => void }) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function StatusBadge({ status, seats }: { status: Availability; seats: number | null }) {
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {statusLabel[status]}{status === "open" && seats !== null ? ` · ${seats} ${seats === 1 ? "seat" : "seats"}` : ""}
    </span>
  );
}

function sectionSummary(section: Section) {
  const first = section.meetings[0];
  if (!first || !first.startTime) return "TBA";
  return `${first.days.join("/")} · ${first.startTime}`;
}

function CourseCard({ course, courseSections, onOpen }: { course: Course; courseSections: Section[]; onOpen: () => void }) {
  const openCount = courseSections.filter((section) => section.availability === "open").length;
  const firstSection = courseSections[0];
  return (
    <article className="course-card">
      <button className="course-card-button" onClick={onOpen} aria-label={`Open ${course.code} details`}>
        <div className="course-card-top">
          <span className="course-code">{course.code}</span>
          <StatusBadge status={openCount > 0 ? "open" : "closed"} seats={null} />
        </div>
        <h2>{course.title}</h2>
        <p className="course-description">{course.description}</p>
        <div className="course-meta">
          <span><CalendarBlank size={17} /> {courseSections.length} sections</span>
          <span><Clock size={17} /> {firstSection ? sectionSummary(firstSection) : "TBA"}</span>
        </div>
        <div className="course-card-footer">
          <span>{firstSection?.instructor ?? "Instructor TBA"}</span>
          <span className="open-detail">View details <CaretRight size={16} weight="bold" /></span>
        </div>
      </button>
    </article>
  );
}

function CourseDetail({ course, plannedTerm, onClose }: { course: Course; plannedTerm: string; onClose: () => void }) {
  const navigate = useNavigate();
  const courseSections = getCourseSections(course.id);
  const prerequisites = course.prerequisiteCourseIds.map((id) => allCourseById.get(id)).filter(Boolean) as Course[];

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="course-detail-title">
        <div className="drawer-header">
          <div>
            <span className="course-code">{course.code}</span>
            <h2 id="course-detail-title">{course.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close details"><X size={20} /></button>
        </div>
        <div className="drawer-scroll">
          <div className="detail-intro">
            <span><BookOpen size={17} /> {course.units} units</span>
            <span><GraduationCap size={17} /> {plannedTerm}</span>
          </div>
          <p className="detail-description">{course.description}</p>

          <section className="detail-section">
            <h3>Prerequisites</h3>
            {prerequisites.length ? (
              <div className="prereq-list">
                {prerequisites.map((prereq) => <span key={prereq.id}>{prereq.code}</span>)}
              </div>
            ) : <p className="muted">No course prerequisite shown in this demo map.</p>}
          </section>

          <section className="detail-section">
            <div className="section-title-row">
              <h3>{TERM} sections</h3>
              <span>{courseSections.length}</span>
            </div>
            {courseSections.length ? courseSections.map((section) => (
              <article className="section-card" key={section.id}>
                <div className="section-card-head">
                  <strong>Section {section.sectionNumber}</strong>
                  <StatusBadge status={section.availability} seats={section.openSeats} />
                </div>
                <p className="instructor">{section.instructor ?? "Instructor TBA"}</p>
                {section.meetings.map((item, index) => (
                  <div className="meeting" key={`${section.id}-${index}`}>
                    <span><Clock size={16} /> {item.startTime ? `${item.days.join("/")} · ${item.startTime} to ${item.endTime}` : "TBA"}</span>
                    <span><MapPin size={16} /> {item.location ?? "TBA"}</span>
                  </div>
                ))}
                <div className="section-actions">
                  {section.instructor && (
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(`${section.instructor} SJSU professor reviews`)}`} target="_blank" rel="noreferrer">
                      Find reviews <ArrowSquareOut size={14} />
                    </a>
                  )}
                  <a href={section.sourceUrl} target="_blank" rel="noreferrer">Verify section <ArrowSquareOut size={14} /></a>
                </div>
              </article>
            )) : (
              <div className="empty-small"><Info size={19} /><p>No Fall 2026 section is included in this verified sample.</p></div>
            )}
          </section>
        </div>
        <div className="drawer-footer">
          <button className="primary-button" onClick={() => navigate(`/roadmap?course=${course.id}`)}>
            View on roadmap <ArrowRight size={17} weight="bold" />
          </button>
          <a className="text-button" href={course.sourceUrl} target="_blank" rel="noreferrer">Course source <ArrowSquareOut size={15} /></a>
        </div>
      </aside>
    </div>
  );
}

function ExplorerPage() {
  const { major, term, startSeason, startYear, setMajor, setTerm, setStartSeason, setStartYear } = useSavedSelection();
  const [search, setSearch] = useState("");
  const [day, setDay] = useState("All days");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const program = roadmaps[major];
  const offeredCourses = program.courses.filter((course) => getCourseSections(course.id).length > 0);
  const filteredCourses = offeredCourses.filter((course) => {
    const courseSections = getCourseSections(course.id);
    const matchesSearch = `${course.code} ${course.title}`.toLowerCase().includes(search.toLowerCase());
    const matchesDay = day === "All days" || courseSections.some((section) => section.meetings.some((item) => item.days.includes(day)));
    return matchesSearch && matchesDay;
  });

  return (
    <AppShell>
      <main>
        <section className="explorer-hero">
          <div className="hero-copy">
            <p className="eyebrow">SJSU · FALL 2026</p>
            <h1>Find the class that fits your path.</h1>
            <p>Explore verified {major} sections, then follow your own term-by-term degree path.</p>
          </div>
          <div className="term-panel">
            <FilterSelect label="Major" value={major} onChange={(value) => setMajor(value as MajorName)}>
              {majors.map((item) => <option key={item}>{item}</option>)}
            </FilterSelect>
            <FilterSelect label="Semester" value={term} onChange={setTerm}>
              <option>{TERM}</option>
            </FilterSelect>
            <FilterSelect label="Started in" value={startSeason} onChange={(value) => setStartSeason(value as "Fall" | "Spring")}>
              <option>Fall</option>
              <option>Spring</option>
            </FilterSelect>
            <FilterSelect label="Start year" value={String(startYear)} onChange={(value) => setStartYear(Number(value))}>
              {Array.from({ length: 8 }, (_, index) => 2020 + index).map((year) => <option key={year}>{year}</option>)}
            </FilterSelect>
            <Link className="roadmap-button" to="/roadmap"><GitBranch size={18} /> Open roadmap</Link>
          </div>
        </section>

        <section className="course-explorer" aria-labelledby="available-courses">
          <div className="section-heading">
            <div>
              <h2 id="available-courses">Available courses</h2>
              <p>{filteredCourses.length} of {offeredCourses.length} verified course records</p>
            </div>
            <a className="source-link" href={scheduleSource} target="_blank" rel="noreferrer">Nightly SJSU schedule <ArrowSquareOut size={15} /></a>
          </div>
          <div className="filters">
            <label className="search-field">
              <span className="sr-only">Search courses</span>
              <MagnifyingGlass size={20} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by course code or title" />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={17} /></button>}
            </label>
            <label className="day-filter">
              <FunnelSimple size={19} />
              <span className="sr-only">Filter by day</span>
              <select value={day} onChange={(event) => setDay(event.target.value)}>
                {days.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          {filteredCourses.length ? (
            <div className="course-grid">
              {filteredCourses.map((course) => <CourseCard key={course.id} course={course} courseSections={getCourseSections(course.id)} onOpen={() => setSelectedCourse(course)} />)}
            </div>
          ) : (
            <div className="empty-state">
              <MagnifyingGlass size={28} />
              <h3>No courses match these filters</h3>
              <p>Try a different day or clear your search.</p>
              <button className="secondary-button" onClick={() => { setSearch(""); setDay("All days"); }}>Clear filters</button>
            </div>
          )}
        </section>
      </main>
      <footer className="site-footer">
        <p>Planning aid only. Always confirm enrollment details in MySJSU.</p>
        <a href={program.programUrl} target="_blank" rel="noreferrer">Program requirements <ArrowSquareOut size={14} /></a>
      </footer>
      {selectedCourse && (
        <CourseDetail
          course={selectedCourse}
          plannedTerm={academicTerm(selectedCourse.recommendedSemester - 1, startSeason, startYear)}
          onClose={() => setSelectedCourse(null)}
        />
      )}
    </AppShell>
  );
}

function collectAncestors(courseId: string, programCourses: readonly Course[], found = new Set<string>()): Set<string> {
  const programMap = new Map(programCourses.map((course) => [course.id, course]));
  programMap.get(courseId)?.prerequisiteCourseIds.forEach((id) => {
    if (!found.has(id)) { found.add(id); collectAncestors(id, programCourses, found); }
  });
  return found;
}

function collectDescendants(courseId: string, programCourses: readonly Course[], found = new Set<string>()): Set<string> {
  programCourses.filter((course) => course.prerequisiteCourseIds.includes(courseId)).forEach((course) => {
    if (!found.has(course.id)) { found.add(course.id); collectDescendants(course.id, programCourses, found); }
  });
  return found;
}

function academicTerm(index: number, startSeason: "Fall" | "Spring", startYear: number) {
  if (startSeason === "Fall") {
    return index % 2 === 0 ? `Fall ${startYear + index / 2}` : `Spring ${startYear + (index + 1) / 2}`;
  }
  return index % 2 === 0 ? `Spring ${startYear + index / 2}` : `Fall ${startYear + (index - 1) / 2}`;
}

function RoadmapPage() {
  const [params, setParams] = useSearchParams();
  const { major, startSeason, startYear, setMajor, setStartSeason, setStartYear } = useSavedSelection();
  const program = roadmaps[major];
  const programCourses = program.courses;
  const selectedId = params.get("course");
  const selectedCourse = selectedId ? programCourses.find((course) => course.id === selectedId) ?? null : null;
  const ancestors = useMemo(() => selectedId ? collectAncestors(selectedId, programCourses) : new Set<string>(), [selectedId, programCourses]);
  const descendants = useMemo(() => selectedId ? collectDescendants(selectedId, programCourses) : new Set<string>(), [selectedId, programCourses]);

  const courseRole = (courseId: string) => courseId === selectedId
    ? "selected"
    : ancestors.has(courseId)
      ? "prerequisite"
      : descendants.has(courseId)
        ? "unlocked"
        : selectedId
          ? "muted"
          : "default";

  return (
    <AppShell>
      <main className="roadmap-page">
        <section className="roadmap-header">
          <div>
            <Link className="back-link" to="/"><ArrowLeft size={16} /> Course Explorer</Link>
            <h1>{program.name} roadmap</h1>
            <p>Official SJSU course sequence, mapped vertically from your first term through graduation.</p>
          </div>
          <div className="roadmap-meta">
            <div><span>PROGRAM</span><strong>{program.abbreviation}</strong></div>
            <div><span>LENGTH</span><strong>{program.semesterCount} terms</strong></div>
            <a href={program.sourceUrl} target="_blank" rel="noreferrer">{program.catalog} <ArrowSquareOut size={15} /></a>
          </div>
        </section>
        <section className="roadmap-toolbar" aria-label="Roadmap settings">
          <FilterSelect label="Major" value={major} onChange={(value) => { setMajor(value as MajorName); setParams({}); }}>
            {majors.map((item) => <option key={item}>{item}</option>)}
          </FilterSelect>
          <FilterSelect label="First term" value={startSeason} onChange={(value) => setStartSeason(value as "Fall" | "Spring")}>
            <option>Fall</option>
            <option>Spring</option>
          </FilterSelect>
          <FilterSelect label="Enrollment year" value={String(startYear)} onChange={(value) => setStartYear(Number(value))}>
            {Array.from({ length: 8 }, (_, index) => 2020 + index).map((year) => <option key={year}>{year}</option>)}
          </FilterSelect>
          <div className="legend" aria-label="Roadmap legend">
            <span><i className="legend-selected" /> Selected</span>
            <span><i className="legend-prereq" /> Prerequisite</span>
            <span><i className="legend-unlocked" /> Unlocks</span>
            {selectedId && <button onClick={() => setParams({})}><X size={15} /> Clear</button>}
          </div>
        </section>
        <aside className="official-source-note">
          <Info size={18} weight="fill" />
          <p>{program.sourceNote}</p>
          <a href={program.sourceUrl} target="_blank" rel="noreferrer">Open official chart <ArrowSquareOut size={14} /></a>
        </aside>
        <section className="vertical-roadmap" aria-label={`${program.name} term-by-term roadmap`}>
          {Array.from({ length: program.semesterCount }, (_, index) => {
            const termLabel = academicTerm(index, startSeason, startYear);
            const isCurrent = termLabel === TERM;
            const termCourses = programCourses.filter((course) => course.recommendedSemester === index + 1);
            return (
              <article className={isCurrent ? "term-row current-term" : "term-row"} key={`${major}-${index}`}>
                <div className="term-marker" aria-hidden="true"><span /></div>
                <div className="term-label">
                  <span>Year {Math.floor(index / 2) + 1}</span>
                  <h2>{termLabel}</h2>
                  {isCurrent && <strong>Current term</strong>}
                </div>
                <div className="term-courses">
                  {termCourses.map((course) => {
                    const role = courseRole(course.id);
                    const courseSections = getCourseSections(course.id);
                    return (
                      <button className={`timeline-course timeline-${role}`} key={course.id} onClick={() => setParams({ course: course.id })}>
                        <span>{course.code}</span>
                        <strong>{course.title}</strong>
                        <small>
                          {courseSections.length ? `${courseSections.length} Fall 2026 sections` : `${course.units} units`}
                          {course.prerequisiteCourseIds.length ? ` · ${course.prerequisiteCourseIds.length} prereq` : ""}
                        </small>
                        <CaretRight size={16} />
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      </main>
      {selectedCourse && (
        <CourseDetail
          course={selectedCourse}
          plannedTerm={academicTerm(selectedCourse.recommendedSemester - 1, startSeason, startYear)}
          onClose={() => setParams({})}
        />
      )}
    </AppShell>
  );
}

export default function App() {
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);

  return (
    <Routes>
      <Route path="/" element={<ExplorerPage />} />
      <Route path="/roadmap" element={<RoadmapPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
