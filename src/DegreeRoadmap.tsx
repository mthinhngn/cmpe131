import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useCatalog } from "./CatalogContext";
import { CourseDetail } from "./CourseDetail";
import type { Course } from "./types";

const focuses = ["Build your foundation", "Connect the disciplines", "Deepen your practice", "Bring it all together"];
const unitsFromTitle = (title: string) => title.match(/\(([^)]+)\)/)?.[1] ?? "";

export default function DegreeRoadmap() {
  const { catalog, courseById, takenCourseIds, plans } = useCatalog();
  const [year, setYear] = useState(1);
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  useEffect(() => {
    if (jumpTo === null) return;
    document.getElementById(`degree-year-${jumpTo}`)?.scrollIntoView({ block: "start", behavior: "instant" });
    setJumpTo(null);
  }, [jumpTo]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Course | null>(null);
  const [pointerOpened, setPointerOpened] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => { document.title = "Degree Roadmap · Course Radar"; }, []);
  const courseIds = useMemo(() => new Set(catalog.requirementGroups.flatMap(g => g.items.flatMap(i => i.courseId ? [i.courseId] : []))), [catalog.requirementGroups]);
  const completed = [...courseIds].filter(id => takenCourseIds.has(id)).length;
  const searching = Boolean(search.trim()) || filter !== "all";
  const normalizedSearch = search.trim().toLowerCase();
  const groups = useMemo(() => catalog.requirementGroups.map((group, index) => ({ ...group, index, items: group.items.filter(item => {
    const c = courseById.get(item.courseId ?? "");
    const matches = `${c?.code ?? ""} ${c?.title ?? item.label} ${item.description ?? ""}`.toLowerCase().includes(normalizedSearch);
    return matches && (filter === "all" || (filter === "completed" && c && takenCourseIds.has(c.id)) || (filter === "planned" && c && !takenCourseIds.has(c.id) && plans[c.id]));
  }) })).filter(g => g.items.length), [catalog.requirementGroups, courseById, normalizedSearch, filter, takenCourseIds, plans]);
  const selectCourse = useCallback((course: Course, detail: number) => { setPointerOpened(detail !== 0); setSelected(course); }, []);
  const related = hovered ? courseById.get(hovered)?.prerequisiteCourseIds ?? [] : [];
  return <main className="degree-page" id="top">
    <section className="degree-hero">
      <h1>Every semester.<br /><span>A clearer direction.</span></h1>
      <div className="degree-hero-copy"><p>See the big picture. Choose your next move.<br />Your {catalog.name} path, semester by semester.<br />Built from the official SJSU catalog.</p><Link className="degree-action" to="/planner">Open semester planner <ArrowUpRight size={17} /></Link></div>
    </section>
    <div className="degree-edition"><span>{catalog.name} — BS <span className="degree-separator">/</span> {catalog.catalogYear} catalog</span><a href={catalog.programUrl} target="_blank" rel="noreferrer">Official guide <ArrowUpRight size={14} /></a></div>
    <section className="degree-map" aria-label="Interactive degree roadmap">
      <div className="degree-map-top"><h2>Your four-year route</h2><span>{completed} of {courseIds.size} named courses completed <span className="degree-progress" aria-hidden="true"><i style={{ transform: `scaleX(${completed / Math.max(courseIds.size, 1)})` }} /></span></span></div>
      <nav className="degree-route" aria-label="Jump to academic year">
        {Array.from({ length: Math.ceil(catalog.requirementGroups.length / 2) }, (_, index) => {
          const n = index + 1; const terms = catalog.requirementGroups.slice(index * 2, index * 2 + 2);
          return <button type="button" key={n} aria-current={year === n && !searching ? "step" : undefined} onClick={() => { setYear(n); setSearch(""); setFilter("all"); setJumpTo(n); }}><span className="degree-route-node">{String(n).padStart(2, "0")}</span><span className="degree-route-copy"><small>Year {n}</small><strong>{focuses[index] ?? `Year ${n}`}</strong><span>{terms.map(t => parseInt(unitsFromTitle(t.title)) || 0).reduce((a,b) => a+b, 0)} units · Semesters {index * 2 + 1}–{index * 2 + 2}</span></span></button>;
        })}
      </nav>
      <div className="degree-tools"><div className="degree-filters" role="group" aria-label="Filter roadmap">{[["all", "All requirements"], ["planned", "In your plan"], ["completed", "Completed"]].map(([value,label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="degree-search"><MagnifyingGlass size={18}/><input aria-label="Search all roadmap requirements" placeholder="Find a course or requirement" value={search} onChange={e => setSearch(e.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={16}/></button>}</label></div>
      {searching && <p className="degree-results" role="status">{groups.reduce((total, group) => total + group.items.length, 0)} matching requirements across all years</p>}
      <div className="degree-all-years">
      {Array.from({ length: Math.ceil(catalog.requirementGroups.length / 2) }, (_, index) => {
        const yearGroups = groups.filter(group => Math.floor(group.index / 2) === index);
        if (!yearGroups.length) return null;
        return <section className="degree-year-section" id={`degree-year-${index + 1}`} key={`${catalog.abbreviation}-${index}`} aria-labelledby={`degree-year-heading-${index + 1}`}>
      <div className="degree-year-title"><div><h2 id={`degree-year-heading-${index + 1}`}>Year {index + 1} <span className="degree-year-heading-divider">/</span> {focuses[index]}</h2><p>Semesters {index * 2 + 1}–{index * 2 + 2} · Recommended catalog sequence</p></div><span className="degree-legend"><i/>Course <i className="choice"/>Requirement choice</span></div>
      <div className="degree-terms">
        {yearGroups.map(group => <section className="degree-term" key={group.id} aria-labelledby={`term-${group.id}`}><header><div className="degree-term-number" aria-hidden="true">{String(group.index+1).padStart(2,"0")}</div><div><h3 id={`term-${group.id}`}>{searching ? `Year ${Math.floor(group.index/2)+1} · ` : ""}{group.title.split(" - ").pop()?.replace(/\s*\(.*\)/, "")}</h3><span>{group.items.length} requirements</span></div><strong className="degree-term-units">{unitsFromTitle(group.title)}</strong></header><div className="degree-records">
          {group.items.map(item => {
            const c = courseById.get(item.courseId ?? "");
            if (!c) return <details className="degree-choice" key={item.id}><summary><span className="degree-port"/><span><small>Requirement choice</small><strong>{item.label}</strong></span><span className="degree-choice-plus">+</span></summary><p>{item.description}</p></details>;
            const done = takenCourseIds.has(c.id); const planned = !done && Boolean(plans[c.id]);
            return <DegreeCourse key={item.id} c={c} description={item.description} done={done} planned={planned} related={related.includes(c.id)} courseById={courseById} onSelect={selectCourse} onHover={setHovered} />;
          })}
        </div></section>)}
      </div>
      </section>;
      })}
      </div>
      {!groups.length && <div className="degree-empty"><h3>No matching requirements</h3><p>Try another course or open a course to update your plan and progress.</p><button type="button" onClick={() => { setSearch(""); setFilter("all"); }}>Show all requirements <ArrowRight size={16}/></button></div>}
      <footer className="degree-map-footer"><span>All {catalog.requirementGroups.length} semesters <span className="degree-separator">/</span> Open a course to review, complete, or plan it.</span><a href="#top">Back to top <ArrowUpRight size={16}/></a></footer>
    </section>
    <aside className="degree-source"><div><h2>A route to work from.<br /><span>A plan to make your own.</span></h2><p>Recommended semesters are a starting point. Requirement choices and recorded course conditions remain part of the official sequence.</p></div></aside>
    {selected && <CourseDetail variant="roadmap" animateEntry={pointerOpened} course={selected} onClose={() => setSelected(null)}/>}
  </main>;
}

const DegreeCourse = memo(function DegreeCourse({ c, description, done, planned, related, courseById, onSelect, onHover }: {
  c: Course; description?: string; done: boolean; planned: boolean; related: boolean;
  courseById: Map<string, Course>; onSelect: (course: Course, detail: number) => void; onHover: (id: string | null) => void;
}) {
  const prereqs = c.prerequisiteCourseIds.map(id => courseById.get(id)?.code).filter(Boolean);
  return <button type="button" className={`degree-course${done ? " is-complete" : ""}${related ? " is-related" : ""}`} onClick={(event) => { onSelect(c, event.detail); }} onMouseEnter={() => onHover(c.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(c.id)} onBlur={() => onHover(null)} aria-label={`${c.code}, ${c.title}, ${c.units} units. Open course details.`}><span className="degree-port" aria-hidden="true"/><span className="degree-course-body"><span className="degree-course-top"><strong>{c.code}</strong><span>{done ? "Completed" : planned ? "In your plan" : prereqs.length ? `After ${prereqs.join(" + ")}` : c.prerequisiteText || c.corequisiteCourseIds.length ? "Review course conditions" : "No recorded course prerequisite"}</span></span><span className="degree-course-title">{c.title}</span>{description && <small className="degree-course-note">{description}</small>}</span><span className="degree-units">{c.units}<small>{c.units === 1 ? "unit" : "units"}</small></span><ArrowUpRight size={16} className="degree-course-arrow"/></button>;
});
