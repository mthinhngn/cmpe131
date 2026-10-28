// Separate document entries keep workspace CSS out of the supplied landing.
if (["/", "/prerequisites", "/prerequisites/", "/prerequisite-chart", "/prerequisite-chart/"].includes(window.location.pathname)) {
  void import("./reference-entry");
} else {
  void import("./workspace-entry");
}
export {};
