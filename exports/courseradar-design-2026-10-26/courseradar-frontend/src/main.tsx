import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "./ReferenceLanding";
import Overview from "./ReferenceOverview";
import PrerequisiteMap from "./PrerequisiteMap";
import "./reference-landing.css";
import "./reference-overview.css";

// The exact font families and weights requested by the ZIP's client/index.html.
for (const href of [
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
  "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap",
]) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
const pathname = window.location.pathname.replace(/\/$/, "") || "/";
const Page = pathname === "/" ? Home : pathname === "/overview" ? Overview : PrerequisiteMap;
document.title = `${pathname === "/" ? "Home" : pathname === "/overview" ? "Overview" : "Prerequisite Map"} · Course Radar`;
createRoot(document.getElementById("root")!).render(<StrictMode><Page /></StrictMode>);
