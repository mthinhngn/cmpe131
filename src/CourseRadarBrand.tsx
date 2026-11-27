import "./course-radar-brand.css";

/** The landing-page wordmark is the single source for every product header. */
export function CourseRadarBrand() {
  return <a className="cr-header-brand" href="/" aria-label="Course Radar home">
    <span className="cr-header-brand-mark" aria-hidden="true"><span className="cr-header-brand-beam" /><span className="cr-header-brand-blip" /></span>
    <span className="cr-header-brand-name">Course<span className="cr-header-brand-light">Radar</span></span>
  </a>;
}
