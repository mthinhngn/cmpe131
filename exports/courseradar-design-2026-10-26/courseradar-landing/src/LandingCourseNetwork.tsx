import { useState } from "react";
import { Search } from "lucide-react";

type CourseStatus = "complete" | "current" | "ready" | "locked";
type Course = {
  id: string;
  code: string;
  title: string;
  term: string;
  status: CourseStatus;
  x: number;
  y: number;
  prerequisites: string[];
  credits: number;
};

const courses: Course[] = [
  { id: "cs101", code: "CS 101", title: "Intro to Programming", term: "Fall · Year 1", status: "complete", x: 145, y: 36, prerequisites: [], credits: 4 },
  { id: "math151", code: "MATH 151", title: "Calculus I", term: "Fall · Year 1", status: "complete", x: 355, y: 36, prerequisites: [], credits: 4 },
  { id: "cs201", code: "CS 201", title: "Data Structures", term: "Spring · Year 1", status: "current", x: 145, y: 126, prerequisites: ["cs101"], credits: 4 },
  { id: "math152", code: "MATH 152", title: "Calculus II", term: "Spring · Year 1", status: "ready", x: 355, y: 126, prerequisites: ["math151"], credits: 4 },
  { id: "cs230", code: "CS 230", title: "Discrete Mathematics", term: "Spring · Year 1", status: "ready", x: 565, y: 126, prerequisites: [], credits: 3 },
  { id: "cs301", code: "CS 301", title: "Algorithms", term: "Fall · Year 2", status: "locked", x: 145, y: 216, prerequisites: ["cs201", "math152", "cs230"], credits: 4 },
  { id: "cs340", code: "CS 340", title: "Operating Systems", term: "Spring · Year 2", status: "locked", x: 355, y: 306, prerequisites: ["cs201"], credits: 4 },
  { id: "cs390", code: "CS 390", title: "Applied Machine Learning", term: "Fall · Year 3", status: "locked", x: 145, y: 396, prerequisites: ["cs301", "math152"], credits: 3 },
];

const semesterRows = [
  { year: "YEAR 1", term: "Fall", count: 2, credits: 8, y: 36 },
  { year: "YEAR 1", term: "Spring", count: 3, credits: 11, y: 126 },
  { year: "YEAR 2", term: "Fall", count: 1, credits: 4, y: 216 },
  { year: "YEAR 2", term: "Spring", count: 1, credits: 4, y: 306 },
  { year: "YEAR 3", term: "Fall", count: 1, credits: 3, y: 396 },
];

const edges = courses.flatMap((course) =>
  course.prerequisites.map((prerequisiteId) => ({ from: prerequisiteId, to: course.id })),
);

const statusLabels: Record<CourseStatus, string> = {
  complete: "Completed",
  current: "In progress",
  ready: "Ready to take",
  locked: "Up next",
};

