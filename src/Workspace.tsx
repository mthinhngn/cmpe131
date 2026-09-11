import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowSquareOut, BookOpen, CalendarBlank, ChartPieSlice, CheckCircle, Circle, GitBranch, GraduationCap, House, MagnifyingGlass, MapTrifold, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { useCatalog } from "./CatalogContext";
import { CourseDetail } from "./App";
import type { Course } from "./types";
import { CourseStateBadge } from "./CourseState";
import { CourseRadarLogo } from "./CourseRadarLogo";
import "./workspace.css";

const navigation = [
  { to: "/", label: "Overview", icon: House },
  { to: "/courses", label: "Course explorer", icon: BookOpen },
  { to: "/roadmap", label: "Degree roadmap", icon: MapTrifold },
  { to: "/prerequisite-chart", label: "Prerequisites", icon: GitBranch },
  { to: "/planner", label: "Semester planner", icon: CalendarBlank },
  { to: "/recommendations", label: "Recommendations", icon: Sparkle },
];

export function Workspace() {
  const { catalog, program, selectProgram, mode, retry } = useCatalog();
  const location = useLocation();
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { content.current?.focus(); window.scrollTo(0, 0); }, [location.pathname]);
  return <div className="workspace">
    <a className="skip-link" href="#workspace-content">Skip to content</a>
    <header className="workspace-header">
      <Link className="workspace-brand" to="/" aria-label="CourseRadar home"><CourseRadarLogo /></Link>
      <nav aria-label="Main navigation">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"}><Icon size={19} aria-hidden="true" /><span>{label}</span>{to === "/recommendations" && <small>Preview</small>}</NavLink>)}</nav>
      <a className="program-source" href={catalog.programUrl} target="_blank" rel="noreferrer">Official guide <ArrowSquareOut size={14} aria-hidden="true" /></a>
    </header>
    <div className="workspace-body">
      <div className="workspace-context"><span className="breadcrumb">Workspace <span>/</span> <strong>{navigation.find(item => item.to === location.pathname)?.label ?? "Course Radar"}</strong></span><label>Degree<select aria-label="Degree program" value={program} onChange={event => selectProgram(event.target.value)}><option value="computer-engineering">Computer Engineering — BS</option><option value="software-engineering">Software Engineering — BS</option></select></label><span className="catalog-pill">{catalog.catalogYear}</span><span className="session-label"><Circle size={8} weight="fill" aria-hidden="true" /> Session draft</span></div>
      <div className={`data-message ${mode}`} role="status">{mode === "loading" ? "Checking for the latest catalog… Reviewed snapshot available below." : mode === "fixture" ? <>Showing the reviewed catalog snapshot. Live catalog unavailable. <button onClick={retry}>Retry connection</button></> : "Connected to catalog · Section availability is a dated snapshot, not live enrollment."}</div>
      <div id="workspace-content" className="workspace-content" ref={content} tabIndex={-1}><Outlet key={program} /></div>
      <footer className="workspace-footer"><span>Built for the path ahead.</span><span>Planning reference · Official SJSU requirements take precedence.</span></footer>
    </div>
  </div>;
}

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="workspace-heading"><span className="section-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></header>;
}

