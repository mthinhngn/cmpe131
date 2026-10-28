import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Minus } from "@phosphor-icons/react/dist/csr/Minus";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { Graph } from "@phosphor-icons/react/dist/csr/Graph";
import { ListBullets } from "@phosphor-icons/react/dist/csr/ListBullets";
import { useCatalog } from "./CatalogContext";
import type { Course } from "./types";
import "./chronicle.css";

const ceCodes = ["CMPE 30", "MATH 42", "CMPE 50", "CMPE 70", "CMPE 126", "CMPE 131", "CMPE 125", "CMPE 142"];
const seCodes = ["CS 46A", "MATH 42", "CS 46B", "CMPE 70", "CS 146", "CMPE 131", "CMPE 120", "CS 149"];
const positions = [[38, 106], [38, 310], [276, 106], [514, 40], [514, 244], [752, 350], [752, 40], [752, 194]];

function RadarMark() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5"/><path d="M16 4v12l8.5 8.5M4 16h12" stroke="currentColor" strokeWidth="1.5"/><circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="1.5"/><circle cx="24" cy="7" r="3" fill="currentColor"/></svg>;
}

export default function ChronicleLanding() {
  const { program, selectProgram, catalog: localCatalog, plans, setPlan, removePlan } = useCatalog();
  const codes = program === "software-engineering" ? seCodes : ceCodes;
  const graphCourses = codes.map(code => localCatalog.courses.find(course => course.code === code)!);
  const [selectedCode, setSelectedCode] = useState("CMPE 126");
  const [replay, setReplay] = useState(0);
  const [motion, setMotion] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"semester" | "week">("semester");
  const [zoom, setZoom] = useState(1);
  const selected = graphCourses.find(course => course.code === selectedCode) ?? graphCourses[4];
  const ancestors = new Set<string>();
  const collect = (course: Course) => course.prerequisiteCourseIds.forEach(id => {
    if (ancestors.has(id)) return;
    ancestors.add(id);
    const parent = localCatalog.courses.find(item => item.id === id);
    if (parent) collect(parent);
  });
  collect(selected);
  const relevant = (course: Course) => course.id === selected.id || ancestors.has(course.id);
  const results = useMemo(() => localCatalog.courses.filter(course => `${course.code} ${course.title}`.toLowerCase().includes(query.toLowerCase())).slice(0, query ? 6 : 4), [localCatalog, query]);
  const plannedCourses = localCatalog.courses.filter(course => plans[course.id]);
  const togglePlan = (course: Course) => plans[course.id] ? removePlan(course.id) : setPlan(course.id, course.recommendedSemester);
  const changeProgram = (value: string) => { selectProgram(value); setSelectedCode(value === "software-engineering" ? "CS 146" : "CMPE 126"); };

  return <div className="chronicle" data-motion={motion ? "on" : "off"}>
    <a href="#cx-main" className="cx-skip">Skip to content</a>
    <header className="cx-header cx-rail">
      <Link to="/" className="cx-wordmark"><RadarMark/>Course Radar</Link>
      <nav aria-label="Main navigation"><a href="#connections">The connections</a><a href="#your-plan">Your plan</a><a href="#catalog">The courses</a></nav>
      <Link className="cx-header-action" to="/overview">Open workspace <ArrowUpRight size={17}/></Link>
    </header>
    <main id="cx-main">
      <section className="cx-intro cx-rail">
        <h1>See the connections.<br/><span>Own your next move.</span></h1>
        <div className="cx-intro-bottom"><p>Your degree is more than a list of courses.<br/>Explore what connects them. Build a semester that makes sense.</p><div className="cx-intro-action"><Link to="/overview" className="cx-action">Start exploring <ArrowUpRight size={20}/></Link><span>Built for SJSU engineering students</span></div></div>
      </section>

      <section className="cx-map-section cx-rail" id="connections" aria-label="Interactive prerequisite preview">
        <div className="cx-map-toolbar"><span><Graph size={20}/>The prerequisite map</span><label><span className="sr-only">Choose your program</span><select value={program} onChange={event => changeProgram(event.target.value)}><option value="computer-engineering">Computer Engineering · BS</option><option value="software-engineering">Software Engineering · BS</option></select></label><span className="cx-catalog-year">2026–27 catalog</span></div>
        <div className="cx-map-body"><div className="cx-map-scroll"><div className="cx-map-canvas" key={`${program}-${replay}`} style={{ transform: `scale(${zoom})`, transformOrigin: "left top" }}>
          <div className="cx-map-guide"><span>THE FOUNDATIONS</span><span>THE POSSIBILITIES</span></div>
          <svg className="cx-edges" viewBox="0 0 1000 480" aria-hidden="true"><defs><marker id="cx-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 6 3 0 6" fill="none" stroke="currentColor"/></marker></defs>{graphCourses.flatMap((course, index) => course.prerequisiteCourseIds.map(parentId => {
            const parentIndex = graphCourses.findIndex(item => item.id === parentId);
            if (parentIndex < 0) return null;
            const [x1, y1] = positions[parentIndex]; const [x2, y2] = positions[index];
            return <path key={`${parentId}-${course.id}`} className={relevant(course) && relevant(graphCourses[parentIndex]) ? "cx-edge cx-edge-active" : "cx-edge"} d={`M${x1 + 190} ${y1 + 44} C${x1 + 232} ${y1 + 44},${x2 - 42} ${y2 + 44},${x2} ${y2 + 44}`} markerEnd="url(#cx-arrow)"/>;
          }))}</svg>
          {graphCourses.map((course, index) => <button key={course.id} type="button" onClick={() => setSelectedCode(course.code)} aria-pressed={selected.id === course.id} className={`cx-course-node ${selected.id === course.id ? "is-selected" : ""} ${relevant(course) ? "is-connected" : ""}`} style={{ left: positions[index][0], top: positions[index][1], animationDelay: `${index * 65}ms` } as CSSProperties}><span className="cx-node-top"><strong>{course.code}</strong><span>{course.units} units</span></span><span className="cx-node-title">{course.title}</span><span className="cx-node-port"/></button>)}
          <span className="cx-map-caption">A few connections can change your whole perspective.</span>
        </div></div>
        <aside className="cx-map-detail" aria-live="polite"><div className="cx-detail-label">IN FOCUS <span>↗</span></div><div key={selected.id} className="cx-detail-content"><span className="cx-detail-code">{selected.code}</span><h2>{selected.title}</h2><div className="cx-detail-meta"><span>{selected.units} units</span><span>Semester {selected.recommendedSemester}</span></div><h3>What comes before</h3><p>{selected.prerequisiteText || "No course prerequisites recorded. Check the catalog for placement and other conditions."}</p><a href={selected.sourceUrl} target="_blank" rel="noreferrer">Read the official requirements <ArrowUpRight size={15}/></a></div><button type="button" className="cx-map-add" onClick={() => togglePlan(selected)}>{plans[selected.id] ? <Check size={18}/> : <Plus size={18}/>} {plans[selected.id] ? "Added to your plan" : "Add to your plan"}</button></aside></div>
        <div className="cx-map-footer"><span><i/>Selected prerequisite path <span className="cx-map-hint">· Click a course to follow its connections</span></span><div><button type="button" aria-label="Zoom out" disabled={zoom <= .8} onClick={() => setZoom(value => Math.max(.8, value - .1))}><Minus size={16}/></button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Zoom in" disabled={zoom >= 1.2} onClick={() => setZoom(value => Math.min(1.2, value + .1))}><Plus size={16}/></button><button type="button" className="cx-replay" onClick={() => setReplay(value => value + 1)}><ArrowsClockwise size={16}/>Replay</button></div></div>
      </section>
      <div className="cx-map-note cx-rail"><span>A selected slice of the roadmap. Recorded course links, not a complete degree audit.</span><Link to="/prerequisite-chart">Explore the full map <ArrowRight size={17}/></Link></div>

      <section className="cx-planning cx-rail" id="your-plan"><div className="cx-planning-copy"><h2>A bigger picture.<br/>A better next semester.</h2><p>Follow a prerequisite to a possibility. Give it a place in your plan. Then see how your week comes together.</p><Link to="/planner" className="cx-text-link">Make the plan yours <ArrowUpRight size={20}/></Link><div className="cx-process"><span>Explore</span><ArrowRight/><span>Plan</span><ArrowRight/><span>Make it fit</span></div></div>
        <div className="cx-plan-preview"><div className="cx-preview-top"><span>Your next semester</span><div aria-label="Preview view"><button aria-pressed={view === "semester"} onClick={() => setView("semester")} aria-label="Semester view"><ListBullets size={19}/></button><button aria-pressed={view === "week"} onClick={() => setView("week")} aria-label="Weekly schedule view"><CalendarBlank size={19}/></button></div></div>
          {view === "semester" ? <div className="cx-semester-content"><div className="cx-semester-heading"><h3>Your possibilities,<br/>taking shape.</h3><span>{plannedCourses.reduce((total, course) => total + course.units, 0)}<small>planned units</small></span></div><div className="cx-semester-list" aria-live="polite">{plannedCourses.length ? plannedCourses.map(course => <div key={course.id}><span><strong>{course.code}</strong>{course.title}<small>Semester {plans[course.id].semester} · {course.units} units</small></span><button aria-label={`Remove ${course.code} from plan`} onClick={() => removePlan(course.id)}><Minus size={17}/></button></div>) : <div className="cx-plan-empty"><Plus size={25}/><p>Start with a connection.<br/>Add a course from the map above.</p><a href="#connections">Find your first course <ArrowUpRight size={16}/></a></div>}</div><Link to="/planner" className="cx-preview-link">Open semester planner <ArrowUpRight size={17}/></Link></div> : <div className="cx-week-content"><div className="cx-week-days"><span/><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span></div><div className="cx-week-grid">{[9, 10, 11, 12, 1].map(hour => <div className="cx-time-row" key={hour}><span>{hour}:00</span></div>)}{[{ code: "CMPE 131", day: 1, row: 1 }, { code: "CMPE 131", day: 3, row: 1 }, { code: "MATH 42", day: 2, row: 2 }, { code: "MATH 42", day: 4, row: 2 }, { code: "CMPE 70", day: 1, row: 4 }, { code: "CMPE 70", day: 3, row: 4 }].map((event, index) => <div key={index} className={`cx-week-event event-${index % 3}`} style={{ left: `calc(42px + (100% - 42px) * ${(event.day - 1) / 5})`, top: (event.row - 1) * 50 + 5 }}><strong>{event.code}</strong><span>Lecture</span></div>)}</div><p>Illustrative week · not live section times</p><Link to="/courses" className="cx-preview-link">Build with listed sections <ArrowUpRight size={17}/></Link></div>}
        </div></section>

      <section className="cx-catalog-section" id="catalog"><div className="cx-rail"><div className="cx-catalog-heading"><h2>What will you<br/>connect next?</h2><div><p>Start with a subject. Stay for the possibilities.</p><label className="cx-search"><MagnifyingGlass size={21}/><input aria-label="Search the course catalog" placeholder="Search courses, codes, or curiosities" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><Plus size={18} style={{ transform: "rotate(45deg)" }}/></button>}</label></div></div><div className="cx-catalog-table"><div className="cx-table-label"><span>COURSE</span><span>THE SUBJECT</span><span>UNITS</span><span>YOUR PLAN</span></div>{results.length ? results.map(course => <div key={course.id} className="cx-catalog-row"><Link to="/courses">{course.code}</Link><Link to="/courses">{course.title}<ArrowUpRight size={18}/></Link><span>{course.units}</span><button onClick={() => togglePlan(course)} aria-pressed={!!plans[course.id]} aria-label={`${plans[course.id] ? "Remove" : "Add"} ${course.code} ${plans[course.id] ? "from" : "to"} plan`}>{plans[course.id] ? <Check size={18}/> : <Plus size={18}/>}<span>{plans[course.id] ? "Added" : "Add"}</span></button></div>) : <p className="cx-no-results">No courses match “{query}”. Try a course code like CMPE or a subject like calculus.</p>}</div><div className="cx-catalog-bottom"><span>{localCatalog.name} · 2026–2027 catalog</span><Link to="/courses">Browse the whole catalog <ArrowRight size={18}/></Link></div></div></section>
      <section className="cx-close cx-rail"><h2>Make your next<br/>move a clear one.</h2><Link to="/overview" className="cx-action">Find your way forward <ArrowUpRight size={22}/></Link><span>Computer Engineering & Software Engineering · SJSU</span></section>
    </main>
    <footer className="cx-footer cx-rail"><div><Link to="/" className="cx-wordmark"><RadarMark/>Course Radar</Link><p>A little perspective for the path ahead.</p></div><p>Independent planning aid. Plans are session drafts and reset on refresh. Verify requirements with SJSU. Section availability is a dated snapshot, not live enrollment.</p><button onClick={() => setMotion(value => !value)} aria-pressed={!motion}>Motion {motion ? "on" : "off"}<span className="cx-motion-dot"/></button></footer>
  </div>;
}
