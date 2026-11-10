import "./static-preview";
import "./field-focus.css";

// Separate document entries keep workspace CSS out of the supplied landing.
const pageUrl = new URL(window.location.href);
const pagePath = pageUrl.pathname.replace(/\/$/, "");
const legacyPages: Record<string, string> = {
  "/courses": "/schedule",
  "/prerequisites": "/roadmap",
  "/prerequisitite": "/roadmap",
  "/prerequisite-chart": "/roadmap",
  "/catalog-prerequisites": "/roadmap",
};
// Canonicalize before choosing a document entry, retaining saved query filters and anchors.
if (legacyPages[pagePath] || ["/roadmap", "/schedule"].includes(pagePath)) {
  pageUrl.pathname = legacyPages[pagePath] || pagePath;
  if (pageUrl.pathname === "/roadmap" && pageUrl.searchParams.get("v") === "t2a") pageUrl.searchParams.delete("v");
  window.history.replaceState(window.history.state, "", pageUrl);
}
if (window.location.pathname.replace(/\/$/, "") === "/account") {
  void import("./account-entry");
} else if (window.location.pathname === "/" || window.location.pathname === "/index.html") {
  void import("./landing-entry");
} else if (window.location.pathname.replace(/\/$/, "") === "/embed/course-map" && new URLSearchParams(location.search).get("preview") === "glide") {
  void import("./landing-preview-entry");
} else if (["/overview", "/overview/", "/roadmap", "/embed/course-map", "/embed/course-map/"].includes(window.location.pathname)) {
  void import("./reference-entry");
} else {
  void import("./workspace-entry");
}
export {};
