from pathlib import Path
p=Path('src/Landing.tsx');s=p.read_text(encoding='utf-8');a=s.index('function PlanningSignal(');b=s.index('export default function Landing()',a)
s=s[:a]+'''function ProductPreviews({ catalog }: { catalog: ProgramCatalog }) {
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

'''+s[b:];s=s.replace('<PlanningSignal catalog={catalog} />','<ProductPreviews catalog={catalog} />');s=s.replace('Connect courses, shape a semester, and see how your plan fits into the week.','Track your courses, understand prerequisites, and shape a semester that fits your week.');s=s.replace('Illustrative selection · listed sections, not live enrollment</p>','Illustrative selection · listed sections, not live enrollment</p>');s=s.replace('<p className={cn(s.previewFoot)}>Illustrative selection · listed sections, not live enrollment</p>','{!compact && <p className={cn(s.previewFoot)}>Illustrative selection · listed sections, not live enrollment</p>}');s=s.replace('{compact ? "Weekly schedule" : "Your week, in view"}{!compact && <span>{catalog.currentTerm.name}</span>}','{compact ? "Your weekly schedule" : "Your week, in view"}<span>{compact ? "Listed sections" : catalog.currentTerm.name}</span>');s=s.replace('<strong>{offering.courseCode}</strong>','<strong>{compact ? offering.courseCode.replace(/\\s/g, "") : offering.courseCode}</strong>');p.write_text(s,encoding='utf-8')
p=Path('src/landing.styles.ts');s=p.read_text(encoding='utf-8');s=s.replace('page: `cr:bg-radar-paper','page: `cr:bg-radar-fog');s=s.replace('cr:bg-radar-wine cr:!text-white','cr:bg-radar-ink cr:!text-white');a=s.index('  heroArt:');b=s.index('  sectionTop:',a);s=s[:a]+'''  heroArt: `cr:relative cr:w-[calc(100%_-_24px)] cr:justify-self-center cr:max-w-[700px] cr:h-[570px] cr:isolate`,
  heroSchedule: `cr:absolute cr:top-[12px] cr:left-[6%] cr:w-[91%] cr:z-1`,
  heroProgress: `cr:absolute cr:top-[300px] cr:left-0 cr:w-[46%] cr:bg-white cr:border cr:border-solid cr:border-radar-mist cr:rounded-[18px] cr:p-[20px] cr:z-2 cr:[&_h2]:!text-[18px] cr:[&_h2]:!leading-[1.3] cr:[&>p]:text-[15px] cr:[&>p]:text-radar-steel`,
  progressRing: `cr:relative cr:w-[132px] cr:h-[132px] cr:mx-auto cr:my-[8px] cr:[&_svg]:w-full cr:[&_svg]:h-full cr:[&_strong]:absolute cr:[&_strong]:inset-0 cr:[&_strong]:flex cr:[&_strong]:items-center cr:[&_strong]:justify-center cr:[&_strong]:font-display cr:[&_strong]:text-[38px] cr:[&_strong]:font-normal cr:[&_small]:text-[20px]`,
  progressToggle: `cr:mt-[12px] cr:p-[8px_10px] cr:w-full cr:bg-radar-fog cr:text-radar-ink cr:border-0 cr:rounded-control cr:text-[14px]`,
  heroPrerequisites: `cr:absolute cr:top-[336px] cr:right-0 cr:w-[49%] cr:bg-white cr:border cr:border-solid cr:border-radar-mist cr:rounded-[18px] cr:p-[20px] cr:z-3 cr:[&_h2]:!text-[18px] cr:[&_h2]:!leading-[1.3]`,
  miniPath: `cr:relative cr:h-[172px] cr:mt-[12px] cr:[&_svg]:absolute cr:[&_svg]:inset-0 cr:[&_svg]:w-full cr:[&_svg]:h-full cr:[&_span]:absolute cr:[&_span]:bg-radar-fog cr:[&_span]:border cr:[&_span]:border-solid cr:[&_span]:border-radar-mist cr:[&_span]:p-[8px_12px] cr:[&_span]:rounded-control cr:[&_span]:text-[15px] cr:[&_span]:font-medium cr:[&_span:nth-of-type(1)]:top-0 cr:[&_span:nth-of-type(1)]:left-0 cr:[&_span:nth-of-type(2)]:top-[66px] cr:[&_span:nth-of-type(2)]:left-[24%] cr:[&_span:nth-of-type(3)]:bottom-0 cr:[&_span:nth-of-type(3)]:right-0`,
'''+s[b:];s=s.replace('weekSmall: ``','weekSmall: `cr:p-[20px] cr:border cr:border-solid cr:border-radar-mist cr:[&_strong]:text-[13px] cr:[&>div:first-child]:text-[17px] cr:[&>div:first-child>span]:text-[14px] cr:[&_p]:hidden cr:[&>div:nth-child(2)]:grid-cols-[38px_repeat(5,minmax(0,1fr))] cr:[&>div:nth-child(2)]:mt-[20px] cr:[&>div:nth-child(2)>div:first-child]:text-[12px] cr:[&>div:nth-child(2)>div:first-child]:pt-[34px] cr:[&>div:nth-child(2)>div:first-child>span]:h-[38px] cr:[&>div:nth-child(2)>div>span]:text-[13px] cr:[&>div:nth-child(2)>div>span]:pb-[10px] cr:[&>div:nth-child(2)>div>div]:h-[190px] cr:[&_[title]]:p-[3px_2px] cr:[&_[title]_strong]:text-[12px] cr:[&_[title]]:rounded-[6px]`');p.write_text(s,encoding='utf-8')
p=Path('src/theme.css');s=p.read_text(encoding='utf-8');a=s.index('/* Landing-only explanatory sequence:');s=s[:a]+'''/* Landing-only product preview staging; all meaning remains in the settled data. */
[data-landing] main > section:first-child > div:first-child { animation: cr-path-arrive 620ms var(--cr-ease-editorial) both; }
[data-landing] [data-preview="schedule"] { animation: cr-path-arrive 620ms 180ms var(--cr-ease-editorial) both; }
[data-landing] [data-preview="progress"] { animation: cr-plan-arrive 620ms 240ms var(--cr-ease-editorial) both; }
[data-landing] [data-preview="prerequisites"] { animation: cr-week-arrive 620ms 300ms var(--cr-ease-editorial) both; }
[data-landing] [data-mini-path] { animation: cr-signal-draw 620ms 600ms var(--cr-ease-editorial) both; }
[data-landing] [data-mini-node] { animation: cr-path-arrive 620ms 660ms var(--cr-ease-editorial) both; }
[data-landing] [data-mini-node="1"] { animation-delay: 720ms; }
[data-landing] [data-mini-node="2"] { animation-delay: 780ms; }
[data-landing] [data-revealed="true"] { animation: cr-path-arrive 620ms var(--cr-ease-editorial) both; }
[data-landing] [data-hero] [data-week-size] [title] { animation: cr-meeting 500ms 480ms var(--cr-ease-editorial) both; }
[data-landing] [data-progress-arc] { transition: stroke-dasharray 180ms var(--cr-ease-editorial); }
@keyframes cr-signal-draw { from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; } }
@media (hover: hover) and (pointer: fine) {
  [data-landing] a > svg { transition: transform 160ms var(--cr-ease-editorial); }
  [data-landing] a:hover > svg { transform: translateX(3px); }
  [data-landing] [data-preview="prerequisites"]:hover { border-color: #76263d; }
}
''';p.write_text(s,encoding='utf-8')
