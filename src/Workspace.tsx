import { productNavigation } from "./product-navigation";
import { CourseRadarBrand } from "./CourseRadarBrand";
import { ProductContextBar } from "./ProductContextBar";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { useCatalog } from "./CatalogContext";
import { CourseDetail } from "./CourseDetail";
import type { Course } from "./types";
import { CourseStateBadge } from "./CourseState";
import "./workspace.css";
import "./editorial.css";
import "./explorer.css";
import "./roadmap.css";
import "./roadmap-detail.css";
import "./roadmap-palette.css";
import "./explorer-schedule.css";
import "./course-inspector.css";

const navigation = productNavigation;

export function Workspace() {
  const { catalog, program, selectProgram, mode, retry } = useCatalog();
  const location = useLocation();
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { content.current?.focus(); window.scrollTo(0, 0); }, [location.pathname]);
  return <div className={`workspace ${["/overview", "/catalog-overview"].includes(location.pathname) ? "workspace-overview" : ""} ${location.pathname === "/courses" ? "workspace-explorer" : ""} ${location.pathname === "/roadmap" ? "workspace-roadmap" : ""}`}>
    <a className="skip-link" href="#workspace-content">Skip to content</a>
    <header className="workspace-header">
      <CourseRadarBrand />
      <nav aria-label="Main navigation">{navigation.map(({ to, label }) => <NavLink reloadDocument={to === "/overview" || to === "/prerequisites"} key={to} to={to} end={to === "/"}><span>{label}</span></NavLink>)}</nav>
      {!["/roadmap", "/courses"].includes(location.pathname) && <a className="program-source" href={catalog.programUrl} target="_blank" rel="noreferrer">Official guide <ArrowSquareOut size={14} aria-hidden="true" /></a>}
    </header>
    <div className="workspace-body">
      <ProductContextBar page={navigation.find(item => item.to === location.pathname)?.label ?? "Course Radar"} edition={catalog.catalogYear} program={program} onProgramChange={selectProgram} />
      {!["/roadmap", "/courses"].includes(location.pathname) && <div className={`data-message ${mode}`} role="status">{mode === "loading" ? "Checking for the latest catalog… Reviewed snapshot available below." : mode === "fixture" ? <>Showing the reviewed catalog snapshot. Live catalog unavailable. <button onClick={retry}>Retry connection</button></> : "Connected to catalog · Section availability is a dated snapshot, not live enrollment."}</div>}
      <div id="workspace-content" className="workspace-content" ref={content} tabIndex={-1}><Outlet key={program} /></div>
      <footer className="workspace-footer"><span>Built for the path ahead.</span><span>Planning reference · Official SJSU requirements take precedence.</span></footer>
    </div>
  </div>;
}

function Heading({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return <header className="workspace-heading">{eyebrow && <span className="section-eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></header>;
}

export { Overview } from "./Overview";

export { Courses } from "./CourseExplorer";

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
