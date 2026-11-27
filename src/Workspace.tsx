import { ProductHeader } from "./ProductHeader";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useCatalog } from "./CatalogContext";
import "./workspace.css";
import "./editorial.css";
import "./explorer.css";
import "./roadmap-detail.css";
import "./roadmap-palette.css";
import "./explorer-schedule.css";
import "./course-inspector.css";
import "./schedule-graphite.css";


export function Workspace() {
  const { program, mode, retry } = useCatalog();
  const location = useLocation();
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { content.current?.focus(); window.scrollTo(0, 0); }, [location.pathname]);
  return <div className={`workspace ${["/overview", "/catalog-overview"].includes(location.pathname) ? "workspace-overview" : ""} ${location.pathname === "/schedule" ? "workspace-explorer" : ""}`}>
    <a className="skip-link" href="#workspace-content">Skip to content</a>
    <ProductHeader activePath={location.pathname} />
    <div className="workspace-body">
      {location.pathname !== "/schedule" && mode !== "database" && <div className={`data-message ${mode}`} role="status">{mode === "loading" ? "Checking for the latest catalog…" : <>Showing a saved catalog snapshot. <button onClick={retry}>Retry connection</button></>}</div>}
      <div id="workspace-content" className="workspace-content" ref={content} tabIndex={-1}><Outlet key={program} /></div>
    </div>
  </div>;
}
