import "./page-loading.css";

export function PageLoading({ detail = "Loading this page", ready = false, leaving = false }: { detail?: string; ready?: boolean; leaving?: boolean }) {
  return <div className="cr-page-loading" data-ready={ready} data-leaving={leaving} aria-busy={!ready}>
    <div className="cr-loading-pill" role="status" aria-live="polite">
      <span className="cr-loading-ring" aria-hidden="true">{ready && <svg viewBox="0 0 24 24" fill="none"><path d="m7 12 3.5 3.5L17 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
      <div className="cr-loading-copy"><strong>{ready ? "Workspace ready" : "Loading your workspace"}</strong><span>{detail}</span></div>
    </div>
  </div>;
}
