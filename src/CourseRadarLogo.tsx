export function CourseRadarLogo() {
  return <span className="course-radar-logo" aria-hidden="true">
    <svg className="course-radar-mark" viewBox="0 0 90 78" role="img">
      <path className="logo-connector" d="M28 24v15h32v15" />
      <path className="logo-arrow" d="m56 50 4 4-4 4" />
      <rect className="logo-course logo-course-start" x="7" y="8" width="42" height="22" rx="2" />
      <rect className="logo-course logo-course-focus" x="41" y="48" width="42" height="22" rx="2" />
      <path className="logo-copy-lines" d="M14 16h18M14 21h10M48 56h20M48 61h13" />
      <circle className="logo-node logo-node-start" cx="42" cy="19" r="3" />
      <circle className="logo-node logo-node-open" cx="76" cy="59" r="3" />
    </svg>
    <span className="course-radar-wordmark">
      <strong>Course<span>Radar</span></strong>
      <small>Plan with clarity</small>
    </span>
  </span>;
}
