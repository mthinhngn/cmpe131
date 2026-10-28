// Separate document entries keep workspace CSS out of the supplied landing.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("profile")) {
  await import("../scripts/performance/browser");
}
if (["/", "/overview", "/overview/", "/prerequisites", "/prerequisites/", "/prerequisite-chart", "/prerequisite-chart/"].includes(window.location.pathname)) {
  void import("./reference-entry");
} else {
  void import("./workspace-entry");
}
export {};
