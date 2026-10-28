import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ArrowRight, ArrowUp, ArrowUpRight, GitBranch, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";
import { useCatalog } from "./CatalogContext";
import { computerEngineeringCatalog } from "./data";
import { softwareEngineeringCatalog } from "./softwareEngineeringData";
import { detectTimeConflicts, formatMinute, parseMeeting, WEEKDAYS } from "./schedule";
import type { Course, CourseOffering, ProgramCatalog } from "./types";
import { cn } from "@/lib/utils";
import { landingStyles as s } from "./landing.styles";
import "./theme.css";

function CourseRow({ course }: { course: Course }) {
  return <div className={cn(s.course)}><span><strong>{course.code}</strong><span>{course.title}</span></span><small>{course.units} units</small></div>;
}

type PrerequisiteEdge = { from: string; to: string };

function getPrerequisiteGraph(catalog: ProgramCatalog) {
  const preferredCode = catalog.name.toLowerCase().includes("software") ? "CS 146" : "CMPE 126";
  const target = catalog.courses.find(course => course.code === preferredCode && course.prerequisiteCourseIds.length)
    ?? [...catalog.courses].sort((a, b) => b.prerequisiteCourseIds.length - a.prerequisiteCourseIds.length).find(course => course.prerequisiteCourseIds.length > 0);
  if (!target) return { target: undefined, columns: [[], [], []] as Course[][], edges: [] as PrerequisiteEdge[] };

  const coursesById = new Map(catalog.courses.map(course => [course.id, course]));
  const depthById = new Map<string, number>([[target.id, 0]]);
  const gather = (course: Course, depth: number) => {
    if (depth >= 2) return;
    for (const prerequisiteId of course.prerequisiteCourseIds) {
      const prerequisite = coursesById.get(prerequisiteId);
      if (!prerequisite || (depthById.get(prerequisiteId) ?? -1) >= depth + 1) continue;
      depthById.set(prerequisiteId, depth + 1);
      gather(prerequisite, depth + 1);
    }
  };
  gather(target, 0);

  const nodes = [...depthById.entries()].flatMap(([id, depth]) => {
    const course = coursesById.get(id);
    return course ? [{ course, column: 2 - depth }] : [];
  });
  const includedIds = new Set(depthById.keys());
  const edges = nodes.flatMap(({ course }) => course.prerequisiteCourseIds
    .filter(prerequisiteId => includedIds.has(prerequisiteId))
    .map(prerequisiteId => ({ from: prerequisiteId, to: course.id })));
  const columns: Course[][] = [[], [], []];
  for (const node of nodes) columns[node.column].push(node.course);
  return { target, columns, edges };
}

