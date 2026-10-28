import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import CourseNetwork from "./LandingCourseNetwork";

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal${visible ? " is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function RadarMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={`radar-mark${small ? " radar-mark-small" : ""}`}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="18" cy="18" r="13.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18" r="7.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M18 18 28.4 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="28.5" cy="7.4" r="3.1" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

export default function Prerequisites() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="site-shell prereq-shell" id="top">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Course Radar home">
          <RadarMark />
          <span>
            Course<span className="wordmark-light">Radar</span>
          </span>
        </a>
        <nav className={`primary-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation"><a href="/overview" onClick={() => setMenuOpen(false)}>Overview</a><a href="/prerequisites" onClick={() => setMenuOpen(false)}>Prerequisites</a></nav>
        <div className="header-actions">
          <a className="button button-dark header-cta" href="#map-workspace">
            Open map <ArrowUpRight size={15} />
          </a>
        </div>
        <button
          className={`menu-toggle${menuOpen ? " is-open" : ""}`}
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </header>

      <main>
        <section className="prereq-full-page" id="map-workspace">
          <div className="prereq-full-page-topline">
            <a className="back-link" href="/overview">Back to overview</a>
            <span className="section-label-inline">
              <i /> PREREQUISITE MAP / FULL VIEW
            </span>
          </div>
          <Reveal className="prereq-full-map-heading">
            <div className="prereq-full-map-title">
              <div className="section-label">
                <span>YOUR COURSE MAP</span>
                <span>01 — 01</span>
              </div>
              <h1>
                Plan from <span>the whole picture.</span>
              </h1>
            </div>
          </Reveal>
          <Reveal className="prereq-map-frame" delay={90}>
            <div className="prereq-map-frame-topline">
              <span className="map-live-dot" />
              <span>INTERACTIVE DEGREE PLAN</span>
              <span className="map-frame-caption">COMPUTER SCIENCE · B.S.</span>
            </div>
            <div className="prereq-product-frame">
              <CourseNetwork density="compact" />
            </div>
            <div className="prereq-map-frame-footer">
              <span>Illustrative map · Open a course to inspect dependencies.</span>
              <span><a href="/prerequisites#map-workspace">Return to map</a></span>
            </div>
          </Reveal>
        </section>
      </main>
    </div>
  );
}
