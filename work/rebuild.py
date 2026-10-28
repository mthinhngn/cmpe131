from pathlib import Path
p=Path('src/Landing.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace('ArrowUpRight, GitBranch, MagnifyingGlass, Sparkle','ArrowUpRight, GitBranch, MagnifyingGlass, Sparkle')
s=s.replace('const [diagram, setDiagram]', '''const [active, setActive] = useState<string | null>(null);
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
  const [diagram, setDiagram]''')
s=s.replace('d={path.d} markerEnd=', 'd={path.d} opacity={connected && !(connected.has(graph.edges[index].from) && connected.has(graph.edges[index].to)) ? 0.15 : 1} strokeWidth={active ? 3 : 2} markerEnd=')
s=s.replace('data-course-id={course.id}', '''data-course-id={course.id}
          tabIndex={0}
          onFocus={() => setActive(course.id)} onBlur={() => setActive(null)}
          onMouseEnter={() => setActive(course.id)} onMouseLeave={() => setActive(null)}
          data-active={active === course.id} data-muted={connected ? !connected.has(course.id) : false}
          aria-label={`${course.code}: ${course.title}. ${course.prerequisiteText ?? "No recorded course prerequisites."}`}''')
a=s.index('function SemesterPreview('); b=s.index('type PreviewMeeting',a)
s=s[:a]+'''function SemesterPreview({ catalog }: { catalog: ProgramCatalog }) {
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

'''+s[b:]
a=s.index('export default function Landing()')
s=s[:a]+'''function PlanningSignal({ catalog }: { catalog: ProgramCatalog }) {
  const calculus = catalog.courses.find(course => course.title === "Calculus II");
  const writing = catalog.courses.find(course => course.title === "Argument and Analysis");
  const labels = [calculus?.title, writing?.title].filter(Boolean);
  return <div data-hero className={s.heroArt}>
    <svg viewBox="0 0 620 500" className={s.signal} role="group" aria-label="Explore courses, arrange a semester, then build a week">
      <rect x="12" y="12" width="596" height="476" rx="20" fill="#f7f7f5" />
      <path data-signal-line d="M42 116 H180 Q210 116 210 146 V234 Q210 264 240 264 H382 Q412 264 412 294 V388 Q412 418 442 418 H574" fill="none" stroke="#e44a2e" strokeWidth="3" pathLength="1" />
      <a href="#explore" aria-label="Explore the courses"><g data-signal-stage="courses"><text x="42" y="63">Courses</text><rect x="42" y="86" width="138" height="60" rx="16" fill="#eceae5"/><text x="61" y="122">Calculus I</text></g></a>
      <a href="#your-plan" aria-label="Inspect the semester plan"><g data-signal-stage="semester"><text x="246" y="175">Semester</text><rect x="234" y="196" width="192" height="134" rx="18" fill="#ffffff" stroke="#dededb"/></g></a>
      {labels.map((label, i) => <a href="#your-plan" key={label} aria-label={`${label}, semester preview`}><g data-signal-course={i}><rect x="246" y={208+i*56} width="168" height="44" rx="12" fill={i === 0 ? "#eceae5" : "#f1f1ef"}/><text x="258" y={236+i*56} className={s.signalCourseText}>{label}</text></g></a>)}
      <a href="#your-week" aria-label="Inspect listed sections in a week"><g data-signal-stage="week"><text x="456" y="297">Week</text><rect x="446" y="316" width="128" height="136" rx="16" fill="#ffffff" stroke="#dededb"/><path d="M488 330V438 M532 330V438 M458 366H562 M458 404H562" stroke="#dededb" fill="none"/></g><g data-signal-meetings><rect x="455" y="338" width="25" height="46" rx="5" fill="#171717"/><rect x="497" y="380" width="26" height="48" rx="5" fill="#e44a2e"/><rect x="541" y="338" width="25" height="46" rx="5" fill="#171717"/></g></a>
    </svg>
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
      <section className={cn(s.hero, s.wrap)}><div className={s.heroCopy}><h1>Make room for<br />what’s <em className={s.heroAccent}>next.</em></h1><p>Connect courses, shape a semester, and see how your plan fits into the week.</p><a className={s.button} href="#explore">Explore courses <ArrowRight size={18} aria-hidden="true" /></a></div><PlanningSignal catalog={catalog} /></section>
      <section id="explore" data-reveal className={cn(s.wrap, s.explore)}><div className={s.sectionTop}><h2>Find a course.<br />See the possibility.</h2><div><p>Search the catalog by name or course code. Start with what you want to understand.</p><p className={s.scope}>Program views: Computer Engineering and Software Engineering.</p></div></div><div className={s.explorer}><div className={s.explorerTools}><label className={s.search}><MagnifyingGlass size={22} aria-hidden="true" /><input aria-label="Search courses" placeholder="Try Calculus or a course code" value={query} onChange={event => setQuery(event.target.value)} /></label><span>{catalog.catalogYear} catalog · {catalog.abbreviation}</span></div><div role="status" className={s.resultCount}>{matches.length} matching courses · showing {results.length}</div><div className={s.searchResults}>{results.length ? results.map(course => <CourseRow key={course.id} course={course} />) : <p className={s.noResults}>No courses match “{query}”. Try “Calculus” or a course code.</p>}</div></div></section>
      <section id="your-path" className={s.pathBand}><div data-reveal data-section="path" className={cn(s.pathSection, s.wrap)}><div className={s.sectionTop}><h2>Understand what<br />comes before.</h2><p>Follow a course to see its connected path. Hover or focus a course to trace its prerequisites and what follows.</p></div><PathPreview catalog={catalog} /><p className={s.caption}>Recorded catalog relationships. Grade requirements and other conditions still apply; verify them in the official SJSU program guide.</p></div></section>
      <section id="your-plan" data-reveal className={cn(s.wrap, s.planLayout)}><div className={s.sectionTop}><h2>Give the next steps<br />a place.</h2><p>Review a semester at a time. Your personal plan can change as you mark completed courses and arrange what comes next.</p></div><SemesterPreview catalog={catalog} /></section>
      <section id="your-week" className={s.weekBand}><div data-reveal className={cn(s.weekSection, s.wrap)}><div className={s.sectionTop}><h2>A semester,<br />with time to think.</h2><p>See listed sections in the week. Compare meeting times before choosing the schedule you want to review.</p></div><WeekPreview catalog={catalog} /><p className={s.caption}>Illustrative selection from the {catalog.currentTerm.name} listed-section snapshot, captured {new Date(catalog.currentTerm.fetchedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}. Availability is not live enrollment.</p><div id="assistant-planning" data-reveal className={s.assistantNote}><Sparkle size={30} aria-hidden="true" /><h3>A proposal.<br />Your decision.</h3><p>The assistant compares listed sections with your plan and unavailable times. Review its proposal and warnings before applying a schedule. Suggestions do not confirm requirements or enrollment.</p></div></div></section>
      <section className={s.close}><div data-reveal className={cn(s.wrap, s.closeInner)}><h2>Start with a course.<br />Build a clearer plan.</h2><a className={s.button} href="#explore">Explore courses <ArrowRight size={18} aria-hidden="true" /></a></div></section>
    </main><footer className={cn(s.footer, s.wrap)}><a className={s.brand} href="#top">Course Radar<span className={s.brandDot}>.</span></a><p>Course completion and semester plans are session drafts and reset on refresh. This is not an official degree audit. Verify requirements and enrollment details with SJSU.</p><a href="#top">Back to top <ArrowUp size={16} aria-hidden="true" /></a></footer>
  </div>;
}
'''
p.write_text(s,encoding='utf-8')
