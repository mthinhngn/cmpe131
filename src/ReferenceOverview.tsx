import { ProductPageHeading } from "./ProductPageHeading";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useCatalog } from "./CatalogContext";
import { ProductHeader } from "./ProductHeader";
import { overviewData } from "./overviewData";
import { slotLabel, type PlanSlot } from "./academicProfile";
import type { Course, RequirementItem } from "./types";
import { courseSubject } from "./courseSubject";
import { plannerPlacements } from "./plannerData";
import { ProgramRequirements } from "./ProgramRequirements";

/* Overview · Bento Porcelain. Ported from /overview-versions/d1-bento-porcelain and wired to the
   shared catalog, completion records and saved plan. Status is never inferred: a course is complete
   only when recorded, current when in progress or placed in the current term, planned when placed. */

const SUBJECTS = [
  { key: "major", label: "Major", codes: ["CMPE", "CS", "SE"] },
  { key: "math", label: "Math", codes: ["MATH"] },
  { key: "science", label: "Science", codes: ["PHYS", "BIOL", "CHEM"] },
  { key: "eng", label: "Engineering", codes: ["ENGR", "EE", "ISE"] },
  { key: "writing", label: "Writing", codes: ["ENGL"] },
  { key: "university", label: "University electives", codes: [] as string[] },
  { key: "technical", label: "Technical electives", codes: [] as string[] },
  { key: "choice", label: "Requirement choice", codes: [] as string[] },
] as const;
type SubjectKey = typeof SUBJECTS[number]["key"];
const ORDER = SUBJECTS.map(s => s.key) as SubjectKey[];
const label = (key: SubjectKey) => SUBJECTS.find(s => s.key === key)!.label;
const sc = (key: SubjectKey) => `var(--s-${key})`;
const STATUS = { complete: "Completed", current: "In progress", planned: "Planned", remaining: "Still to plan" } as const;
type Status = keyof typeof STATUS;
const STATUS_COLOR: Record<Status, string> = { complete: "var(--st-complete)", current: "var(--st-current)", planned: "var(--st-planned)", remaining: "var(--faint)" };

type Item = { id: string; code: string; title: string; units: number; slot: PlanSlot; status: Status; subject: SubjectKey; course?: Course };

