import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, GitBranch, GraduationCap, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { useCatalog } from "./CatalogContext";
import { CourseDetail } from "./App";
import type { Course } from "./types";
import { CourseStateBadge, courseStateLabels, useCourseState } from "./CourseState";
import { GraphDepthCanvas } from "./GraphDepthCanvas";

type GraphEdge = { from: string; to: string; kind: "prerequisite" | "corequisite" };
type DrawnEdge = GraphEdge & { key: string; path: string };

const nodeCategory = (code: string) => {
  if (code.startsWith("CMPE") || code.startsWith("CS")) return "node-cmpe";
  if (code.startsWith("MATH") || code.startsWith("ISE")) return "node-math";
  if (code.startsWith("PHYS") || code.startsWith("BIOL")) return "node-science";
  if (code.startsWith("ENGR") || code.startsWith("EE")) return "node-engineering";
  return "node-general";
};

function GraphCourseNode({ course, isSelected, isRelated, isTaken, setRef, onOpen, onEnter, onLeave }: {
  course: Course;
  isSelected: boolean;
  isRelated: boolean;
  isTaken: boolean;
  setRef: (element: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const state = useCourseState(course);
  return <button
    type="button"
    ref={setRef}
    className={`chart-node ${nodeCategory(course.code)} state-${state}${isSelected ? " selected" : ""}${!isSelected && !isRelated ? " graph-muted" : ""}${isTaken ? " is-taken" : ""}`}
    aria-label={`${course.code}: ${course.title}, ${course.units} units, ${courseStateLabels[state]}. View course details`}
    onClick={onOpen}
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
    onFocus={onEnter}
    onBlur={onLeave}
  >
    <span className="node-term">{course.units} units</span>
    <strong>{course.code}</strong>
    <p>{course.title}</p>
    <CourseStateBadge course={course} compact />
  </button>;
}

export default function PrerequisiteChart() {
  const { catalog, takenCourseIds } = useCatalog();
  const chartRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [drawnEdges, setDrawnEdges] = useState<DrawnEdge[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const highlightedCourseId = hoveredCourseId ?? activeCourseId;

  const semesters = useMemo(() => Array.from({ length: 8 }, (_, index) => ({
    number: index + 1,
    courses: catalog.courses.filter((course) => course.recommendedSemester === index + 1),
  })), [catalog.courses]);

  const edges = useMemo(() => {
    const result: GraphEdge[] = [];
    const corequisitePairs = new Set<string>();
    for (const course of catalog.courses) {
      for (const prerequisiteId of course.prerequisiteCourseIds) {
        result.push({ from: prerequisiteId, to: course.id, kind: "prerequisite" });
      }
      for (const corequisiteId of course.corequisiteCourseIds) {
        const pair = [course.id, corequisiteId].sort().join(":");
        if (!corequisitePairs.has(pair)) {
          corequisitePairs.add(pair);
          result.push({ from: course.id, to: corequisiteId, kind: "corequisite" });
        }
      }
    }
    return result;
  }, [catalog.courses]);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const draw = () => {
      const chartRect = chart.getBoundingClientRect();
      const paths = edges.flatMap((edge): DrawnEdge[] => {
        const from = nodeRefs.current.get(edge.from);
        const to = nodeRefs.current.get(edge.to);
        if (!from || !to) return [];
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();
        const sameBand = Math.abs(fromRect.top - toRect.top) < 40;

        if (sameBand) {
          const leftToRight = fromRect.left < toRect.left;
          const startX = (leftToRight ? fromRect.right : fromRect.left) - chartRect.left;
          const endX = (leftToRight ? toRect.left : toRect.right) - chartRect.left;
          const startY = fromRect.top + fromRect.height / 2 - chartRect.top;
          const endY = toRect.top + toRect.height / 2 - chartRect.top;
          const bend = Math.max(36, Math.abs(endX - startX) * 0.35);
          return [{ ...edge, key: `${edge.kind}-${edge.from}-${edge.to}`, path: `M ${startX} ${startY} C ${startX + (leftToRight ? bend : -bend)} ${startY}, ${endX - (leftToRight ? bend : -bend)} ${endY}, ${endX} ${endY}` }];
        }

        const startX = fromRect.left + fromRect.width / 2 - chartRect.left;
        const startY = fromRect.bottom - chartRect.top;
        const endX = toRect.left + toRect.width / 2 - chartRect.left;
        const endY = toRect.top - chartRect.top;
        const middleY = startY + (endY - startY) / 2;
        return [{ ...edge, key: `${edge.kind}-${edge.from}-${edge.to}`, path: `M ${startX} ${startY} C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}` }];
      });
      setDrawnEdges(paths);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(chart);
    window.addEventListener("resize", draw);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [edges]);

  const highlightedPath = useMemo(() => {
    const courseIds = new Set<string>();
    const connectionIds = new Set<string>();
    if (!highlightedCourseId) return { courseIds, connectionIds };
    courseIds.add(highlightedCourseId);
    const walk = (id: string, direction: "upstream" | "downstream") => {
      for (const edge of edges) {
        const follows = direction === "upstream" ? edge.to === id : edge.from === id;
        if (!follows) continue;
        const next = direction === "upstream" ? edge.from : edge.to;
        connectionIds.add(`${edge.kind}-${edge.from}-${edge.to}`);
        if (courseIds.has(next)) continue;
        courseIds.add(next);
        walk(next, direction);
      }
    };
    walk(highlightedCourseId, "upstream");
    walk(highlightedCourseId, "downstream");
    return { courseIds, connectionIds };
  }, [highlightedCourseId, edges]);
  const activeConnections = highlightedPath.connectionIds;
  const relatedIds = highlightedPath.courseIds;
  const focusedCourse = highlightedCourseId ? catalog.courses.find(course => course.id === highlightedCourseId) : undefined;
  const incoming = focusedCourse ? edges.filter(edge => edge.to === focusedCourse.id).map(edge => catalog.courses.find(course => course.id === edge.from)).filter((course): course is Course => Boolean(course)) : [];
  const outgoing = focusedCourse ? edges.filter(edge => edge.from === focusedCourse.id).map(edge => catalog.courses.find(course => course.id === edge.to)).filter((course): course is Course => Boolean(course)) : [];

  return (
    <div className="chart-page">
      <header className="site-header chart-header">
        <Link className="brand" to="/"><span className="brand-mark"><GraduationCap size={21} weight="fill" /></span><span>Course Radar</span></Link>
        <span className="header-program">SJSU {catalog.name}</span>
        <Link className="source-link" to="/"><ArrowLeft size={15} />Back to roadmap</Link>
      </header>

      <main className="chart-main">
        <section className="chart-title-block">
          <div>
            <p className="eyebrow">2026-2027 ACADEMIC CATALOG</p>
            <h1>B.S. in {catalog.name}<br />Prerequisite Chart</h1>
            <p>Follow each arrow downward from a prerequisite course to the course it unlocks. Hover to isolate connections; click any course to inspect its prerequisite details.</p>
            <div className="graph-toolbar">
              <label><MagnifyingGlass size={17} aria-hidden="true" /> Focus a course
                <select value={activeCourseId ?? ""} onChange={event => setActiveCourseId(event.target.value || null)}>
                  <option value="">Show all relationships</option>
                  {catalog.courses.map(course => <option value={course.id} key={course.id}>{course.code} · {course.title}</option>)}
                </select>
              </label>
              {activeCourseId && <button type="button" onClick={() => setActiveCourseId(null)}><X size={15} aria-hidden="true" /> Reset focus</button>}
            </div>
          </div>
          <div className="chart-legend" aria-label="Chart legend">
            <span><i className="legend-line solid" />Prerequisite</span>
            <span><i className="legend-line dashed" />Corequisite</span>
            <span><i className="legend-dot" />Official roadmap course</span>
            <span><i className="legend-taken" />Already taken</span>
          </div>
        </section>

        <div className="chart-scroll">
          <div className="prerequisite-chart" ref={chartRef}>
            <GraphDepthCanvas focusKey={highlightedCourseId} />
            <svg className="chart-connections" aria-hidden="true">
              <defs>
                <marker id="arrow-prerequisite" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                <marker id="arrow-corequisite" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
              </defs>
              {drawnEdges.map((edge) => (
                <path
                  key={edge.key}
                  d={edge.path}
                  className={`connection ${edge.kind}${highlightedCourseId ? (activeConnections.has(edge.key) ? " active" : " muted") : ""}`}
                  markerEnd={`url(#arrow-${edge.kind})`}
                />
              ))}
            </svg>

            {semesters.map((semester) => (
              <section className="semester-band" key={semester.number}>
                <header><span>Year {Math.ceil(semester.number / 2)}</span><strong>Semester {semester.number}</strong></header>
                <div className="semester-nodes">
                  {semester.courses.map((course) => {
                    return (
                      <GraphCourseNode
                        key={course.id}
                        course={course}
                        isSelected={highlightedCourseId === course.id}
                        isRelated={!highlightedCourseId || relatedIds.has(course.id)}
                        isTaken={takenCourseIds.has(course.id)}
                        setRef={(element) => { if (element) nodeRefs.current.set(course.id, element); else nodeRefs.current.delete(course.id); }}
                        onOpen={() => setSelectedCourse(course)}
                        onEnter={() => setHoveredCourseId(course.id)}
                        onLeave={() => setHoveredCourseId(null)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <section className="relationship-list" aria-live="polite">
          <article>
            <strong>{focusedCourse ? `${focusedCourse.code} relationship summary` : "Accessible relationship guide"}</strong>
            {focusedCourse ? <>
              <p>{incoming.length ? `Requires or accompanies: ${incoming.map(course => course.code).join(", ")}.` : "No roadmap-course prerequisites connect into this course."}</p>
              <p>{outgoing.length ? `Unlocks or accompanies: ${outgoing.map(course => course.code).join(", ")}.` : "No later roadmap courses connect from this course."}</p>
              <button type="button" onClick={() => setSelectedCourse(focusedCourse)}>Open {focusedCourse.code} details</button>
            </> : <p>Choose a course from the focus control or tab through the graph. The summary describes its incoming and outgoing roadmap relationships without relying on the visual arrows.</p>}
          </article>
        </section>

        <aside className="chart-note"><GitBranch size={19} /><p>Only relationships between courses shown on the 2026-2027 roadmap are drawn. Placement, minimum-grade, major-standing, GE, and external-course conditions remain in each course’s catalog detail. {catalog.abbreviation === "BSSE" && "*Choose MATH 33LA OR MATH 142, and MATH 161A OR ISE 130 (3 units per pair). Arrows show the roadmap pathway; prerequisite alternatives are explained in course details."}</p></aside>
      </main>
      {selectedCourse && <CourseDetail course={selectedCourse} onClose={() => setSelectedCourse(null)} />}
    </div>
  );
}
