import { productNavigation } from "./product-navigation";
import { CourseRadarBrand } from "./CourseRadarBrand";
import { ProductContextBar } from "./ProductContextBar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import CourseNetwork from "./LandingCourseNetwork";
import { useCatalog } from "./CatalogContext";

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

export default function Prerequisites() {
  const { catalog, program, selectProgram, mode, retry } = useCatalog();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="site-shell prereq-shell" id="top">
      <header className="site-header">
        <CourseRadarBrand />
        <nav className={`primary-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">{productNavigation.map(item => <a key={item.to} href={item.to} aria-current={item.to === "/prerequisites" ? "page" : undefined} onClick={() => setMenuOpen(false)}>{item.label}</a>)}</nav>
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

      <ProductContextBar page="Roadmap" edition={catalog.currentTerm.name} program={program} onProgramChange={selectProgram} />
      <main>
        <section className="prereq-full-page" id="map-workspace">
          <Reveal className="prereq-full-map-heading">
            <div className="prereq-full-map-title">
              <h1>
                See every <span>semester connect.</span>
              </h1>
            </div>
          </Reveal>
          <Reveal className="prereq-map-frame" delay={90}>
            <div className="prereq-map-frame-topline">
              <span className="map-live-dot" />
              <span>EIGHT-SEMESTER COURSE MAP</span>
              <span className="map-frame-caption">{catalog.name.toUpperCase()} · B.S. · YEARS 1–4</span>
            </div>
            <div className="prereq-product-frame">
              <CourseNetwork key={program} density="compact" source="computer-engineering-plan" />
            </div>
            <div className="prereq-map-frame-footer">
              <span>All eight semesters from the {catalog.name} roadmap · Select a course to inspect recorded requirements.</span>
              <span role="status">{mode === "database" ? "Database catalog" : mode === "loading" ? "Connecting to catalog…" : <>Reviewed local snapshot · <button type="button" onClick={retry}>Retry connection</button></>} · <a href="/roadmap">Open semester details</a></span>
            </div>
          </Reveal>
        </section>
      </main>
    </div>
  );
}