const PATHS: Record<string, ReactNode> = {
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />, out: <path d="M7 17 17 7M9 7h8v8" />, plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  radar: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><path d="M12 12 18 6" /></>,
  book: <><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z" /><path d="M5 20.5V5.5" /></>,
  flag: <path d="M6 21V4M6 4h11l-2 4 2 4H6" />, layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
};
function Icon({ name, small = false }: { name: keyof typeof PATHS; small?: boolean }) {
  return <svg className={`bo-ic bo-ic-${name}${small ? " sm" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>;
}

/** Counts up on first paint, then glides between values. */
function useCountUp(value: number, delay: number) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  const first = useRef(true);
  useEffect(() => {
    const start = performance.now() + (first.current ? delay : 0), origin = from.current, duration = first.current ? 1700 : 600;
    first.current = false;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / duration)), eased = 1 - Math.pow(2, -10 * k);
      const next = origin + (value - origin) * eased;
      setShown(Math.round(next)); from.current = next;
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);
  return shown;
}

// Keep count-up frames local instead of rendering the entire dashboard per tick.
function CountUp({ value, delay }: { value: number; delay: number }) {
  return useCountUp(value, delay);
}

/** Segmented control with a sliding thumb. */
function Segmented<T extends string>({ value, options, onChange, label: aria }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  const group = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = group.current; if (!node) return;
    const align = () => {
      const on = node.querySelector<HTMLButtonElement>('[aria-pressed="true"]'), thumb = node.querySelector<HTMLElement>(".bo-thumb");
      if (on && thumb) { thumb.style.width = `${on.offsetWidth}px`; thumb.style.transform = `translateX(${on.offsetLeft - 2}px)`; }
    };
    align();
    const observer = new ResizeObserver(align); observer.observe(node);
    void document.fonts?.ready.then(align);
    return () => observer.disconnect();
  }, [value]);
  return <span ref={group} className="bo-segc" role="group" aria-label={aria}><i className="bo-thumb" aria-hidden="true" />{options.map(([v, text]) => <button type="button" key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>)}</span>;
}

function Tile({ className = "", order, children }: { className?: string; order: number; children: ReactNode }) {
  return <section className={`bo-tile ${className}`} style={{ "--i": order } as CSSProperties}>{children}</section>;
}

const choiceUnits = (item: RequirementItem) => Number(item.description?.match(/(\d+)\s*(?:-\s*\d+\s*)?units?/i)?.[1] ?? 0);

export default function Overview() {
  const { catalog, allCourses, program, takenCourseIds, plans, semesterCount, termOrder, termToSlot, mode, retry } = useCatalog();
  const summary = useMemo(() => overviewData(catalog, takenCourseIds, plans), [catalog, takenCourseIds, plans]);
  const currentSlot: PlanSlot | null = termToSlot[catalog.currentTerm.id] ?? null;
  const [selection, setSelection] = useState<string | null>(null);
  const [subject, setSubject] = useState<SubjectKey | null>(null);
  const [semester, setSemester] = useState<PlanSlot | null>(null);
  const [colour, setColour] = useState<"subject" | "status">("subject");
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

  const roadmapCodes = useMemo(() => new Set(catalog.courses.map(c => c.code)), [catalog.courses]);
  const subjectOf = (course: Course) => course.plannerCategory ?? courseSubject(course.code, roadmapCodes.has(course.code), program);
  const courses = useMemo(() => allCourses.filter(c => summary.required.some(r => r.id === c.id) || plans[c.id] || takenCourseIds.has(c.id)), [allCourses, summary.required, plans, takenCourseIds]);
  const slotOf = (c: Course): PlanSlot => plans[c.id]?.semester ?? c.recommendedSemester;
  const statusOf = (c: Course): Status => takenCourseIds.has(c.id) ? "complete"
    : plans[c.id]?.status === "in-progress" || (plans[c.id] && currentSlot !== null && plans[c.id].semester === currentSlot) ? "current"
    : plans[c.id] ? "planned" : "remaining";

  const courseItems: Item[] = courses.map(c => ({ id: c.id, code: c.code, title: c.title, units: c.units, slot: slotOf(c), status: statusOf(c), subject: subjectOf(c), course: c }));
  const choiceItems: Item[] = catalog.requirementGroups.flatMap((g, gi) => g.items.filter(it => !it.courseId).map(it => ({ id: it.id, code: it.label ?? "Requirement choice", title: it.description ?? "Requirement choice", units: choiceUnits(it), slot: it.recommendedSemester ?? gi + 1, status: "remaining" as Status, subject: (/technical/i.test(it.label ?? "") ? "technical" : /university elective/i.test(it.label ?? "") ? "university" : "choice") as SubjectKey })));
  const items = [...courseItems, ...choiceItems];
  const placements = useMemo(() => plannerPlacements(allCourses, plans, takenCourseIds, termOrder), [allCourses, plans, takenCourseIds, termOrder]);
  const chartItems = placements.map(p => courseItems.find(i => i.id === p.course.id)!);
  const chartIn = (slot: PlanSlot) => chartItems.filter(i => i.slot === slot).sort((a, b) => Number(b.status === "complete") - Number(a.status === "complete"));
  const numericMax = Math.max(catalog.requirementGroups.length, semesterCount, ...items.flatMap(i => typeof i.slot === "number" ? [i.slot] : []));
  const slots: PlanSlot[] = termOrder;
  const termFor = (s: PlanSlot) => Object.entries(termToSlot).find(([, n]) => n === s)?.[0];
  const termLabel = (s: PlanSlot) => typeof s === "string" ? slotLabel(s) : termFor(s) ? slotLabel(termFor(s)!) : `${s % 2 ? "Fall" : "Spring"} Y${Math.ceil(s / 2)}`;
  const slotShort = (s: PlanSlot) => typeof s === "number" ? `S${s}` : slotLabel(s);
  const byId = new Map(courses.map(c => [c.id, c]));
  const unlocks = (id: string) => courses.filter(c => c.prerequisiteCourseIds.includes(id));
  const sum = (list: Item[]) => list.reduce((a, i) => a + i.units, 0);

  // subject stats across every listed course and requirement choice
  const stats = Object.fromEntries(ORDER.map(k => {
    const list = items.filter(i => i.subject === k);
    return [k, { total: sum(list), done: sum(list.filter(i => i.status === "complete")) }];
  })) as Record<SubjectKey, { total: number; done: number }>;
  const allUnits = ORDER.reduce((a, k) => a + stats[k].total, 0);
  const doneUnits = ORDER.reduce((a, k) => a + stats[k].done, 0);
  const percent = allUnits ? Math.round(doneUnits / allUnits * 100) : 0;

  const current = courseItems.filter(i => i.status === "current");
  const currentUnits = sum(current);
  const nextUp = [...courseItems.filter(i => i.status === "planned").sort((a, b) => String(a.slot).localeCompare(String(b.slot), undefined, { numeric: true })),
    ...courseItems.filter(i => i.status === "remaining").sort((a, b) => (typeof a.slot === "number" ? a.slot : 99) - (typeof b.slot === "number" ? b.slot : 99)).slice(0, 3)].slice(0, 7);

  const fallback = current[0] ?? nextUp[0] ?? courseItems[0];
  const selected = byId.get(selection ?? "") ?? fallback?.course;
  const selectedItem = courseItems.find(i => i.id === selected?.id);
  const chain: Course[][] = [];
  if (selected) {
    const seen = new Set([selected.id]); let frontier = [selected];
    for (let d = 0; d < 3 && frontier.length; d++) {
      const next = [...new Map(frontier.flatMap(c => unlocks(c.id)).filter(c => !seen.has(c.id)).map(c => [c.id, c])).values()];
      if (!next.length) break;
      next.forEach(c => seen.add(c.id)); chain.push(next); frontier = next;
    }
  }

  // tiles below the fold wait until they are scrolled into view
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const tiles = [...(root.current?.querySelectorAll<HTMLElement>(".bo-tile") ?? [])].filter(t => t.getBoundingClientRect().top > innerHeight * 0.9);
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      (e.target as HTMLElement).style.animationDelay = "0ms";
      e.target.classList.remove("held"); io.unobserve(e.target);
    }), { rootMargin: "0px 0px -12% 0px" });
    tiles.forEach(t => { t.classList.add("held"); io.observe(t); });
    return () => io.disconnect();
  }, []);

  const tilt = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    const card = event.currentTarget, r = card.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - 0.5, y = (event.clientY - r.top) / r.height - 0.5;
    const amount = Number(getComputedStyle(card).getPropertyValue("--tilt")) || 0;
    if (!amount) return;
    card.style.transform = `perspective(900px) translateY(-4px) rotateX(${(-y * 7 * amount).toFixed(2)}deg) rotateY(${(x * 9 * amount).toFixed(2)}deg)`;
  };
  const untilt = (event: ReactPointerEvent<HTMLElement>) => { event.currentTarget.style.transform = ""; };

  // ring
  const C = 2 * Math.PI * 72;
  let acc = 0;
  const arcs = ORDER.flatMap((k, n) => {
    if (!allUnits || !stats[k].total) return [];
    const f = stats[k].total / allUnits, df = stats[k].done / allUnits, gap = 2.5, offset = -acc * C, dim = subject && subject !== k ? 0.2 : 1;
    acc += f;
    return [
      <circle key={`${k}-t`} cx="90" cy="90" r="72" stroke={sc(k)} strokeOpacity={dim} style={{ "--dash": `${Math.max(0, f * C - gap)} ${C}`, "--C": C, "--d": `${520 + n * 70}ms` } as CSSProperties} strokeDashoffset={offset} />,
      ...(df > 0 ? [<circle key={`${k}-d`} cx="90" cy="90" r="72" stroke={sc(k)} opacity={dim} style={{ "--dash": `${Math.max(0, df * C - gap)} ${C}`, "--C": C, "--d": `${620 + n * 70}ms` } as CSSProperties} strokeDashoffset={offset} />] : []),
    ];
  });

  const maxColumn = Math.max(22, ...slots.map(s => chartIn(s).reduce((n, c) => n + Math.max(2, c.units), 0)));
  const q = query.trim().toLowerCase();
  const rows = courseItems.filter(i => (!subject || i.subject === subject) && (semester === null || i.slot === semester) && (!q || `${i.code} ${i.title}`.toLowerCase().includes(q)))
    .sort((a, b) => (typeof a.slot === "number" ? a.slot : 99) - (typeof b.slot === "number" ? b.slot : 99) || a.code.localeCompare(b.code));
  const pickSubject = (k: SubjectKey) => setSubject(subject === k ? null : k);
  const chip = (c: Course) => <button type="button" key={c.id} className="bo-cchip" style={{ "--c": sc(subjectOf(c)) } as CSSProperties} onClick={() => setSelection(c.id)}><i />{c.code}</button>;

  return <div className="bo-page" ref={root}>
    <ProductHeader activePath="/overview" />
    <main className="bo-wrap">
      <ProductPageHeading title="Overview" />
      <ProgramRequirements />
      <div className="bo-bento">
        <Tile className="bo-term t-term" order={0}>
          <div className="bo-th"><h2><Icon name="spark" />This term</h2><a className="bo-ghost" href="/schedule"><Icon name="calendar" />Schedule<Icon name="arrow" small /></a></div>
          <div className="bo-big"><CountUp value={currentUnits} delay={450} /> units <span className="g">in motion</span></div>
          <p className="bo-sub">{currentSlot !== null ? `${catalog.currentTerm.name} · Semester ${currentSlot} of ${numericMax} · ${current.length} course${current.length === 1 ? "" : "s"} in progress` : `${catalog.currentTerm.name} · Add a starting term to mark which semester is current.`}</p>
          {current.length ? <div className="bo-now-grid">{current.map(i => {
            const opens = unlocks(i.id);
            return <button type="button" key={i.id} className="bo-ncard" style={{ "--c": sc(i.subject) } as CSSProperties} aria-pressed={selected?.id === i.id} onClick={() => setSelection(i.id)} onPointerMove={tilt} onPointerLeave={untilt}>
              <span className="nt"><b><i className="bo-live" />{i.code}</b><span className="tag">{label(i.subject)}</span></span>
              <span className="t">{i.title}</span>
              <small>{opens.length ? `Opens ${opens.map(o => o.code).join(", ")}` : `${i.units} units`}<Icon name="arrow" small /></small>
            </button>;
          })}</div> : <p className="bo-empty">No courses are in progress for {catalog.currentTerm.name}. Place courses in the current semester from the <a href="/planner">planner</a>.</p>}
        </Tile>

        <Tile className="t-ring" order={1}>
          <div className="bo-th"><h2><Icon name="layers" />Units by subject</h2><span className="bo-hint">Select a subject</span></div>
          <div className="bo-ringbox">
            <div className="bo-ring"><svg viewBox="0 0 180 180" aria-hidden="true" key={program}>{arcs}</svg><div className="c"><b><CountUp value={percent} delay={650} /><small>%</small></b><span>of all units done</span></div></div>
            <ul className={`bo-slist${subject ? " filtering" : ""}`}>{ORDER.filter(k => stats[k].total).map(k => <li key={k}><button type="button" style={{ "--c": sc(k) } as CSSProperties} aria-pressed={subject === k} onClick={() => pickSubject(k)}><i /><span>{label(k)}</span><small>{stats[k].done}/{stats[k].total}u</small></button></li>)}</ul>
          </div>
        </Tile>

        <Tile className="t-chart" order={2}>
          <div className="bo-th"><h2><Icon name="grid" />Semester load</h2><Segmented label="Colour blocks by" value={colour} onChange={setColour} options={[["subject", "Subject"], ["status", "Status"]]} /></div>
          <div className="bo-chart-scroll">
            <div className="bo-chart" data-colour={colour} key={program} style={{ "--max": maxColumn, "--cols": slots.length } as CSSProperties} role="group" aria-label="Units per semester">
              <i className="bo-ref" style={{ bottom: `calc(var(--uh) * 15)` }}><span>15u TYPICAL FULL LOAD</span></i>
              {slots.map((s, si) => {
                const list = chartIn(s);
                return <button type="button" key={String(s)} className={`bo-col${s === currentSlot ? " is-now" : ""}`} aria-pressed={semester === s} aria-label={`${termLabel(s)}, ${sum(list.filter(i => i.status !== "complete"))} planned units, ${sum(list.filter(i => i.status === "complete"))} completed units: ${list.map(i => i.code).join(", ") || "nothing placed"}`} onClick={() => setSemester(semester === s ? null : s)}>
                  {list.map((i, j) => <span key={i.id} title={`${i.code} · ${i.units}u · ${STATUS[i.status]}`} className={`bo-blk${i.status === "complete" ? " done" : i.status === "remaining" ? " remaining" : ""}${i.subject === "choice" && colour === "subject" ? " choice" : ""}${subject && subject !== i.subject ? " dim" : ""}`} style={{ "--u": i.units, "--c-ink": i.subject === "writing" ? "#fff" : "#000", "--c": colour === "subject" ? sc(i.subject) : STATUS_COLOR[i.status], "--d": `${420 + si * 90 + j * 45}ms` } as CSSProperties} data-small={i.units < 2 || undefined}><b>{i.code}</b><small>{i.units}</small></span>)}
                </button>;
              })}
            </div>
            <div className="bo-xl" style={{ "--cols": slots.length } as CSSProperties}>{slots.map(s => <span key={String(s)}><b>{slotShort(s)}<em>{sum(chartIn(s).filter(i => i.status !== "complete"))}u</em></b><small>{termLabel(s)}</small></span>)}</div>
          </div>
          <div className="bo-key"><span><i className="k-done" />Completed</span><span><i className="k-plan" />In progress or planned</span></div>
        </Tile>

        <Tile className="t-progress" order={3}>
          <div className="bo-th"><h2><Icon name="book" />Subject progress</h2></div>
          <div className="bo-sbar">{ORDER.filter(k => k !== "choice" && stats[k].total).map((k, n) => <div key={k} style={{ "--c": sc(k), "--d": `${700 + n * 90}ms` } as CSSProperties}>
            <span className="lab"><span>{label(k)}</span><small>{stats[k].done} of {stats[k].total}u</small></span>
            <span className="track"><span className="fill" style={{ transform: `scaleX(${stats[k].done / stats[k].total})` }} /></span>
          </div>)}</div>
        </Tile>

        <Tile className="t-next" order={4}>
          <div className="bo-th"><h2><Icon name="flag" />Next up</h2><a className="bo-ghost" href="/planner"><Icon name="plus" />Plan a course</a></div>
          {nextUp.length ? <ul className="bo-nlist">{nextUp.map(i => <li key={i.id}><button type="button" style={{ "--c": sc(i.subject) } as CSSProperties} onClick={() => setSelection(i.id)}><i /><span><b>{i.code}</b>{i.title}</span><small>{i.status === "planned" ? "PLANNED" : slotShort(i.slot)}</small></button></li>)}</ul>
            : <p className="bo-empty">Every listed core course is completed or in progress.</p>}
        </Tile>

        <Tile className="t-detail" order={5}>
          <div className="bo-th"><h2><Icon name="radar" />Course</h2></div>
          <div aria-live="polite">{selected && selectedItem ? <div key={selected.id} className="bo-detail" style={{ "--c": sc(selectedItem.subject) } as CSSProperties}>
            <div className="bo-dtop"><h3>{selected.code} <span className="g">{selected.title}</span></h3><span className="bo-stag">{selectedItem.status === "current" && <i className="bo-live" />}{label(selectedItem.subject)} · {STATUS[selectedItem.status]}</span></div>
            <div className="bo-facts"><span><b>{selected.units}</b> units</span><span><b>{slotShort(selectedItem.slot)}</b> {typeof selectedItem.slot === "number" ? termLabel(selectedItem.slot) : "Personal plan"}</span><span><b>{chain.flat().length}</b> later course{chain.flat().length === 1 ? "" : "s"} depend on it</span></div>
            <div className="bo-lbl">Requires</div>
            {selected.prerequisiteCourseIds.some(id => byId.has(id)) && <div className="bo-chips">{selected.prerequisiteCourseIds.flatMap(id => byId.get(id) ? [chip(byId.get(id)!)] : [])}</div>}
            <p className="bo-dtext">{selected.prerequisiteText || "No recorded course prerequisite in this roadmap."}</p>
            {selected.corequisiteCourseIds.some(id => byId.has(id)) && <><div className="bo-lbl">Corequisites</div><div className="bo-chips">{selected.corequisiteCourseIds.flatMap(id => byId.get(id) ? [chip(byId.get(id)!)] : [])}</div></>}
            <div className="bo-lbl">Opens</div>
            {chain.length ? chain.map((level, n) => <div className="bo-chips bo-step" key={n}><span>STEP {n + 1}</span>{level.map(chip)}</div>) : <p className="bo-dtext">Not a recorded prerequisite for later core courses.</p>}
            <div className="bo-dfoot"><a className="bo-ghost" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer"><Icon name="book" />Catalog entry<Icon name="out" small /></a><a className="bo-ghost" href="/roadmap"><Icon name="radar" />On the map<Icon name="arrow" small /></a></div>
          </div> : <p className="bo-empty">No listed core courses in this catalog.</p>}</div>
        </Tile>

        <Tile className="t-table" order={6}>
          <div className="bo-th"><h2><Icon name="layers" />Roadmap &amp; planned courses</h2>
            <div className="bo-filters">
              <label className="bo-search"><Icon name="search" /><input type="search" placeholder="Find a course" aria-label="Find a course" value={query} onChange={e => setQuery(e.target.value)} /></label>
              {ORDER.filter(k => k !== "choice" && stats[k].total).map(k => <button type="button" key={k} className="bo-pill" aria-pressed={subject === k} onClick={() => pickSubject(k)}><span className="sw" style={{ background: sc(k) }} />{label(k)}</button>)}
              {semester !== null && <button type="button" className="bo-pill" aria-pressed="true" onClick={() => setSemester(null)}>{slotShort(semester)} ✕</button>}
            </div>
          </div>
          <div className="bo-scroll"><table className="bo-table"><thead><tr><th>Course</th><th className="hide-s">Title</th><th>Status</th><th>Sem</th><th>Units</th></tr></thead>
            <tbody key={`${program}|${subject}|${semester}|${q}`}>{rows.length ? rows.map((i, n) => <tr key={i.id} tabIndex={0} className={i.id === selected?.id ? "sel" : ""} style={{ "--c": sc(i.subject), "--rd": `${Math.min(n, 14) * 32}ms` } as CSSProperties} onClick={() => setSelection(i.id)} onKeyDown={e => e.key === "Enter" && setSelection(i.id)}>
              <td className="code"><i />{i.code}</td><td className="hide-s">{i.title}</td>
              <td><span className="bo-st">{i.status === "current" ? <i className="bo-live" style={{ color: "var(--st-current)" }} /> : <i className={`bo-dot ${i.status}`} />}{STATUS[i.status]}</span></td>
              <td className="m">{slotShort(i.slot)}</td><td className="m">{i.units}</td>
            </tr>) : <tr><td colSpan={5} className="m bo-none">No courses match. Clear a filter to see more.</td></tr>}</tbody></table></div>
        </Tile>
      </div>
      <footer className="bo-foot" role="status">
        <span>{mode === "loading" ? "Connecting to catalog…" : mode === "database" ? `${catalog.name}, ${catalog.catalogYear} catalog, verified ${catalog.lastVerifiedAt}` : <>Reviewed local snapshot <button type="button" onClick={retry}>Retry connection</button></>}</span>
        <span><a href={catalog.programUrl || catalog.sourceUrl} target="_blank" rel="noopener noreferrer">Official program page</a> · A personal planning aid, not a degree audit</span>
      </footer>
    </main>

  </div>;
}
