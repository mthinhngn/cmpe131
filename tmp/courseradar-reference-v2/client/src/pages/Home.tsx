import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  GraduationCap,
  Network,
  Sparkles,
  Timer,
  Waypoints,
} from "lucide-react";
import CourseNetwork from "@/components/CourseNetwork";

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`reveal${visible ? " is-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

function RadarMark({ small = false }: { small?: boolean }) {
  return (
    <svg className={`radar-mark${small ? " radar-mark-small" : ""}`} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="13.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18" r="7.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M18 18 28.4 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="28.5" cy="7.4" r="3.1" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

const benefits = [
  {
    icon: Network,
    number: "01",
    title: "See the whole sequence.",
    body: "Prerequisites, co-requisites, and the classes they unlock—laid out in one map you can actually read.",
    note: "Connections, made clear",
  },
  {
    icon: Compass,
    number: "02",
    title: "Find your next right course.",
    body: "Know what you’re eligible for now and what to take next, before registration week gets loud.",
    note: "Built around your path",
  },
  {
    icon: Timer,
    number: "03",
    title: "Plan without the portal maze.",
    body: "Spend less time cross-referencing PDFs and outdated pages. Keep the plan, the context, and the why together.",
    note: "Fewer tabs. More certainty.",
  },
];

const steps = [
  { number: "01", title: "Find your courses", body: "Search a clear catalog built around your program—not a dozen disconnected pages.", icon: GraduationCap, visual: <div className="step-search-visual"><span className="mini-search-icon">⌕</span><span>CS 201</span><small>Data Structures</small><span className="mini-match">CORE</span></div> },
  { number: "02", title: "Follow the connections", body: "Trace each prerequisite forward and back. See exactly what a course opens up.", icon: Waypoints, visual: <div className="step-map-visual"><span className="mini-map-node done" /><i /><span className="mini-map-node active" /><i /><span className="mini-map-node next" /></div> },
  { number: "03", title: "Map a path that fits", body: "Turn requirements into a sequence you can plan around—semester by semester.", icon: Check, visual: <div className="step-plan-visual"><span><i>✓</i> Foundations <b>Done</b></span><span><i>02</i> Next semester <b>3 courses</b></span><span><i>03</i> Your next move <b>Ready</b></span></div> },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="site-shell" id="top">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Course Radar home">
          <RadarMark />
          <span>Course<span className="wordmark-light">Radar</span></span>
        </a>
        <nav className={`primary-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#why-radar" onClick={() => setMenuOpen(false)}>Why Course Radar</a>
          <a href="#course-map" onClick={() => setMenuOpen(false)}>Explore the map</a>
        </nav>
        <div className="header-actions">
          <a className="button button-dark header-cta" href="#course-map">Start planning <ArrowUpRight size={15} /></a>
        </div>
        <button className={`menu-toggle${menuOpen ? " is-open" : ""}`} type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <span /><span />
        </button>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-topline"><span className="eyebrow-mark"><i /> COURSE PLANNING, IN CLEAR VIEW</span><span className="hero-audience">Made for the curious, not the portal experts.</span></div>
          <div className="hero-stage">
            <div className="hero-main-copy">
              <h1>Make your degree<br /><span>make sense.</span></h1>
              <div className="hero-description">
                <p>Know what to take, what it unlocks, and where you’re headed. Course planning, without the guesswork.</p>
                <div className="hero-actions">
                  <a className="button button-dark" href="#course-map">Map your next semester <ArrowRight size={16} /></a>
                  <a className="text-link" href="#how-it-works">See how it works <ArrowUpRight size={15} /></a>
                </div>
              </div>
            </div>
            <div className="hero-product-column">
              <div className="product-frame hero-window-shell" id="course-map">
                <CourseNetwork variant="hero" />
                <div className="hero-window-shade" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section className="problem-section" id="why-radar">
          <div className="section-inner">
            <Reveal className="problem-heading">
              <div className="section-label"><span>THE OLD WAY, UNMAPPED</span><span>01 — 03</span></div>
              <div className="problem-title-row"><h2>Planning your degree<br />shouldn’t feel like <span>detective work.</span></h2><p>Your degree requirements are a path. They just shouldn’t take five tabs, a spreadsheet, and a lucky guess to find.</p></div>
            </Reveal>
            <div className="benefit-grid">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <Reveal className="benefit-card" delay={index * 75} key={benefit.number}>
                    <div className="benefit-top"><span className="benefit-icon"><Icon size={17} strokeWidth={1.7} /></span><span>{benefit.number}</span></div>
                    <h3>{benefit.title}</h3>
                    <p>{benefit.body}</p>
                    <div className="benefit-foot"><span className="benefit-foot-line" /><span>{benefit.note}</span></div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="workflow-section" id="how-it-works">
          <div className="section-inner">
            <Reveal className="workflow-heading">
              <div><div className="section-label"><span>A CLEARER WAY THROUGH</span><span>02 — 03</span></div><h2>Less decoding.<br /><span>More direction.</span></h2></div>
              <p>Big picture when you need it. The next step when you don’t. Your academic path, made legible from the start.</p>
            </Reveal>
            <div className="workflow-grid">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Reveal className="workflow-card" delay={index * 80} key={step.number}>
                    <div className="workflow-visual" aria-hidden="true"><span className="visual-index">{step.number} / 03</span>{step.visual}<span className="visual-orbit"><Icon size={14} strokeWidth={1.6} /></span></div>
                    <div className="workflow-card-copy"><span className="step-number">{step.number}</span><h3>{step.title}</h3><p>{step.body}</p></div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="clarity-section">
          <Reveal className="clarity-inner">
            <div className="clarity-orbit" aria-hidden="true"><span /><span /><span /><i /></div>
            <div className="clarity-copy"><div className="section-label"><span>YOUR PLAN, IN CONTEXT</span><span>03 — 03</span></div><h2>Not another portal.<br /><span>A clearer point of view.</span></h2><p>Course Radar brings your course catalog, prerequisite map, and academic plan into one thoughtful workspace—so the next move feels obvious.</p><a className="text-link" href="#course-map">Explore the course map <ArrowRight size={15} /></a></div>
            <div className="clarity-stats"><div><strong>01</strong><span>connected course map</span></div><div><strong>∞</strong><span>ways to plan ahead</span></div><div><strong>0</strong><span>mystery prerequisites</span></div></div>
          </Reveal>
        </section>

        <section className="closing-section">
          <Reveal className="closing-inner">
            <div className="closing-kicker"><Sparkles size={14} strokeWidth={1.7} /> YOUR NEXT SEMESTER, CLEARER</div>
            <h2>Find your way<br /><span>forward.</span></h2>
            <p>See the path. Understand the prerequisites. Make a plan that feels like yours.</p>
            <a className="button button-dark closing-cta" href="#course-map">Start planning with Course Radar <ArrowUpRight size={16} /></a>
            <div className="closing-foot"><span>Clarity, course by course.</span><span>Made for students building what’s next.</span></div>
          </Reveal>
        </section>
      </main>

      <footer className="site-footer">
        <a className="wordmark footer-wordmark" href="#top"><RadarMark small /><span>Course<span className="wordmark-light">Radar</span></span></a>
        <span className="footer-note">Make your degree make sense.</span>
        <div className="footer-links"><a href="#how-it-works">How it works</a><a href="#course-map">Explore the map</a><span>© 2026 Course Radar</span></div>
      </footer>
    </div>
  );
}
