import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { GitBranch } from "@phosphor-icons/react/dist/csr/GitBranch";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { useCatalog } from "./CatalogContext";
import { CourseDetail } from "./CourseDetail";
import { CourseStateBadge } from "./CourseState";
import type { Course } from "./types";
import "./overview.css";

type CourseView = "recommended" | "planned" | "completed" | "all";

export function Overview() {
  const { catalog, takenCourseIds, plans } = useCatalog();
  const [selected, setSelected] = useState<Course | null>(null);
  const [view, setView] = useState<CourseView>("recommended");
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState(1);
  const completed = catalog.courses.filter(course => takenCourseIds.has(course.id));
  const planned = catalog.courses.filter(course => plans[course.id] && !takenCourseIds.has(course.id));
  const total = catalog.courses.length;
  const completedShare = completed.length / Math.max(1, total) * 100;
  const plannedShare = planned.length / Math.max(1, total) * 100;
  const units = completed.reduce((sum, course) => sum + course.units, 0);
  const semesterData = catalog.requirementGroups.map((group, index) => {
    const courses = catalog.courses.filter(course => course.recommendedSemester === index + 1);
    return { id: group.id, courses, completed: courses.filter(course => takenCourseIds.has(course.id)).length };
  });
  const maxCount = Math.max(1, ...semesterData.map(item => item.courses.length));
  const courses = catalog.courses.filter(course => {
    const matchesView = view === "all" || (view === "recommended" && course.recommendedSemester === semester) || (view === "completed" && takenCourseIds.has(course.id)) || (view === "planned" && !!plans[course.id] && !takenCourseIds.has(course.id));
    return matchesView && `${course.code} ${course.title}`.toLowerCase().includes(query.toLowerCase());
  });

  useEffect(() => { document.title = "Overview — Course Radar"; }, []);

  return <div className="ov">
    <section className="ov-intro" aria-labelledby="overview-title">
      <div className="ov-intro-copy">
        <h1 id="overview-title">Your path.<br /><span>Your next move.</span></h1>
        <p>A little perspective for the semester ahead. See where you are, explore your courses, and give what’s next a place.</p>
        <div className="ov-actions"><Link className="ov-button" to="/planner">Open semester planner <ArrowRight size={17} aria-hidden="true" /></Link><Link className="ov-text-link" to="/roadmap">Explore your roadmap <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
        <span className="ov-session-note">Your personal workspace · Plans reset on refresh</span>
      </div>
      <section className="ov-progress" aria-labelledby="progress-title">
        <div className="ov-section-head"><h2 id="progress-title">Your degree, in view</h2><span>{catalog.catalogYear}</span></div>
        <p className="ov-program">{catalog.name} · Bachelor of Science</p>
        <div className="ov-progress-body">
          <div className="ov-ring"><svg viewBox="0 0 180 180" role="img" aria-label={`${completed.length} of ${total} named course options complete; ${planned.length} in plan`}><circle className="ov-ring-base" cx="90" cy="90" r="72" /><circle className="ov-ring-plan" cx="90" cy="90" r="72" pathLength="100" strokeDasharray={`${plannedShare} 100`} strokeDashoffset={-completedShare} /><circle className="ov-ring-done" cx="90" cy="90" r="72" pathLength="100" strokeDasharray={`${completedShare} 100`} /></svg><div><strong>{Math.round(completedShare)}<small>%</small></strong><span>marked complete</span></div></div>
          <div className="ov-legend"><span><i className="done" />Completed <strong>{completed.length}<small> / {total}</small></strong></span><span><i className="plan" />In your plan <strong>{planned.length}</strong></span><span><i />Unmarked <strong>{total - completed.length - planned.length}</strong></span><p>{units} completed course units</p></div>
        </div>
        <div className="ov-progress-foot"><span>Self-reported · Named course options</span><Link to="/courses">Update courses <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      </section>
    </section>

    <div className="ov-workspace">
      <section className="ov-courses" aria-labelledby="radar-title">
        <div className="ov-section-head"><h2 id="radar-title">On your radar</h2><Link className="ov-text-link" to="/courses">Course explorer <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        <p className="ov-section-description">Start with the roadmap. Make it your own.</p>
        <div className="ov-course-controls"><div className="ov-filters" role="group" aria-label="Course view">{([{ id: "recommended", label: "Roadmap" }, { id: "planned", label: "In plan", count: planned.length }, { id: "completed", label: "Completed", count: completed.length }, { id: "all", label: "All courses" }] as const).map(item => <button key={item.id} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}{"count" in item && <span>{item.count}</span>}</button>)}</div><label className="ov-search"><MagnifyingGlass size={17} aria-hidden="true" /><span className="sr-only">Search overview courses</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a course…" /></label></div>
        <div className="ov-list-context">{view === "recommended" ? <label>Recommended for <select aria-label="Roadmap semester" value={semester} onChange={event => setSemester(Number(event.target.value))}>{semesterData.map((item, index) => <option key={item.id} value={index + 1}>Semester {index + 1}</option>)}</select></label> : <span>{view === "planned" ? "Your planned and in-progress courses" : view === "completed" ? "Courses you’ve marked complete" : "All named course options"}</span>}<span role="status">{courses.length} {courses.length === 1 ? "course" : "courses"} · {courses.reduce((sum, course) => sum + course.units, 0)} units</span></div>
        <div className="ov-course-list" key={view}>
          <div className="ov-table-labels" aria-hidden="true"><span>Course</span><span>Units</span><span>Status</span><span /></div>
          {courses.map(course => <button className="ov-course-row" key={course.id} onClick={() => setSelected(course)}><span><strong>{course.code}</strong><span>{course.title}</span></span><span className="ov-course-units">{course.units}<small> units</small></span><CourseStateBadge course={course} /><ArrowUpRight size={17} aria-hidden="true" /></button>)}
          {!courses.length && <div className="ov-empty"><h3>{query ? "No matching courses" : view === "planned" ? "A little room for what’s next." : view === "completed" ? "Your progress starts here." : "No courses in this view"}</h3><p>{query ? "Try another course code or title." : view === "planned" ? "Open a course to add it to a semester in your plan." : "Open a course to review its details and update your progress."}</p><button className="ov-text-link" onClick={() => { setQuery(""); setView("all"); }}>Show all courses <ArrowRight size={16} aria-hidden="true" /></button></div>}
        </div>
        <div className="ov-list-foot"><span>Open any course for details, completion & planning.</span><Link to="/courses">Browse listed sections <ArrowRight size={15} aria-hidden="true" /></Link></div>
      </section>

      <aside className="ov-next" aria-label="Planning guidance">
        <h2>Make your next move.</h2>
        <Link className="ov-next-step" to="/courses"><CheckCircle size={21} aria-hidden="true" /><div><strong>Start with what you know</strong><p>Mark the courses you’ve completed.</p></div><ArrowUpRight size={16} aria-hidden="true" /></Link>
        <Link className="ov-next-step" to="/prerequisite-chart"><GitBranch size={21} aria-hidden="true" /><div><strong>Follow the connections</strong><p>See what comes before—and after.</p></div><ArrowUpRight size={16} aria-hidden="true" /></Link>
        <Link className="ov-next-step" to="/planner"><CalendarBlank size={21} aria-hidden="true" /><div><strong>Give your courses a place</strong><p>Build a personal semester draft.</p></div><ArrowUpRight size={16} aria-hidden="true" /></Link>
      </aside>
    </div>

    <section className="ov-perspective" aria-labelledby="perspective-title"><div><h2 id="perspective-title">Keep the bigger<br />picture in sight.</h2><p>Named course options across the recommended roadmap. Choose a semester to bring its courses into view.</p><Link className="ov-text-link" to="/roadmap">Review degree requirements <ArrowUpRight size={16} aria-hidden="true" /></Link></div><div className="ov-distribution"><div className="ov-chart-key"><span><i />Marked complete</span><span><i />Unmarked options</span></div><div className="ov-bars">{semesterData.map((item, index) => <button key={item.id} aria-label={`View semester ${index + 1}: ${item.completed} of ${item.courses.length} named courses complete`} aria-pressed={view === "recommended" && semester === index + 1} onClick={() => { setSemester(index + 1); setView("recommended"); setQuery(""); document.getElementById("radar-title")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span className="ov-bar-total">{item.courses.length}</span><span className="ov-bar-track"><span style={{ height: `${item.courses.length / maxCount * 100}%` }}><i style={{ height: `${item.courses.length ? item.completed / item.courses.length * 100 : 0}%` }} /></span></span><span className="ov-bar-label">{index + 1}</span></button>)}</div><span className="ov-axis-label">Recommended semester</span></div></section>
    <p className="ov-audit-note">A planning reference, not an official degree audit. Electives, choose-one rules, grades, transfer credit and other graduation requirements need separate review. <a href={catalog.programUrl} target="_blank" rel="noreferrer">Check the official SJSU guide <ArrowUpRight size={13} aria-hidden="true" /></a></p>
    {selected && <CourseDetail course={selected} onClose={() => setSelected(null)} />}
  </div>;
}
