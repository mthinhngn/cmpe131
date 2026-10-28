import { productNavigation } from "./product-navigation";
import { CourseRadarBrand } from "./CourseRadarBrand";
import { ProductContextBar } from "./ProductContextBar";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { useCatalog } from "./CatalogContext";
import { CourseDetail } from "./CourseDetail";
import type { Course } from "./types";
import "./semester-planner.css";

export default function SemesterPlanner() {
  const { catalog, program, selectProgram, plans, takenCourseIds, courseById, setPlan, removePlan, semesterCount, addSemester, removeLastSemester } = useCatalog();
  const [semester, setSemester] = useState(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"planned" | "all" | "suggested">("planned");
  const [selected, setSelected] = useState<Course | null>(null);
  const [message, setMessage] = useState("");
  const [undo, setUndo] = useState<null | (() => void)>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const chartScroll = useRef<HTMLDivElement>(null);
  const timelineScroll = useRef<HTMLElement>(null);
  useEffect(() => { document.title = "Semester Planner · Course Radar"; }, []);
  useEffect(() => { setSemester(1); setQuery(""); setFilter("planned"); setUndo(null); setMessage(""); setSelected(null); }, [program]);
  useEffect(() => { setSemester(current => Math.min(current, semesterCount)); }, [semesterCount]);
  useEffect(() => {
    for (const container of [chartScroll.current, timelineScroll.current]) {
      const active = container?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!container || !active) continue;
      const viewport = container.getBoundingClientRect();
      const target = active.getBoundingClientRect();
      if (target.left < viewport.left) container.scrollLeft += target.left - viewport.left;
      else if (target.right > viewport.right) container.scrollLeft += target.right - viewport.right;
    }
  }, [semester, semesterCount]);
  const semesters = Array.from({ length: semesterCount }, (_, i) => i + 1);
  const canRemoveSemester = semesterCount > catalog.requirementGroups.length && !Object.values(plans).some(plan => plan.semester === semesterCount);
  const extendPlan = () => {
    addSemester();
    setSemester(semesterCount + 1);
    setFilter("planned");
    setQuery("");
    setMessage(`Semester ${semesterCount + 1} added.`);
    setUndo(null);
  };
  const planned = useMemo(() => catalog.courses.filter(c => plans[c.id] && !takenCourseIds.has(c.id)), [catalog.courses, plans, takenCourseIds]);
  const bySemester = useMemo(() => {
    const groups = new Map<number, Course[]>();
    for (const course of planned) {
      const n = plans[course.id].semester;
      const bucket = groups.get(n);
      if (bucket) bucket.push(course); else groups.set(n, [course]);
    }
    return groups;
  }, [planned, plans]);
  const inSemester = (n: number) => bySemester.get(n) ?? [];
  const units = (courses: Course[]) => courses.reduce((sum, c) => sum + c.units, 0);
  const total = units(planned);
  const activeCourses = inSemester(semester);
  const remaining = catalog.courses.filter(c => !takenCourseIds.has(c.id) && !plans[c.id]);
  const results = (filter === "planned" ? activeCourses : remaining).filter(c => `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase()) && (filter !== "suggested" || c.recommendedSemester === semester));
  const maxUnits = Math.max(20, ...semesters.map(n => units(inSemester(n))));
  const change = (course: Course, target: number) => {
    const previous = plans[course.id];
    setPlan(course.id, target, previous?.status);
    setMessage(`${course.code} ${previous ? "moved" : "added"} to Semester ${target}.`);
    setUndo(() => () => { if (previous) setPlan(course.id, previous.semester, previous.status); else removePlan(course.id); });
  };
  const remove = (course: Course) => {
    const previous = plans[course.id]; removePlan(course.id);
    setMessage(`${course.code} removed from your plan.`);
    setUndo(() => () => setPlan(course.id, previous.semester, previous.status));
  };
  const useRoadmap = () => {
    const added = remaining.filter(c => semesters.includes(c.recommendedSemester));
    added.forEach(c => setPlan(c.id, c.recommendedSemester));
    setMessage(`${added.length} catalog courses placed in their recommended semesters.`);
    setUndo(() => () => added.forEach(c => removePlan(c.id)));
  };
  return <div className="sp-page">
    <a className="sp-skip" href="#sp-main">Skip to planner</a>
    <header className="sp-header">
      <CourseRadarBrand />
      <nav aria-label="Main navigation">{productNavigation.map(item => <Link key={item.to} reloadDocument={item.to === "/overview" || item.to === "/prerequisites"} to={item.to} aria-current={item.to === "/planner" ? "page" : undefined}>{item.label}</Link>)}</nav>
    </header>
    <ProductContextBar page="Planner" edition={catalog.catalogYear} program={program} onProgramChange={selectProgram} />
    <main id="sp-main" className="sp-main" style={{ "--sp-semester-count": semesterCount } as CSSProperties}>
      <section className="sp-intro"><div><h1>A little structure.<br/><span>A clearer path ahead.</span></h1></div><div className="sp-intro-action"><span>Semester planner</span><button className="sp-button sp-dark" onClick={useRoadmap} disabled={!remaining.length}>Use recommended roadmap <ArrowUpRight size={16}/></button></div></section>

      <section className="sp-overview" aria-label="Semester workload overview">
        <div className="sp-overview-copy"><h2>Find your<br/>own balance.</h2><p>{planned.length ? `${planned.length} courses. ${total} units. One plan you can make your own.` : "Start with the roadmap, or build your plan one course at a time."}</p><div className="sp-chart-key"><i/> Other semesters <i/> Selected semester</div></div>
        <div className="sp-chart"><div className="sp-chart-top"><span>Units per semester</span><span>Click a semester to edit</span></div><div className="sp-chart-scroll" ref={chartScroll} role="region" aria-label="Semester workload chart" tabIndex={0}><div className="sp-chart-wide"><div className="sp-chart-plot"><div className="sp-gridlines" aria-hidden="true">{[maxUnits, maxUnits / 2, 0].map(n => <div key={n}><span>{Math.round(n)}</span></div>)}</div><div className="sp-bars">{semesters.map(n => <button key={n} className={`sp-bar-column ${n === semester ? "is-active" : ""}`} aria-label={`Edit Semester ${n}, ${units(inSemester(n))} units`} aria-pressed={n === semester} onClick={() => setSemester(n)}><span className="sp-bar-value">{units(inSemester(n))}<small>u</small></span><span className="sp-bar-stack">{inSemester(n).map(c => <span key={c.id} title={`${c.code} · ${c.units} units · ${plans[c.id].status === "in-progress" ? "In progress" : "Planned"}`} style={{ height: `${c.units / maxUnits * 150}px` }}/>) }{!inSemester(n).length && <span className="sp-bar-empty"/>}</span><span className="sp-bar-label">S{n}</span></button>)}</div></div><div className="sp-chart-years">{semesters.filter(n => n % 2).map(n => <span key={n} style={{ gridColumn: `span ${Math.min(2, semesterCount - n + 1)}` }}>Year {Math.ceil(n / 2)}</span>)}</div></div></div></div>
      </section>

      <div className="sp-plan-tools"><span>{semesterCount} semesters</span><div>{semesterCount > catalog.requirementGroups.length && <button type="button" className="sp-remove-semester" aria-label={`Remove Semester ${semesterCount}`} disabled={!canRemoveSemester} title={canRemoveSemester ? "Remove the last empty semester" : `Move courses out of Semester ${semesterCount} before removing it`} onClick={() => { removeLastSemester(); setSemester(current => Math.min(current, semesterCount - 1)); }}><Trash2 size={13}/> Remove Semester {semesterCount}</button>}<button type="button" className="sp-button" onClick={extendPlan}><Plus size={15}/> Add semester</button></div></div>
      <section className="sp-timeline" ref={timelineScroll} aria-label="Choose a semester">{semesters.map(n => <button key={n} aria-pressed={n === semester} className={n === semester ? "is-active" : ""} onClick={() => setSemester(n)} onDragOver={e => { if (dragged) e.preventDefault(); }} onDrop={e => { e.preventDefault(); const course = courseById.get(e.dataTransfer.getData("text/plain")); if (course) change(course, n); setDragged(null); }}><span>Year {Math.ceil(n / 2)}</span><strong>Semester {n}</strong><small>{inSemester(n).length} courses <span>/</span> {units(inSemester(n))} units</small></button>)}</section>

      <section id="sp-workbench" className="sp-catalog" aria-label="Course library">
        <div className="sp-catalog-head"><div><h2>Course library</h2><p>{activeCourses.length} in Semester {semester} / {remaining.length} left to plan</p></div><label className="sp-search"><Search size={17}/><input aria-label="Search course library" type="search" placeholder="Search code or course name" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
        <div className="sp-catalog-tabs" role="group" aria-label="Filter course library"><button aria-pressed={filter === "planned"} onClick={() => setFilter("planned")}>In Semester {semester}</button><button aria-pressed={filter === "suggested"} onClick={() => setFilter("suggested")}>For Semester {semester}</button><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All unplanned</button><Link to="/courses">Explore sections & weekly schedule <ArrowUpRight size={14}/></Link></div>
        <div className="sp-catalog-grid">{results.map(c => <article key={c.id} draggable={filter === "planned"} onDragStart={e => { if (filter === "planned") { e.dataTransfer.setData("text/plain", c.id); setDragged(c.id); } }} onDragEnd={() => setDragged(null)}><button className="sp-catalog-course" onClick={() => setSelected(c)}><strong>{c.code}</strong><span>{c.title}</span><small>{c.units} units</small></button>{filter === "planned" ? <button className="sp-plus" aria-label={`Remove ${c.code} from plan`} onClick={() => remove(c)}><Trash2 size={15}/></button> : <button className="sp-plus" aria-label={`Add ${c.code} to Semester ${semester}`} onClick={() => change(c, semester)}><Plus size={17}/></button>}</article>)}{!results.length && <div className="sp-catalog-empty"><h3>{query ? "No matching courses" : filter === "planned" ? `No courses in Semester ${semester} yet.` : !remaining.length ? "Every catalog course is in your plan." : "All suggested courses are in your plan."}</h3><p>{query ? "Try another course code or name." : filter === "planned" ? (semester > catalog.requirementGroups.length ? "Browse unplanned courses to build this semester." : "Choose from the recommended courses to start this semester.") : !remaining.length ? "Select a semester above to review or adjust courses." : "Browse all courses for more options."}</p>{remaining.length > 0 && <button onClick={() => { setQuery(""); setFilter(filter === "planned" && semester <= catalog.requirementGroups.length ? "suggested" : "all"); }}>Browse {filter === "planned" && semester <= catalog.requirementGroups.length ? "recommended" : "all"} courses <ArrowRight size={14}/></button>}</div>}</div>
      </section>
      <footer className="sp-footer"><span>Course Radar <span>/</span> Built for the path ahead.</span><a href={catalog.programUrl} target="_blank" rel="noreferrer">Official SJSU requirements <ArrowUpRight size={13}/></a></footer>
    </main>
    {message && <div className="sp-feedback" role="status"><Check size={16}/><span>{message}</span>{undo && <button onClick={() => { undo(); setUndo(null); setMessage("Change undone."); }}><Undo2 size={14}/> Undo</button>}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}
    {selected && <CourseDetail course={selected} onClose={() => setSelected(null)}/>}
  </div>;
}