export function Overview() {
  const { catalog, takenCourseIds, plans } = useCatalog();
  const [selected, setSelected] = useState<Course | null>(null);
  const completed = catalog.courses.filter(course => takenCourseIds.has(course.id));
  const planned = catalog.courses.filter(course => plans[course.id] && !takenCourseIds.has(course.id));
  const units = completed.reduce((sum, course) => sum + course.units, 0);
  const percentage = Math.round(completed.length / Math.max(1, catalog.courses.length) * 100);
  return <>
    <div className="heading-with-action"><Heading eyebrow="YOUR ACADEMIC PICTURE" title="Make room for what’s next." description="Your courses, your connections, your next semester. All in one place." /><Link className="primary-button" to="/planner">Open planner <ArrowRight size={17} aria-hidden="true" /></Link></div>
    <div className="overview-stats"><article><span>Courses completed</span><strong>{completed.length}<small> / {catalog.courses.length}</small></strong><p>Named catalog courses you marked</p></article><article><span>Completed course units</span><strong>{units}<small> units</small></strong><p>Self-reported · not an official audit</p></article><article><span>In your plan</span><strong>{planned.length}<small> courses</small></strong><p>Personal draft for this session</p></article></div>
    <div className="overview-grid"><section className="panel progress-panel"><div className="panel-heading"><h2>Your degree, in perspective</h2><ChartPieSlice size={20} aria-hidden="true" /></div><div className="degree-title"><span className="degree-icon"><GraduationCap size={30} aria-hidden="true" /></span><div><h3>{catalog.name}</h3><p>Bachelor of Science · {catalog.catalogYear}</p></div></div><div className="progress-label"><strong>Named course completion</strong><span>{percentage}%</span></div><progress max={catalog.courses.length || 1} value={completed.length} aria-label="Named course completion" /><div className="progress-key"><span><i />{completed.length} completed</span><span>{catalog.courses.length - completed.length} remaining course options</span></div><p className="fine-print">Includes named course options, not all graduation requirements. Electives, choose-one rules, grades and transfer credit need separate review.</p><Link className="text-link" to="/roadmap">Explore degree requirements <ArrowRight size={16} aria-hidden="true" /></Link></section>
    <section className="panel next-panel"><div className="panel-heading"><h2>Your next steps</h2><span className="subtle-tag">Start here</span></div>{[{ to: "/courses", title: "Build your academic picture", text: "Mark courses you have already completed.", icon: CheckCircle }, { to: "/prerequisite-chart", title: "Connect the dots", text: "See how prerequisites shape your choices.", icon: GitBranch }, { to: "/planner", title: "Sketch your next semester", text: "Bring courses together in a personal draft.", icon: CalendarBlank }].map(({ to, title, text, icon: Icon }, index) => <Link className="next-step" to={to} key={to}><span className="step-number">0{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div><Icon size={21} aria-hidden="true" /></Link>)}</section></div>
    <div className="overview-grid lower-grid"><section className="panel"><div className="panel-heading"><h2>On your radar</h2><Link to="/courses">Browse courses <ArrowRight size={15} aria-hidden="true" /></Link></div><p className="panel-description">{planned.length ? "Your planned and in-progress courses." : "A starting point from the official first-semester roadmap."}</p>{(planned.length ? planned : catalog.courses.filter(course => course.recommendedSemester === 1)).slice(0, 4).map(course => <button className="compact-course" onClick={() => setSelected(course)} key={course.id}><span className="course-initial">{course.code.split(" ")[0].slice(0, 2)}</span><span><strong>{course.code}</strong><small>{course.title}</small></span><CourseStateBadge course={course} /><ArrowRight size={15} aria-hidden="true" /></button>)}</section><section className="future-panel"><span className="preview-label"><Sparkle size={15} aria-hidden="true" /> LOOKING AHEAD</span><h2>A more personal<br />path to graduation.</h2><p>Recommendations that connect your goals with your degree. A future part of your workspace.</p><Link to="/recommendations">Explore what’s coming <ArrowRight size={16} aria-hidden="true" /></Link><span className="orbit-decoration" aria-hidden="true" /></section></div>
    {selected && <CourseDetail course={selected} onClose={() => setSelected(null)} />}
  </>;
}

export function Courses() {
  const { catalog, takenCourseIds, plans } = useCatalog();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const filter = params.get("status") ?? "all";
  const [selected, setSelected] = useState<Course | null>(null);
  const update = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  const courses = catalog.courses.filter(course => `${course.code} ${course.title}`.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "completed" ? takenCourseIds.has(course.id) : !takenCourseIds.has(course.id) && plans[course.id]?.status === filter)));
  return <><Heading eyebrow="EXPLORE YOUR OPTIONS" title="Course explorer" description="Find a course. Understand its requirements. See where it could take you." /><div className="explorer-toolbar"><label className="workspace-search"><MagnifyingGlass size={18} aria-hidden="true" /><span className="sr-only">Search courses</span><input placeholder="Search by course code or title…" value={query} onChange={event => update("q", event.target.value)} /></label><label className="filter-label">Status<select value={filter} onChange={event => update("status", event.target.value)}><option value="all">All courses</option><option value="completed">Completed</option><option value="planned">Planned</option><option value="in-progress">In progress</option></select></label></div><p className="result-count" role="status">{courses.length} courses · {catalog.name}</p><section className="panel course-table"><div className="course-table-head"><span>COURSE</span><span>UNITS</span><span>STATUS</span><span /></div>{courses.map(course => <button key={course.id} className="course-table-row" onClick={() => setSelected(course)}><span><strong>{course.code}</strong><span>{course.title}</span></span><span>{course.units}</span><CourseStateBadge course={course} /><ArrowRight size={16} aria-hidden="true" /></button>)}{!courses.length && <div className="workspace-empty"><MagnifyingGlass size={30} aria-hidden="true" /><h2>No courses match</h2><p>Try another course name or clear your filters.</p><button onClick={() => setParams({})}>Clear filters</button></div>}</section>{selected && <CourseDetail course={selected} onClose={() => setSelected(null)} />}</>;
}

