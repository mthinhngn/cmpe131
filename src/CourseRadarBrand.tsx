import "./course-radar-brand.css";

/** The landing-page wordmark is the single source for every product header. */
export function CourseRadarBrand() {
  return <a className="cr-header-brand" href="/" aria-label="Course Radar home">
    <svg className="cr-header-brand-mark" width="27" height="27" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="13.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18" r="7.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M18 18 28.4 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="28.5" cy="7.4" r="3.1" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="currentColor" />
    </svg>
    <span className="cr-header-brand-name">Course<span className="cr-header-brand-light">Radar</span></span>
  </a>;
}
