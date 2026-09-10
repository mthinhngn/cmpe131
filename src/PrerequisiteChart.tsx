import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, GitBranch, GraduationCap } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { useCatalog } from "./CatalogContext";
import { CourseDetail } from "./App";
import type { Course } from "./types";

type GraphEdge = { from: string; to: string; kind: "prerequisite" | "corequisite" };
type DrawnEdge = GraphEdge & { key: string; path: string };

const nodeCategory = (code: string) => {
  if (code.startsWith("CMPE") || code.startsWith("CS")) return "node-cmpe";
  if (code.startsWith("MATH") || code.startsWith("ISE")) return "node-math";
  if (code.startsWith("PHYS") || code.startsWith("BIOL")) return "node-science";
  if (code.startsWith("ENGR") || code.startsWith("EE")) return "node-engineering";
  return "node-general";
};

export default function PrerequisiteChart() {
  const { catalog } = useCatalog();
  const chartRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [drawnEdges, setDrawnEdges] = useState<DrawnEdge[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

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

  const activeConnections = useMemo(() => new Set(
    edges.filter((edge) => edge.from === activeCourseId || edge.to === activeCourseId).map((edge) => `${edge.kind}-${edge.from}-${edge.to}`),
  ), [activeCourseId, edges]);

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
          </div>
          <div className="chart-legend" aria-label="Chart legend">
            <span><i className="legend-line solid" />Prerequisite</span>
            <span><i className="legend-line dashed" />Corequisite</span>
            <span><i className="legend-dot" />Official roadmap course</span>
          </div>
        </section>

        <div className="chart-scroll">
          <div className="prerequisite-chart" ref={chartRef}>
            <svg className="chart-connections" aria-hidden="true">
              <defs>
                <marker id="arrow-prerequisite" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                <marker id="arrow-corequisite" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
              </defs>
              {drawnEdges.map((edge) => (
                <path
                  key={edge.key}
                  d={edge.path}
                  className={`connection ${edge.kind}${activeCourseId ? (activeConnections.has(edge.key) ? " active" : " muted") : ""}`}
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
                      <button
                        key={course.id}
                        type="button"
                        ref={(element) => { if (element) nodeRefs.current.set(course.id, element); else nodeRefs.current.delete(course.id); }}
                        className={`chart-node ${nodeCategory(course.code)}${activeCourseId === course.id ? " selected" : ""}`}
                        onClick={() => setSelectedCourse(course)}
                        onMouseEnter={() => setActiveCourseId(course.id)}
                        onMouseLeave={() => setActiveCourseId(null)}
                        onFocus={() => setActiveCourseId(course.id)}
                        onBlur={() => setActiveCourseId(null)}
                      >
                        <span className="node-term">U{course.units}</span>
                        <strong>{course.code}</strong>
                        <p>{course.title}</p>
                        {catalog.requirementGroups.flatMap((group) => group.items).find((item) => item.courseId === course.id)?.description && <small>Choose one alternative*</small>}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="chart-note"><GitBranch size={19} /><p>Only relationships between courses shown on the 2026-2027 roadmap are drawn. Placement, minimum-grade, major-standing, GE, and external-course conditions remain in each course’s catalog detail. {catalog.abbreviation === "BSSE" && "*Choose MATH 33LA OR MATH 142, and MATH 161A OR ISE 130 (3 units per pair). Arrows show the roadmap pathway; prerequisite alternatives are explained in course details."}</p></aside>
      </main>
      {selectedCourse && <CourseDetail course={selectedCourse} onClose={() => setSelectedCourse(null)} />}
    </div>
  );
}
