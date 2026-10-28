import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowUp } from "@phosphor-icons/react/dist/csr/ArrowUp";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { GitBranch } from "@phosphor-icons/react/dist/csr/GitBranch";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
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
  const [active, setActive] = useState<string | null>(null);
  const connected = useMemo(() => {
    if (!active) return null;
    const ids = new Set([active]);
    const walk = (id: string, direction: "from" | "to") => {
      graph.edges.filter(edge => edge[direction] === id).forEach(edge => {
        const next = edge[direction === "from" ? "to" : "from"];
        if (!ids.has(next)) { ids.add(next); walk(next, direction); }
      });
    };
    walk(active, "from"); walk(active, "to");
    return ids;
  }, [active, graph]);
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
        {diagram.paths.map((path, index) => <path className={cn(s.pathLine)} key={index} d={path.d} opacity={connected && !(connected.has(graph.edges[index].from) && connected.has(graph.edges[index].to)) ? 0.2 : 1} strokeWidth={active ? 3 : 2} markerEnd={`url(#${markerId})`} />)}
      </svg>
      {graph.columns.map((column, index) => <div className={cn(s.pathColumn)} key={index}>
        {column.map(course => <div
          className={cn(s.pathStep, graph.target?.id === course.id && s.pathTarget)}
          data-course-id={course.id}
          tabIndex={0}
          onFocus={() => setActive(course.id)} onBlur={() => setActive(null)}
          onMouseEnter={() => setActive(course.id)} onMouseLeave={() => setActive(null)}
          data-active={active === course.id} data-muted={connected ? !connected.has(course.id) : false}
          aria-label={`${course.code}: ${course.title}. ${course.prerequisiteText ?? "No recorded course prerequisites."}`}
          ref={element => { if (element) nodeRefs.current.set(course.id, element); else nodeRefs.current.delete(course.id); }}
          key={course.id}
        ><span>{course.units} units</span><strong>{course.code}</strong><p>{course.title}</p></div>)}
      </div>)}
    </div>
    <div className={cn(s.pathNote)}><span role="status">{active ? `Tracing ${catalog.courses.find(course => course.id === active)?.code} and connected courses` : "Hover or focus a course to trace its path"}</span></div>
  </div>;
}

function SemesterPreview({ catalog }: { catalog: ProgramCatalog }) {
  const { plans, takenCourseIds } = useCatalog();
  const [term, setTerm] = useState(2);
  const personal = Object.keys(plans).length > 0;
  const courses = catalog.courses.filter(course => personal ? plans[course.id]?.semester === term : course.recommendedSemester === term);
  return <div className={s.semester}>
    <div className={s.termControls} aria-label="Preview semester">{[1, 2, 3].map(n => <button key={n} type="button" aria-pressed={term === n} onClick={() => setTerm(n)}>Semester {n}</button>)}</div>
    <div className={s.semesterHeading}><h3>{personal ? "Your session draft" : "A roadmap starting point"}</h3><span>{personal ? "Personal · provisional" : "Example · not your saved plan"}</span></div>
    <div className={s.semesterRows}>{courses.length ? courses.map(course => <div className={s.planRow} key={course.id}><span>{course.code}</span><strong>{course.title}</strong><span>{takenCourseIds.has(course.id) ? "Completed" : plans[course.id]?.status === "in-progress" ? "In progress" : personal ? "Planned" : "Roadmap course"}</span></div>) : <p>No courses in this semester draft.</p>}</div>
    <p className={s.caption}>Personal plans reset on refresh. This preview does not change your plan or confirm eligibility.</p>
  </div>;
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
  return <div data-week-size={compact ? "compact" : "full"} className={cn(s.week, compact && s.weekSmall)}><div className={cn(s.previewLabel)}>{compact ? "Your weekly schedule" : "Your week, in view"}<span>{compact ? "Listed sections" : catalog.currentTerm.name}</span></div><div className={cn(s.calendar)}><div className={cn(s.hours)}><span>8 AM</span><span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span></div>{WEEKDAYS.map((day, dayIndex) => <div className={cn(s.day)} key={day}><span>{["Mon", "Tue", "Wed", "Thu", "Fri"][dayIndex]}</span><div className={cn(s.dayTrack)}>{getDayMeetings(offerings, day).map(({ offering, pattern, offeringIndex, patternIndex, lane, laneCount }) => <div className={cn(s.meeting, [undefined, s.meeting1, s.meeting2][offeringIndex])} key={`${offering.classNumber}-${patternIndex}`} style={{ top: `${(pattern.startMinute - 480) / 600 * 100}%`, height: `${(pattern.endMinute - pattern.startMinute) / 600 * 100}%`, left: `calc(${lane * 100 / laneCount}% + 3px)`, right: `calc(${(laneCount - lane - 1) * 100 / laneCount}% + 3px)` }} title={`${offering.courseCode} · ${formatMinute(pattern.startMinute)}–${formatMinute(pattern.endMinute)}`}><strong>{compact ? offering.courseCode.replace(/\s/g, "") : offering.courseCode}</strong>{!compact && pattern.endMinute - pattern.startMinute >= 60 && <span>{formatMinute(pattern.startMinute)}</span>}</div>)}</div></div>)}</div>{!compact && <p className={cn(s.previewFoot)}>Illustrative selection · listed sections, not live enrollment</p>}</div>;
}

