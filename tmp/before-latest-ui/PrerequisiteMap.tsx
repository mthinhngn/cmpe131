import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import CourseNetwork from "./LandingCourseNetwork";
import { RadarMark } from "./ReferenceLanding";
import "./prerequisite-map.css";

// The landing's chart and stylesheet remain the sole visual implementation.
export default function PrerequisiteMap() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { document.title = "Prerequisite Map · Course Radar"; }, []);

  return <div className="site-shell prereq-shell" id="top">
    <a className="prereq-skip" href="#course-map">Skip to prerequisite map</a>
    <header className="site-header">
      <a className="wordmark" href="/" aria-label="Course Radar home"><RadarMark /><span>Course<span className="wordmark-light">Radar</span></span></a>
      <nav className={`primary-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
        <a href="/">Home</a>
        <a href="/prerequisite-chart" aria-current="page" onClick={() => setMenuOpen(false)}>Prerequisite map</a>
        <a href="/courses">Course explorer</a>
      </nav>
      <div className="header-actions"><a className="button button-dark header-cta" href="/planner">Semester planner <ArrowUpRight size={15} /></a></div>
      <button className={`menu-toggle${menuOpen ? " is-open" : ""}`} type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}><span /><span /></button>
    </header>
    <main className="prereq-full-page">
      <header className="prereq-heading"><h1>Prerequisite map</h1></header>
      <section className="prereq-map-frame" id="course-map" aria-label="Interactive prerequisite map">
        <div className="prereq-frame-label"><span className="prereq-live-dot" aria-hidden="true" />INTERACTIVE DEGREE PLAN<span className="prereq-frame-program">COMPUTER SCIENCE · B.S.</span></div>
        <CourseNetwork variant="hero" density="compact" showAvatar={false} />
      </section>
      <div className="prereq-map-caption"><span>The interactive example from our home page · 8 courses · 30 credits.</span><a href="/catalog-prerequisites">Use your SJSU program’s recorded requirements <ArrowUpRight size={13} /></a></div>
      <section className="prereq-guidance" id="how-it-works" aria-label="Using the prerequisite map">
        <div><h2>Follow the connections.</h2><p>Hover or focus a course to trace its immediate prerequisites and the courses it unlocks. Select it to keep its requirements in view.</p></div>
        <div><h2>Keep the plan in context.</h2><p>This is an illustrative degree plan. For Computer Engineering or Software Engineering, open the SJSU catalog map to inspect official sources and update your session plan.</p></div>
      </section>
    </main>
    <footer className="site-footer"><a className="wordmark footer-wordmark" href="/"><RadarMark small /><span>Course<span className="wordmark-light">Radar</span></span></a><span className="footer-note">Clarity, course by course.</span><div className="footer-links"><a href="/courses">Course explorer</a><a href="/planner">Semester planner</a></div></footer>
  </div>;
}
