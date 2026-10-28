import "./product-context.css";

/** Shared context geometry, taken from Course Explorer. Data stays owned by each page. */
export function ProductContextBar({ page, edition, program, onProgramChange, degree = "Computer Science — B.S." }: {
  page: string;
  edition: string;
  program?: string;
  onProgramChange?: (program: string) => void;
  degree?: string;
}) {
  return <div className="cr-context-bar" aria-label={`${page} workspace context`}>
    <div className="cr-context-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{page}</strong></div>
    <div className="cr-context-details"><div className="cr-context-degree"><i className="cr-context-dot" aria-hidden="true" /><span>Degree</span>{program !== undefined && onProgramChange ? <select aria-label="Degree program" value={program} onChange={event => onProgramChange(event.target.value)}><option value="computer-engineering">Computer Engineering — BS</option><option value="software-engineering">Software Engineering — BS</option></select> : <span className="cr-context-degree-value">{degree}</span>}</div><span className="cr-context-edition">{edition}</span></div>
  </div>;
}