function CourseNode({
  course,
  compact,
  selected,
  related,
  dimmed,
  onSelect,
  onHover,
}: {
  course: Course;
  compact: boolean;
  selected: boolean;
  related: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const cardWidth = compact ? 150 : 190;
  const contentRight = cardWidth - 12;

  return (
    <g
      className={`course-node node-${course.status}${selected ? " is-selected" : ""}${related && !selected ? " is-related" : ""}${dimmed ? " is-dimmed" : ""}`}
      transform={`translate(${course.x} ${course.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${course.code}, ${course.title}. ${statusLabels[course.status]}. Select to inspect prerequisites.`}
      aria-pressed={selected}
      onClick={() => onSelect(course.id)}
      onMouseEnter={() => onHover(course.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(course.id)}
      onBlur={() => onHover(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(course.id);
        }
      }}
    >
      <rect className="node-surface" width={cardWidth} height="72" rx="8" />
      <rect className="node-accent" x="1" y="1" width={cardWidth - 2} height="3" rx="1.5" />
      <text className="node-code" x="12" y="19">{course.code}</text>
      <text className="node-credits" x={contentRight} y="19" textAnchor="end">{course.credits} credits</text>
      <text className="node-name" x="12" y="39">{course.title}</text>
      <line className="node-divider" x1="12" y1="49" x2={contentRight} y2="49" />
      <circle className="node-state-dot" cx="15" cy="61" r="3" />
      <text className="node-status" x="24" y="64">{statusLabels[course.status]}</text>
    </g>
  );
}

const semesters = ["Fall 2026", "Spring 2027", "Fall 2027"];

export default function CourseNetwork({
  variant = "default",
  density = "comfortable",
}: {
  variant?: "default" | "hero";
  density?: "comfortable" | "compact";
}) {
  const [selectedId, setSelectedId] = useState("cs301");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const [semester, setSemester] = useState(semesters[0]);
  const [semesterMenuOpen, setSemesterMenuOpen] = useState(false);
  const [zoom, setZoom] = useState(density === "compact" ? 0.82 : 1);
  const [shareState, setShareState] = useState("Share plan");
  const compact = density === "compact";
  const cardWidth = compact ? 150 : 190;

  const selectedCourse = courses.find((course) => course.id === selectedId) ?? courses[0];
  const activeId = hoveredId ?? selectedId;
  const activeCourse = courses.find((course) => course.id === activeId) ?? selectedCourse;
  const selectedPrerequisiteCourses = selectedCourse.prerequisites
    .map((id) => courses.find((course) => course.id === id))
    .filter((course): course is Course => Boolean(course));
  const nextCourses = courses.filter((course) => course.prerequisites.includes(activeCourse.id));
  const litCourseIds = new Set([
    activeCourse.id,
    ...activeCourse.prerequisites,
    ...nextCourses.map((course) => course.id),
  ]);
  const matches = (course: Course, value: string) =>
    `${course.code} ${course.title}`.toLowerCase().includes(value.trim().toLowerCase());
  const filteredCourses = courses.filter((course) => matches(course, query));

  function updateSearch(value: string) {
    setQuery(value);
    if (value.trim()) {
      const match = courses.find((course) => matches(course, value));
      if (match) setSelectedId(match.id);
    }
  }

  async function sharePlan() {
    const url = `${window.location.origin}${window.location.pathname}#course-map`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Course Radar plan", url });
        return;
      }
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setShareState("Link copied");
    } catch {
      setShareState("Share unavailable");
    }
    window.setTimeout(() => setShareState("Share plan"), 1800);
  }

  return (
    <div className={`radar-app${variant === "hero" ? " radar-app--hero" : ""}${density === "compact" ? " radar-app--compact" : ""}`} aria-label="Interactive Course Radar product preview">
      <div className="radar-appbar">
        <div className="degree-path-label">
          <span className="app-orbit-mark" aria-hidden="true"><i /><i /><i /></span>
          <span className="appbar-overline">MY DEGREE PLAN</span>
          <span className="appbar-divider">/</span>
          <strong>Computer Science</strong>
          <span className="degree-chip">B.S.</span>
        </div>
        <div className="appbar-actions">
          <div className="semester-picker">
            <button className="semester-button" type="button" aria-label={`Select semester, currently ${semester}`} aria-expanded={semesterMenuOpen} onClick={() => setSemesterMenuOpen((open) => !open)}>
              {semester} <span aria-hidden="true">⌄</span>
            </button>
            {semesterMenuOpen && <div className="semester-menu" role="group" aria-label="Choose a semester">
              {semesters.map((term) => (
                <button type="button" key={term} aria-pressed={semester === term} onClick={() => { setSemester(term); setSemesterMenuOpen(false); }}>{term}</button>
              ))}
            </div>}
          </div>
          <button className="share-button" type="button" aria-label={shareState} onClick={sharePlan}>
            <span className="share-glyph" aria-hidden="true">↗</span><span>{shareState}</span>
          </button>
          <div className="student-avatar" aria-label="Signed in as Casey Morgan">CM</div>
        </div>
      </div>

      <div className="radar-workspace">
        <aside className="radar-sidebar">
          <div className="sidebar-kicker">PLANNING OVERVIEW</div>
          <div className="degree-progress-card">
            <div className="progress-heading"><span>Degree progress</span><strong>64%</strong></div>
            <div className="progress-track"><span /></div>
            <div className="progress-caption">11 of 17 core courses mapped</div>
          </div>
          <div className="sidebar-list-heading">YOUR PATH</div>
          <ol className="semester-list">
            <li className="semester-item is-done"><span className="semester-check">✓</span><span><strong>Year 1</strong><small>2 courses complete</small></span><span className="semester-caret">⌄</span></li>
            <li className="semester-item is-active"><span className="semester-number">02</span><span><strong>Year 2</strong><small>2 courses mapped</small></span><span className="semester-caret">⌄</span></li>
            <li className="semester-item"><span className="semester-number">03</span><span><strong>Year 3</strong><small>1 course mapped</small></span><span className="semester-caret">›</span></li>
            <li className="semester-item"><span className="semester-number">04</span><span><strong>Year 4</strong><small>Build your finish</small></span><span className="semester-caret">›</span></li>
          </ol>
          <div className="sidebar-note"><span className="note-sparkle">✳</span><span>One clear path at a time.</span></div>
          <div className="sidebar-user"><span className="user-avatar">CM</span><span><strong>Casey Morgan</strong><small>Class of 2027</small></span><span className="user-menu">···</span></div>
        </aside>

        <div className="radar-main">
          <div className="map-toolbar">
            <div className="map-tabs" role="group" aria-label="Course map display">
              <button type="button" aria-pressed={view === "map"} className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}>Prerequisite map</button>
              <button type="button" aria-pressed={view === "list"} className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>Course list <span>8</span></button>
            </div>
            <label className="map-search">
              <Search size={14} strokeWidth={1.8} aria-hidden="true" />
              <input
                type="search"
                placeholder="Find a course"
                value={query}
                onChange={(event) => updateSearch(event.target.value)}
                aria-label="Find a course in the prerequisite map"
              />
              {query && <button type="button" onClick={() => updateSearch("")} aria-label="Clear course search">×</button>}
            </label>
          </div>

          {view === "map" ? (
            <>
              <div className="map-canvas">
<div className="map-scroll" tabIndex={0} role="region" aria-label="Scrollable course map">
                <div className="map-canvas-meta"><span>CORE CURRICULUM</span><span>8 COURSES <b>·</b> 30 CREDITS</span></div>
                <svg className="desktop-prereq-map" viewBox="0 0 790 490" role="group" aria-label="Interactive prerequisite network arranged by semester; select a course to inspect its connections" style={{ transform: `scale(${zoom})` }}>
                  <title>Course prerequisite network</title>
                  <defs>
                    <linearGradient id="map-fade" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#e4f2eb" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#fbfdfc" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect width="790" height="490" fill="url(#map-fade)" aria-hidden="true" />
                  <g className="semester-label-layer" aria-hidden="true">
                    {semesterRows.map((row) => (
                      <g key={`${row.year}-${row.term}`}>
                        <text className="semester-year" x="18" y={row.y + 14}>{row.year}</text>
                        <text className="semester-title" x="18" y={row.y + 34}>{row.term} semester</text>
                        <text className="semester-summary" x="18" y={row.y + 51}>{row.count} {row.count === 1 ? "course" : "courses"} · {row.credits} credits</text>
                        <line className="semester-rule" x1="18" y1={row.y + 63} x2="121" y2={row.y + 63} />
                        <line className="semester-divider" x1="133" y1={row.y - 9} x2="133" y2={row.y + 83} />
                      </g>
                    ))}
                  </g>
                  <g className="edge-layer" aria-hidden="true">
                    {edges.map(({ from, to }) => {
                      const source = courses.find((course) => course.id === from)!;
                      const target = courses.find((course) => course.id === to)!;
                      const startX = source.x + cardWidth / 2;
                      const startY = source.y + 72;
                      const endX = target.x + cardWidth / 2;
                      const endY = target.y;
                      const controlY = Math.max(18, Math.min(64, (endY - startY) * 0.46));
                      const lit = litCourseIds.has(from) && litCourseIds.has(to);
                      return (
                        <path
                          key={`${from}-${to}`}
                          className={`graph-edge${lit ? " is-lit" : ""}`}
                          d={`M ${startX} ${startY} C ${startX} ${startY + controlY}, ${endX} ${endY - controlY}, ${endX} ${endY}`}
                        />
                      );
                    })}
                  </g>
                  <g className="node-layer">
                    {courses.map((course) => (
                      <CourseNode
                        key={course.id}
                        course={course}
                        compact={compact}
                        selected={course.id === selectedId}
                        related={litCourseIds.has(course.id)}
                        dimmed={Boolean(query) && !matches(course, query)}
                        onSelect={setSelectedId}
                        onHover={setHoveredId}
                      />
                    ))}
                  </g>
                </svg>

                <div className="mobile-prereq-map" aria-label="Course prerequisite map, simplified for smaller screens">
                  <div className="mobile-map-intro"><span className="mobile-map-dot" />Select a course to inspect its prerequisites</div>
                  {courses.map((course) => {
                    const prerequisites = course.prerequisites
                      .map((id) => courses.find((item) => item.id === id)?.code)
                      .filter(Boolean);
                    return (
                      <div className={`mobile-course-row${course.id === selectedId ? " is-selected" : ""}${query && !matches(course, query) ? " is-dimmed" : ""}`} key={course.id}>
                        <button
                          className={`mobile-course-button node-${course.status}`}
                          type="button"
                          aria-pressed={course.id === selectedId}
                          onClick={() => setSelectedId(course.id)}
                        >
                          <span className="mobile-course-top"><strong>{course.code}</strong><span className="mobile-course-units">{course.credits} credits</span><span className="mobile-status">{statusLabels[course.status]}</span></span>
                          <span className="mobile-course-name">{course.title}</span>
                          <span className="mobile-course-deps">{course.term} · {prerequisites.length ? `Requires ${prerequisites.join(" · ")}` : "Foundation course"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                </div>
<div className="map-canvas-footer">
<div className="map-legend"><span><i className="legend-dot complete" />Completed</span><span><i className="legend-dot current" />In progress</span><span><i className="legend-dot future" />Up next</span></div>
                <div className="map-zoom" role="group" aria-label="Map zoom controls">
                  <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.2, Number((value + 0.1).toFixed(1))))}>+</button>
                  <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.1).toFixed(1))))}>−</button>
                  <button type="button" aria-label="Reset map zoom" onClick={() => setZoom(1)}>↗</button>
                </div>
              </div>