function ProductPreviews({ catalog }: { catalog: ProgramCatalog }) {
  const { takenCourseIds, toggleTakenCourse } = useCatalog();
  const total = catalog.courses.length;
  const completed = catalog.courses.filter(course => takenCourseIds.has(course.id)).length;
  const percentage = Math.round(completed / Math.max(1, total) * 100);
  const calculus = catalog.courses.find(course => course.title === "Calculus I") ?? catalog.courses[0];
  const chain = (() => {
    const graph = getPrerequisiteGraph(catalog);
    const target = graph.target;
    const middle = graph.columns[1].find(course => graph.columns[0].some(first => course.prerequisiteCourseIds.includes(first.id)));
    const first = graph.columns[0].find(course => middle?.prerequisiteCourseIds.includes(course.id));
    return [first, middle, target].filter((course): course is Course => Boolean(course));
  })();
  return <div data-hero className={s.heroArt} aria-label="Course Radar: course progress, listed weekly sections, and a miniature prerequisite path">
    <div data-preview="schedule" className={s.heroSchedule}>
      <WeekPreview catalog={catalog} compact />
    </div>
    <section data-preview="progress" className={s.heroProgress} aria-label="Your course progress">
      <h2>Course progress</h2>
      <div className={s.progressRing}>
        <svg viewBox="0 0 160 160" role="img" aria-label={`${percentage}% of named catalog courses marked complete`}><circle cx="80" cy="80" r="64" fill="none" stroke="#eae5e7" strokeWidth="10"/><circle data-progress-arc cx="80" cy="80" r="64" fill="none" stroke="#76263d" strokeWidth="10" pathLength="100" strokeDasharray={`${percentage} 100`} transform="rotate(-90 80 80)" strokeLinecap="round" /></svg>
        <strong>{percentage}<small>%</small></strong>
      </div>
      <p role="status">{completed} of {total} courses marked</p>
      <button type="button" className={s.progressToggle} aria-pressed={takenCourseIds.has(calculus.id)} onClick={() => toggleTakenCourse(calculus.id)}>{takenCourseIds.has(calculus.id) ? "Unmark" : "Mark"} {calculus.title}</button>
    </section>
    <a data-preview="prerequisites" className={s.heroPrerequisites} href="#your-path" aria-label="Explore this three-course prerequisite path">
      <h2>Prerequisites</h2>
      <div className={s.miniPath}>
        <svg viewBox="0 0 240 172" preserveAspectRatio="none" aria-hidden="true"><path data-mini-path d="M28 30 V76 Q28 86 42 86 H184 Q202 86 202 100 V144" fill="none" stroke="#76263d" strokeWidth="2" pathLength="1"/><path d="M196 137L202 144L208 137" fill="none" stroke="#76263d" strokeWidth="2"/></svg>
        {chain.map((course, i) => <span key={course.id} data-mini-node={i}>{course.code}</span>)}
      </div>
    </a>
  </div>;
}

