import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import "./roadmap-stepper.css";

/* Roadmap (/roadmap) chrome: context row and sticky semester stepper around the
   shared React Flow board. Selected design: Command stepper, Graphite mint / glide. */

/** Places a single thumb under the active child, so selection glides instead of jumping. */
function useSlidingThumb(ref: RefObject<HTMLElement | null>, selector: string, key: unknown) {
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const thumb = container.querySelector<HTMLElement>(":scope > .rv-thumb");
    if (!thumb) return;
    const place = () => {
      let target = container.querySelector<HTMLElement>(selector);
      if (!target) { thumb.style.setProperty("--thumb-o", "0"); return; }
      // Measure the container's direct child (e.g. the <li>), whose offsetParent is the container.
      while (target.parentElement && target.parentElement !== container) target = target.parentElement;
      // Layout offsets ignore entrance transforms still running on the items.
      // Read geometry together; keep writes off the parent to avoid invalidating every button.
      const x = target.offsetLeft, y = target.offsetTop, width = target.offsetWidth, height = target.offsetHeight;
      thumb.style.setProperty("--thumb-x", `${x}px`);
      thumb.style.setProperty("--thumb-y", `${y}px`);
      thumb.style.setProperty("--thumb-w", `${width}px`);
      thumb.style.setProperty("--thumb-h", `${height}px`);
      thumb.style.setProperty("--thumb-o", "1");
    };
    place();
    const frame = requestAnimationFrame(() => { container.dataset.thumb = "ready"; });
    const observer = new ResizeObserver(place);
    observer.observe(container);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [ref, selector, key]);
}

const programs = [
  { id: "computer-engineering", label: "Computer Engineering" },
  { id: "software-engineering", label: "Software Engineering" },
];

export type RoadmapProgress = { completed: number; required: number; percent: number; completedUnits: number; coreUnits: number };
export type SemesterStat = { term: string; count: number; credits: number; done: number };

export function RoadmapContext({ program, onProgramChange, edition, progress }: {
  program: string;
  onProgramChange: (program: string) => void;
  edition: string;
  progress: RoadmapProgress;
}) {
  const current = programs.find(item => item.id === program) ?? programs[0];
  const programRef = useRef<HTMLDivElement>(null);
  useSlidingThumb(programRef, '[aria-checked="true"]', program);
  return <div className="rv-context" aria-label="Roadmap workspace context">
    <div className="rv-context-lead">
      <div className="rv-crumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>Roadmap</strong></div>
      <p className="rv-title" key={current.id}>{current.label} <span>roadmap</span></p>
    </div>
    <div className="rv-context-meta">
      <div className="rv-stat" aria-label={`${progress.completed} of ${progress.required} core courses completed`}>
        <span className="rv-stat-value" key={progress.percent}>{progress.percent}%</span>
        <span className="rv-stat-meter" aria-hidden="true"><i style={{ width: `${progress.percent}%` }} /></span>
        <span className="rv-stat-label">{progress.completed}/{progress.required} core · {progress.completedUnits}/{progress.coreUnits} units</span>
      </div>
      <div ref={programRef} className="rv-program" role="radiogroup" aria-label="Degree program"><span className="rv-thumb" aria-hidden="true" />{programs.map(item => <button key={item.id} type="button" role="radio" aria-checked={item.id === program} onClick={() => onProgramChange(item.id)}>{item.label}</button>)}</div>
      <span className="rv-edition">{edition}</span>
    </div>
  </div>;
}

/** Scroll position of each semester label inside the flow, so the stepper can jump and follow. */
function semesterNode(index: number) {
  return document.querySelector<HTMLElement>(`.react-flow__node[data-id="semester-${index + 1}"]`);
}

function useSemesterSpy(count: number) {
  const [active, setActive] = useState(0);
  // A jump near the page end cannot reach the reading line; keep its target while it stays in view.
  const jumped = useRef<number | null>(null);
  const glide = useRef(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * .38;
      let next = 0;
      if (jumped.current !== null) {
        const top = semesterNode(jumped.current)?.getBoundingClientRect().top ?? -1;
        // Keep the clicked target while gliding past other semesters, then while it is visible.
        if (glide.current || (top >= 0 && top <= window.innerHeight * .8)) { setActive(jumped.current); return; }
        jumped.current = null;
      }
      for (let index = 0; index < count; index += 1) {
        const node = semesterNode(index);
        if (node && node.getBoundingClientRect().top <= line) next = index;
      }
      setActive(next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(glide.current); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [count]);
  const jump = (index: number) => {
    const node = semesterNode(index);
    if (!node) return;
    // Scripted glide: the browser skips native smooth scrolling when the OS asks for reduced motion.
    const start = window.scrollY;
    const end = Math.max(0, Math.min(node.getBoundingClientRect().top + start - 120, document.documentElement.scrollHeight - window.innerHeight));
    const distance = end - start;
    const duration = Math.min(900, 380 + Math.abs(distance) * .35);
    const began = performance.now();
    const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    cancelAnimationFrame(glide.current);
    const label = node.querySelector<HTMLElement>(".rf-semester-label");
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      window.scrollTo(0, start + distance * ease(t));
      if (t < 1) { glide.current = requestAnimationFrame(step); return; }
      glide.current = 0;
      // Mark the destination row once the scroll settles, so the eye lands on it.
      if (!label) return;
      label.classList.remove("rv-arrive");
      void label.offsetWidth;
      label.classList.add("rv-arrive");
      window.setTimeout(() => label.classList.remove("rv-arrive"), 1400);
    };
    glide.current = requestAnimationFrame(step);
    jumped.current = index;
    setActive(index);
  };
  return { active, jump };
}

export function RoadmapStepper({ stats }: { stats: SemesterStat[] }) {
  const { active, jump: onJump } = useSemesterSpy(stats.length);
  const termsRef = useRef<HTMLOListElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);
  useSlidingThumb(termsRef, ".rv-term.is-active", active);
  useEffect(() => {
    let frame = 0;
    const check = () => { frame = 0; const top = railRef.current?.getBoundingClientRect().top; setStuck(top !== undefined && top <= 0.5); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); };
  }, []);
  return <aside ref={railRef} className={`radar-sidebar rv-rail rv-rail--stepper${stuck ? " is-stuck" : ""}`} aria-label="Semesters">
    <nav aria-label="Jump to semester">
      <ol ref={termsRef} className="rv-terms">
        <li className="rv-thumb" aria-hidden="true" />
        {stats.map((row, index) => {
          const ratio = row.count ? row.done / row.count : 0;
          return <li key={index} style={{ "--i": index } as CSSProperties}>
            <button type="button" className={`rv-term${index === active ? " is-active" : ""}${ratio === 1 ? " is-done" : ""}`} aria-current={index === active ? "step" : undefined} aria-label={`Semester ${index + 1}, ${row.term}: ${row.count} requirements, ${row.credits} units`} onClick={() => onJump(index)}>
              <span className="rv-term-index">S{index + 1}</span>
              <span className="rv-term-copy"><strong>{row.term}</strong></span>
              <span className="rv-term-units">{row.credits}u</span>
              <span className="rv-term-meter" aria-hidden="true"><i style={{ width: `${ratio * 100}%` }} /></span>
            </button>
          </li>;
        })}
      </ol>
    </nav>
  </aside>;
}
