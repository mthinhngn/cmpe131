import { ScheduleProvider } from "./ScheduleContext";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { ChatWidget } from "./ChatWidget";
import { PageLoading } from "./PageLoading";
import { PageReady } from "./PageReady";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { CatalogProvider } from "./CatalogContext";
import "./reference-landing.css";
import "./overview-bento.css";

import "./product-navigation.css";
import "./product-layout.css";
import "./product-typography.css";
// The exact font families and weights requested by the ZIP's client/index.html.
for (const href of [
  "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap",
]) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
const pathname = window.location.pathname.replace(/\/$/, "") || "/";
const embed = pathname === "/embed/course-map";
// Start loading just this screen while identity and saved-state requests run.
const pageModule = embed ? import("./LandingMapEmbed") : pathname === "/overview" ? import("./ReferenceOverview") : import("./PrerequisiteMap");
const Page = lazy(() => pageModule);
document.title = `${embed ? "Course map" : pathname === "/overview" ? "Overview" : "Roadmap"} · Course Radar`;
const preview = embed && new URLSearchParams(location.search).get("preview") === "glide";
// The illustrative landing movie has no account or saved-workspace loading lifecycle.
const content = preview ? <StrictMode><Suspense fallback={null}><Page /></Suspense></StrictMode> : (<StrictMode><AuthProvider><CatalogProvider><BrowserRouter><ScheduleProvider><Suspense fallback={<PageLoading />}><PageReady><Page /></PageReady></Suspense>{pathname !== "/" && !embed && <ChatWidget />}</ScheduleProvider></BrowserRouter></CatalogProvider></AuthProvider></StrictMode>);
createRoot(document.getElementById("root")!).render(content);


import "./product-surfaces.css";