</div>
              <div className="course-detail-strip" aria-live="polite">
                <div className={`detail-state detail-${selectedCourse.status}`}><span />{statusLabels[selectedCourse.status]}</div>
                <div className="detail-course"><strong>{selectedCourse.code}</strong><span>{selectedCourse.title}</span></div>
                <div className="detail-requirements">
                  {selectedPrerequisiteCourses.length ? (
                    <><span className="detail-label">Requires</span>{selectedPrerequisiteCourses.map((course) => <span className="requirement-chip" key={course.id}>{course.code}</span>)}</>
                  ) : <span className="detail-label">No prerequisites · {selectedCourse.credits} credits</span>}
                </div>
                <span className="detail-term">{selectedCourse.term}</span>
              </div>
            </>
          ) : (
            <div className="course-list-view" role="region" aria-label="Course list">
              {filteredCourses.map((course) => {
                const prerequisites = course.prerequisites.map((id) => courses.find((item) => item.id === id)?.code).filter(Boolean);
                return (
                  <button className={`course-list-row${course.id === selectedId ? " is-selected" : ""}`} type="button" key={course.id} onClick={() => { setSelectedId(course.id); setView("map"); }}>
                    <span className={`list-status-dot ${course.status}`} />
                    <strong>{course.code}</strong>
                    <span className="list-course-name">{course.title}</span>
                    <span className="list-prerequisites">{prerequisites.length ? prerequisites.join(" · ") : "Foundation"}</span>
                    <span className="list-course-credits">{course.credits} cr</span>
                    <span className="list-course-term">{course.term}</span>
                  </button>
                );
              })}
              {filteredCourses.length === 0 && <p className="empty-search">No courses match “{query}”. Try a course code or title.</p>}
            </div>
          )}
        </div>
      </div>
      <div className="radar-statusbar"><span><i className="status-online-dot" />Plan synced</span><span>Requirements shown for 2026–27 <b>·</b> <a href="/#how-it-works">How paths connect</a></span><span className="statusbar-right">Built for the long view <i>↗</i></span></div>
    </div>
  );
}