export default function Landing() {
  const { program } = useCatalog();
  // The public demonstration intentionally uses the reviewed local snapshot.
  const catalog = program === "software-engineering" ? softwareEngineeringCatalog : computerEngineeringCatalog;
  const [query, setQuery] = useState("");
  const matches = catalog.courses.filter(course => `${course.code} ${course.title}`.toLowerCase().includes(query.trim().toLowerCase()));
  const results = matches.slice(0, 3);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = "Course Radar — Make room for what’s next.";
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.setAttribute("data-revealed", "true"); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    root.current?.querySelectorAll("[data-reveal]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return <div ref={root} data-course-theme data-landing className={s.page} id="top">
    <a className={s.skip} href="#landing-content">Skip to content</a>
    <header className={cn(s.header, s.wrap)}><a className={s.brand} href="#top">Course Radar<span className={s.brandDot}>.</span></a><nav aria-label="Landing navigation"><a href="#explore">Explore</a><a href="#your-path">Prerequisites</a><a href="#your-plan">Semesters</a><a href="#your-week">Weekly schedule</a><a href="#assistant-planning">AI proposal</a></nav><a className={cn(s.button, s.headerCta)} href="#explore">See the demo <ArrowUpRight size={16} aria-hidden="true" /></a></header>
    <main id="landing-content" tabIndex={-1}>
      <section className={cn(s.hero, s.wrap)}><div className={s.heroCopy}><h1>A plan you<br />can <em className={s.heroAccent}>see.</em></h1><p>Track your courses, understand prerequisites, and shape a semester that fits your week.</p><a className={s.button} href="#explore">Explore courses <ArrowRight size={18} aria-hidden="true" /></a></div><ProductPreviews catalog={catalog} /></section>
      <section id="explore" data-reveal className={cn(s.wrap, s.explore)}><div className={s.sectionTop}><h2>Find a course.<br />See the possibility.</h2><div><p>Search the catalog by name or course code. Start with what you want to understand.</p><p className={s.scope}>Program views: Computer Engineering and Software Engineering.</p></div></div><div className={s.explorer}><div className={s.explorerTools}><label className={s.search}><MagnifyingGlass size={22} aria-hidden="true" /><input aria-label="Search courses" placeholder="Try Calculus or a course code" value={query} onChange={event => setQuery(event.target.value)} /></label><span>{catalog.catalogYear} catalog · {catalog.abbreviation}</span></div><div role="status" className={s.resultCount}>{matches.length} matching courses · showing {results.length}</div><div className={s.searchResults}>{results.length ? results.map(course => <CourseRow key={course.id} course={course} />) : <p className={s.noResults}>No courses match “{query}”. Try “Calculus” or a course code.</p>}</div></div></section>
      <section id="your-path" className={s.pathBand}><div data-reveal data-section="path" className={cn(s.pathSection, s.wrap)}><div className={s.sectionTop}><h2>Understand what<br />comes before.</h2><p>Follow a course to see its connected path. Hover or focus a course to trace its prerequisites and what follows.</p></div><PathPreview catalog={catalog} /><p className={s.caption}>Recorded catalog relationships. Grade requirements and other conditions still apply; verify them in the official SJSU program guide.</p></div></section>
      <section id="your-plan" data-reveal className={cn(s.wrap, s.planLayout)}><div className={s.sectionTop}><h2>Give the next steps<br />a place.</h2><p>Review a semester at a time. Your personal plan can change as you mark completed courses and arrange what comes next.</p></div><SemesterPreview catalog={catalog} /></section>
      <section id="your-week" className={s.weekBand}><div data-reveal className={cn(s.weekSection, s.wrap)}><div className={s.sectionTop}><h2>A semester,<br />with time to think.</h2><p>See listed sections in the week. Compare meeting times before choosing the schedule you want to review.</p></div><WeekPreview catalog={catalog} /><p className={s.caption}>Illustrative selection from the {catalog.currentTerm.name} listed-section snapshot, captured {new Date(catalog.currentTerm.fetchedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}. Availability is not live enrollment.</p><div id="assistant-planning" data-reveal className={s.assistantNote}><Sparkle size={30} aria-hidden="true" /><h3>A proposal.<br />Your decision.</h3><p>The assistant compares listed sections with your plan and unavailable times. Review its proposal and warnings before applying a schedule. Suggestions do not confirm requirements or enrollment.</p></div></div></section>
      <section className={s.close}><div data-reveal className={cn(s.wrap, s.closeInner)}><h2>Start with a course.<br />Build a clearer plan.</h2><a className={s.button} href="#explore">Explore courses <ArrowRight size={18} aria-hidden="true" /></a></div></section>
    </main><footer className={cn(s.footer, s.wrap)}><a className={s.brand} href="#top">Course Radar<span className={s.brandDot}>.</span></a><p>Course completion and semester plans are session drafts and reset on refresh. This is not an official degree audit. Verify requirements and enrollment details with SJSU.</p><a href="#top">Back to top <ArrowUp size={16} aria-hidden="true" /></a></footer>
  </div>;
}