export function Planner() {
  const { catalog, courseById, plans, takenCourseIds, setPlan, removePlan } = useCatalog();
  const [selected, setSelected] = useState<Course | null>(null);
  return <><div className="heading-with-action"><Heading eyebrow="THINK A SEMESTER AHEAD" title="Semester planner" description="Give your next steps a place. Add courses, move them, and explore your options." /><Link className="primary-button" to="/courses">Find courses <ArrowRight size={17} aria-hidden="true" /></Link></div><div className="planning-note"><WarningCircle size={19} aria-hidden="true" /><p><strong>Session draft.</strong> Refresh clears your plan. Semester numbers are personal planning slots, not confirmed offerings. Prerequisites, grades and course availability must be reviewed separately.</p></div><div className="semester-grid">{catalog.requirementGroups.map((group, index) => {
    const courses = catalog.courses.filter(course => plans[course.id]?.semester === index + 1 && !takenCourseIds.has(course.id));
    return <section className="panel semester-card" key={group.id}><div className="panel-heading"><div><span className="section-eyebrow">YEAR {Math.floor(index / 2) + 1}</span><h2>Semester {index + 1}</h2></div><span className="subtle-tag">{courses.reduce((sum, course) => sum + course.units, 0)} units</span></div>{courses.map(course => {
      const missing = course.prerequisiteCourseIds.filter(id => !takenCourseIds.has(id));
      return <article className="planned-course" key={course.id}><button className="planned-course-title" onClick={() => setSelected(course)}><strong>{course.code}</strong><span>{course.title}</span></button><CourseStateBadge course={course} />{missing.length > 0 && <p className="prereq-warning"><WarningCircle size={14} aria-hidden="true" /> Review prerequisite: {missing.map(id => courseById.get(id)?.code ?? id).join(", ")}</p>}<div className="planned-actions"><label>Move to<select aria-label={`Move ${course.code} to semester`} value={index + 1} onChange={event => setPlan(course.id, Number(event.target.value), plans[course.id].status)}>{catalog.requirementGroups.map((_, number) => <option key={number} value={number + 1}>Semester {number + 1}</option>)}</select></label><button onClick={() => removePlan(course.id)} aria-label={`Remove ${course.code} from plan`}>Remove</button></div></article>;
    })}{!courses.length && <p className="semester-empty">Room for your next move.</p>}<label className="add-course-label">Add a course<select aria-label={`Add course to semester ${index + 1}`} value="" onChange={event => { if (event.target.value) setPlan(event.target.value, index + 1); }}><option value="">Choose a course…</option>{catalog.courses.filter(course => !takenCourseIds.has(course.id) && !plans[course.id]).map(course => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label></section>;
  })}</div>{selected && <CourseDetail course={selected} onClose={() => setSelected(null)} />}</>;
}

export function Recommendations() {
  return <><Heading eyebrow="THE NEXT CHAPTER" title="Guidance built around you." description="A preview of where Course Radar is headed." /><section className="recommendation-preview panel"><span className="large-spark"><Sparkle size={40} aria-hidden="true" /></span><span className="subtle-tag">Future experience · not active</span><h2>Your goals. A clearer path.</h2><p>Future recommendations could help you compare semester options, understand course sequences, and explore paths aligned with your interests.</p><div className="preview-features"><article><GitBranch size={24} aria-hidden="true" /><h3>Explain the sequence</h3><p>Understand why a course belongs in your path.</p></article><article><CalendarBlank size={24} aria-hidden="true" /><h3>Explore alternatives</h3><p>Compare possible semester plans and trade-offs.</p></article><article><GraduationCap size={24} aria-hidden="true" /><h3>Connect your interests</h3><p>Discover relevant choices within degree requirements.</p></article></div><p className="fine-print">No AI recommendations are generated today. This experience needs student preferences, validated prerequisite rules and a recommendation service.</p><Link className="primary-button" to="/planner">Build a plan yourself <ArrowRight size={16} aria-hidden="true" /></Link></section></>;
}
