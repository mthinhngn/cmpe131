from pathlib import Path
p=Path('src/SemesterPlanner.tsx')
s=p.read_text()
s=s.replace('ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, GripVertical, Info, Plus, Search, Trash2, TriangleAlert, Undo2','ArrowRight, ArrowUpRight, BookOpen, Check, Info, Plus, Search, Undo2')
s=s.replace('  const [dragged, setDragged] = useState<string | null>(null);\n','')
s=s.replace('  const reviews = activeCourses.filter(c => missing(c).length || c.corequisiteCourseIds.some(id => !takenCourseIds.has(id)));\n','')
s=s.replace('<span className="sp-session">Session draft <Info size={13}/></span>','')
s=s.replace('<h1>A little structure.<br/><span>A clearer path ahead.</span></h1><p>Your semesters, side by side. Make room for what comes next.</p>','<h1>A little structure.<br/><span>A clearer path ahead.</span></h1>')
s=s.replace('</button><small>Adds unplanned catalog courses. Fully editable.</small></div>','</button></div>')
s=s.replace('<a href="#sp-workbench">Shape your semesters <ArrowDown size={14}/></a>','')
a=s.index('      <section className="sp-timeline"')
b=s.index('      <footer className="sp-footer"',a)
s=s[:a]+'''      <section className="sp-timeline" aria-label="Choose a semester">{semesters.map(n => <button key={n} aria-pressed={n === semester} className={n === semester ? "is-active" : ""} onClick={() => setSemester(n)}><span>Year {Math.ceil(n / 2)}</span><strong>Semester {n}</strong><small>{inSemester(n).length} courses <span>·</span> {units(inSemester(n))} units</small></button>)}</section>

      <section className="sp-selection" aria-label={`Courses planned for Semester ${semester}`}>
        <div className="sp-selection-heading"><h2>Semester {semester}</h2><span>{activeCourses.length} {activeCourses.length === 1 ? "course" : "courses"} · {units(activeCourses)} units</span></div>
        <div className="sp-selection-courses">{activeCourses.length ? activeCourses.map(c => <button key={c.id} className="sp-selection-course" onClick={() => setSelected(c)}><span><strong>{c.code}</strong>{c.title}</span><small>{c.units} units <ArrowUpRight size={13}/></small></button>) : <p className="sp-selection-empty">No courses planned here yet. Choose one from the catalog below.</p>}</div>
      </section>

      <section id="sp-workbench" className="sp-catalog" aria-label="Course library">
        <div className="sp-catalog-head"><div><h2>Course library</h2><p>{remaining.length} courses ready to plan</p></div><label className="sp-search"><Search size={17}/><input ref={search} aria-label="Search course library" type="search" placeholder="Search code or course name" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
        <div className="sp-catalog-tabs" role="group" aria-label="Filter course library"><button aria-pressed={filter === "suggested"} onClick={() => setFilter("suggested")}>For Semester {semester}</button><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All courses</button><Link to="/courses">Explore sections & weekly schedule <ArrowUpRight size={14}/></Link></div>
        <div className="sp-catalog-grid">{results.map(c => <article key={c.id}><button className="sp-catalog-course" onClick={() => setSelected(c)}><strong>{c.code}</strong><span>{c.title}</span><small>{c.units} units</small></button><button className="sp-plus" aria-label={`Add ${c.code} to Semester ${semester}`} onClick={() => change(c, semester)}><Plus size={17}/></button></article>)}{!results.length && <div className="sp-catalog-empty"><h3>{query ? "No matching courses" : "All suggested courses are in your plan."}</h3><p>{query ? "Try another course code or name." : "Browse all courses for more options."}</p><button onClick={() => { setQuery(""); setFilter("all"); }}>Browse all courses <ArrowRight size={14}/></button></div>}</div>
      </section>
''' + s[b:]
p.write_text(s)
