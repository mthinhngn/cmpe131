export const staticPreview = import.meta.env.VITE_STATIC_PREVIEW === "1";

if (staticPreview) {
  // Keep the approved styling and automatic motion while making the preview read-only.
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  for (const type of ["click", "dblclick", "auxclick", "pointerdown", "submit", "beforeinput", "change", "dragstart"]) {
    window.addEventListener(type, stop, { capture: true, passive: false });
  }
  window.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || ["Tab", "Escape"].includes(event.key)) return;
    const control = event.target instanceof Element && event.target.closest("button, a, input, select, textarea, [role=button], [role=tab]");
    if (control || !["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(event.key)) stop(event);
  }, true);
  const markControls = () => {
    document.querySelectorAll("button, a, input, select, textarea, [role=button], [role=tab]").forEach(element => element.setAttribute("aria-disabled", "true"));
    document.querySelectorAll("iframe").forEach(frame => { frame.style.pointerEvents = "none"; frame.tabIndex = -1; });
  };
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node instanceof Element))) markControls();
  }).observe(document.documentElement, { childList: true, subtree: true });
  markControls();
}