function PathPreview({ catalog, compact = false }: { catalog: ProgramCatalog; compact?: boolean }) {
  const graph = useMemo(() => getPrerequisiteGraph(catalog), [catalog]);
  const graphRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const markerId = `path-arrow-${useId().replaceAll(":", "")}`;
  const [diagram, setDiagram] = useState<{ width: number; height: number; paths: Array<{ d: string; x: number; y: number }> }>({ width: 1, height: 1, paths: [] });

  useLayoutEffect(() => {
    const root = graphRef.current;
    if (!root) return;
    const updatePaths = () => {
      const bounds = root.getBoundingClientRect();
      const paths = graph.edges.flatMap(edge => {
        const from = nodeRefs.current.get(edge.from)?.getBoundingClientRect();
        const to = nodeRefs.current.get(edge.to)?.getBoundingClientRect();
        if (!from || !to) return [];
        const x = from.right - bounds.left;
        const y = from.top + from.height / 2 - bounds.top;
        const endX = to.left - bounds.left;
        const endY = to.top + to.height / 2 - bounds.top;
        const curve = (endX - x) * 0.48;
        return [{ d: `M ${x} ${y} C ${x + curve} ${y}, ${endX - curve} ${endY}, ${endX} ${endY}`, x: endX, y: endY }];
      });
      setDiagram({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height), paths });
    };
    updatePaths();
    const observer = new ResizeObserver(updatePaths);
    observer.observe(root);
    nodeRefs.current.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [graph]);

  return <div data-path-size={compact ? "compact" : "full"} className={cn(s.path, compact && s.pathSmall)}>
    <div className={cn(s.previewLabel)}><GitBranch size={16} aria-hidden="true" /> Prerequisite path{!compact && <span>{graph.target?.code ?? "Catalog view"}</span>}</div>
    <div ref={graphRef} className={cn(s.pathNodes)} role="group" aria-label={graph.target ? `Prerequisite connections leading to ${graph.target.code}` : "Prerequisite course connections"}>
      <svg className={cn(s.pathEdges)} viewBox={`0 0 ${diagram.width} ${diagram.height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path className={cn(s.pathArrow)} d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
        {diagram.paths.map((path, index) => <path className={cn(s.pathLine)} key={index} d={path.d} markerEnd={`url(#${markerId})`} />)}
      </svg>
      {graph.columns.map((column, index) => <div className={cn(s.pathColumn)} key={index}>
        {column.map(course => <div
          className={cn(s.pathStep, graph.target?.id === course.id && s.pathTarget)}
          data-course-id={course.id}
          ref={element => { if (element) nodeRefs.current.set(course.id, element); else nodeRefs.current.delete(course.id); }}
          key={course.id}
        ><span>{course.units} units</span><strong>{course.code}</strong><p>{course.title}</p></div>)}
      </div>)}
    </div>
    <div className={cn(s.pathNote)}><i /> Recorded course dependencies <span>Grade requirements also apply</span></div>
  </div>;
}

function SemesterPreview({ catalog, compact = false }: { catalog: ProgramCatalog; compact?: boolean }) {
  const courses = catalog.courses.filter(course => course.recommendedSemester === 2);
  return <div data-semester-size={compact ? "compact" : "full"} className={cn(s.semester, compact && s.semesterSmall)}><div className={cn(s.previewLabel)}>{compact ? "Semester plan" : "Semester 2"}{!compact && <span>Roadmap example</span>}</div><div className={cn(s.semesterTotal)}><strong>{courses.reduce((sum, course) => sum + course.units, 0)}<small> named course units</small></strong><span>Year 1 / Spring</span></div>{courses.slice(0, compact ? 3 : 4).map(course => <CourseRow key={course.id} course={course} />)}<p className={cn(s.previewFoot)}>{compact && courses.length > 3 ? `Also ${courses.slice(3).map(course => `${course.code} · ${course.units} units`).join(", ")}` : "A starting point, ready for your own plan."}</p></div>;
}

type PreviewMeeting = {
  offering: CourseOffering;
  pattern: ReturnType<typeof parseMeeting>["patterns"][number];
  offeringIndex: number;
  patternIndex: number;
  lane: number;
  laneCount: number;
};

function getDayMeetings(offerings: CourseOffering[], day: (typeof WEEKDAYS)[number]): PreviewMeeting[] {
  const meetings = offerings.flatMap((offering, offeringIndex) =>
    parseMeeting(offering).patterns
      .filter(pattern => pattern.days.includes(day))
      .map((pattern, patternIndex) => ({ offering, pattern, offeringIndex, patternIndex })),
  ).sort((a, b) => a.pattern.startMinute - b.pattern.startMinute || a.pattern.endMinute - b.pattern.endMinute);
  const groups: Array<{ endMinute: number; meetings: typeof meetings }> = [];
  for (const meeting of meetings) {
    const group = groups.at(-1);
    if (!group || meeting.pattern.startMinute >= group.endMinute) {
      groups.push({ endMinute: meeting.pattern.endMinute, meetings: [meeting] });
      continue;
    }
    group.endMinute = Math.max(group.endMinute, meeting.pattern.endMinute);
    group.meetings.push(meeting);
  }

  return groups.flatMap(group => {
    const laneEnds: number[] = [];
    const placed = group.meetings.map(meeting => {
      const availableLane = laneEnds.findIndex(endMinute => endMinute <= meeting.pattern.startMinute);
      const lane = availableLane === -1 ? laneEnds.length : availableLane;
      laneEnds[lane] = meeting.pattern.endMinute;
      return { ...meeting, lane };
    });
    const laneCount = Math.max(laneEnds.length, 1);
    return placed.map(meeting => ({ ...meeting, laneCount }));
  });
}

function WeekPreview({ catalog, compact = false }: { catalog: ProgramCatalog; compact?: boolean }) {
  const offerings: CourseOffering[] = [];
  for (const course of catalog.courses.filter(course => course.recommendedSemester === 2)) {
    const offering = catalog.offerings.find(item => item.courseCode === course.code && parseMeeting(item).patterns.length > 0 && parseMeeting(item).patterns.every(pattern => pattern.startMinute >= 480 && pattern.endMinute <= 1080) && !detectTimeConflicts([...offerings, item]).length);
    if (offering) offerings.push(offering);
    if (offerings.length === 3) break;
  }
  return <div data-week-size={compact ? "compact" : "full"} className={cn(s.week, compact && s.weekSmall)}><div className={cn(s.previewLabel)}>{compact ? "Weekly schedule" : "Your week, in view"}{!compact && <span>{catalog.currentTerm.name}</span>}</div><div className={cn(s.calendar)}><div className={cn(s.hours)}><span>8 AM</span><span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span></div>{WEEKDAYS.map((day, dayIndex) => <div className={cn(s.day)} key={day}><span>{["Mon", "Tue", "Wed", "Thu", "Fri"][dayIndex]}</span><div className={cn(s.dayTrack)}>{getDayMeetings(offerings, day).map(({ offering, pattern, offeringIndex, patternIndex, lane, laneCount }) => <div className={cn(s.meeting, [undefined, s.meeting1, s.meeting2][offeringIndex])} key={`${offering.classNumber}-${patternIndex}`} style={{ top: `${(pattern.startMinute - 480) / 600 * 100}%`, height: `${(pattern.endMinute - pattern.startMinute) / 600 * 100}%`, left: `calc(${lane * 100 / laneCount}% + 3px)`, right: `calc(${(laneCount - lane - 1) * 100 / laneCount}% + 3px)` }} title={`${offering.courseCode} · ${formatMinute(pattern.startMinute)}–${formatMinute(pattern.endMinute)}`}><strong>{offering.courseCode}</strong>{!compact && pattern.endMinute - pattern.startMinute >= 60 && <span>{formatMinute(pattern.startMinute)}</span>}</div>)}</div></div>)}</div><p className={cn(s.previewFoot)}>Illustrative selection · listed sections, not live enrollment</p></div>;
}

export default function Landing() {
  const { program } = useCatalog();
  const catalog = program === "software-engineering" ? softwareEngineeringCatalog : computerEngineeringCatalog;
  const [query, setQuery] = useState("");
  const results = catalog.courses.filter(course => `${course.code} ${course.title}`.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
  useEffect(() => {
    document.title = "Course Radar — See the path. Plan what’s next.";
  }, []);
  return <div data-course-theme className={cn(s.page)} id="top">
    <a className={cn(s.skip)} href="#landing-content">Skip to content</a>
    <header className={cn(s.header, s.wrap)}><a className={cn(s.brand)} href="#top" aria-label="Course Radar home"><svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true"><rect x="3" y="3" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="17" y="19" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" /><path d="M8 11v12h9m-4-4 4 4-4 4" stroke="#e44a2e" strokeWidth="1.5" /></svg>Course Radar<span className={cn(s.brandDot)}>.</span></a><nav aria-label="Landing navigation"><a href="#explore">Explore</a><a href="#your-path">Prerequisites</a><a href="#your-plan">Semester plan</a><a href="#your-week">Weekly schedule</a><a href="#assistant-planning">AI proposals</a></nav><a className={cn(s.button, s.headerCta)} href="#explore">See the demo <ArrowUpRight size={16} aria-hidden="true" /></a></header>
    <main id="landing-content">
      <section className={cn(s.hero, s.wrap)}><div className={cn(s.heroCopy)}><h1>See the path.<br />Plan what’s <em className={cn(s.heroAccent)}>next.</em></h1><p>Explore SJSU engineering courses, follow the prerequisites behind them, and see how a semester plan could fit into your week.</p><div className={cn(s.actions)}><a className={cn(s.button)} href="#explore">Explore courses <ArrowRight size={17} aria-hidden="true" /></a></div></div><div data-hero className={cn(s.heroArt)} role="group" aria-label="Course Radar product visualization with prerequisite connections, a semester plan, and a weekly schedule"><div className={cn(s.heroPath)}><PathPreview catalog={catalog} compact /></div><div className={cn(s.heroSemester)}><SemesterPreview catalog={catalog} compact /></div><div className={cn(s.heroWeek)}><WeekPreview catalog={catalog} compact /></div></div></section>
      <section id="supported-programs" className={cn(s.scope, s.wrap)} aria-label="Supported academic scope"><p className={cn(s.scopeLead)}>For San José State University students in</p><p className={cn(s.scopePrograms)}>Computer Engineering and Software Engineering.</p></section>
      <section id="explore" className={cn(s.band)}><div className={cn(s.wrap, s.explore)}><div data-section-copy className={cn(s.sectionCopy)}><h2>Less searching.<br /><em>More understanding.</em></h2><p>Look beyond course codes. See what you’ll learn, check units, and find the recorded requirements behind each next step.</p></div><div className={cn(s.explorer)}><div className={cn(s.previewLabel)}>Course explorer <span>{catalog.abbreviation} / {catalog.catalogYear}</span></div><label className={cn(s.search)}><MagnifyingGlass size={18} aria-hidden="true" /><input aria-label="Try searching the course preview" placeholder="Try a course code or a subject…" value={query} onChange={event => setQuery(event.target.value)} /></label><div className={cn(s.searchResults)} aria-live="polite">{results.length ? results.map(course => <CourseRow key={course.id} course={course} />) : <p className={cn(s.noResults)}>No matches. Try “CMPE” or “Calculus”.</p>}</div><div className={cn(s.explorerFoot)}><span>Course details · recorded prerequisites · official sources</span><ArrowRight size={18} aria-hidden="true" /></div></div></div></section>
      <section id="your-path" className={s.pathBand}><div data-section="path" className={cn(s.pathSection, s.wrap)}><div className={cn(s.sectionTop)}><h2>Every next step<br /><em>has a before.</em></h2><div><p>A prerequisite connects one course to what comes next. Explore the recorded dependencies for your selected SJSU program.</p></div></div><PathPreview catalog={catalog} /><p className={cn(s.caption)}>From the {catalog.name} catalog. Requirements and grades still apply; verify details in the official program guide.</p></div></section>
      <section id="your-plan" className={s.planBand}><div className={cn(s.wrap, s.planLayout)}><div data-section="plan-art" className={cn(s.planArt)}><SemesterPreview catalog={catalog} /></div><div data-section-copy className={cn(s.sectionCopy)}><h2>A longer view.<br /><em>A plan that’s yours.</em></h2><p>Start from the degree roadmap, mark completed courses, and place upcoming courses in a semester. Your plan is a personal draft you can keep adjusting.</p></div></div></section>
      <section id="your-week" className={s.weekBand}><div data-section="week" className={cn(s.weekSection, s.wrap)}><div data-section-copy className={cn(s.sectionCopy)}><h2>See the semester<br />in your week.</h2><p>Compare listed sections in a weekly view, spot time conflicts, and make room between classes.</p><div id="assistant-planning" className={cn(s.assistantNote)}><Sparkle size={21} aria-hidden="true" /><div><h3>Let AI sketch a schedule.</h3><p>The assistant compares listed sections with your plan and availability. Review each proposal before deciding what to use.</p></div></div></div><WeekPreview catalog={catalog} /></div></section>
      <section className={cn(s.close)}><div className={cn(s.wrap)}><h2>Your next semester<br /><em>starts with a clearer view.</em></h2><p>Explore the courses. Understand what comes next. Make a plan you can review.</p><a className={cn(s.button)} href="#explore">Explore the demo <ArrowRight size={18} aria-hidden="true" /></a></div></section>
    </main><footer data-section="footer" className={cn(s.footer, s.wrap)}><div><a className={cn(s.brand)} href="#top">Course Radar<span className={cn(s.brandDot)}>.</span></a><p>Planning tools for SJSU Computer Engineering and Software Engineering students.</p></div><div><p>Course completion and semester plans are session drafts, not an official degree audit. Listed sections are a dated snapshot, not live enrollment. Verify requirements and enrollment details with SJSU.</p><span>Official SJSU program guide · catalog reference</span></div><a href="#top">Back to top <ArrowUp size={14} aria-hidden="true" /></a></footer>
  </div>;
}
