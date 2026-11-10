import markup from "./main-landing.html?raw";
import "./main-landing.css";
import { productNavigation } from "./product-navigation";

// The selected map-b landing has its own document styles, just like the
// reference and workspace entries. No workspace CSS is loaded into this page.
document.title = "CourseRadar · Less decoding, more direction";
document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#f4f4f2");
document.documentElement.classList.add("js");
document.getElementById("root")!.innerHTML = markup;
for (const id of ["product-navigation", "footer-navigation"]) {
  document.getElementById(id)!.replaceChildren(...productNavigation.map(({ to, label }) => {
    const link = document.createElement("a");
    link.href = to;
    link.textContent = label;
    return link;
  }));
}

const map = document.querySelector<HTMLIFrameElement>("#map")!;
const hero = document.querySelector<HTMLElement>(".hero")!;
const media = document.querySelector<HTMLElement>(".media")!;
// Preserve the original landing frame's viewport, scaling and position.
function fitMap() {
  if (innerWidth > 960) {
    const width = media.clientWidth + 48;
    const heroStyle = getComputedStyle(hero);
    const available = innerHeight - document.querySelector("header")!.getBoundingClientRect().height
      - parseFloat(heroStyle.paddingTop) - document.querySelector<HTMLElement>(".tabbar")!.offsetHeight - 26 - 24;
    const scale = Math.max(0.5, Math.min(1, width / 960, available / (650 - 96)));
    map.style.width = `${Math.max(960, Math.ceil(width / scale))}px`;
    map.style.height = "650px";
    map.style.setProperty("zoom", String(scale));
    hero.style.setProperty("--hero-copy-offset", `${((650 - 96) * scale - media.offsetHeight) / 2}px`);
  } else {
    map.style.removeProperty("width");
    map.style.removeProperty("height");
    map.style.removeProperty("zoom");
    hero.style.removeProperty("--hero-copy-offset");
  }
  stick();
}
const tabs = [...document.querySelectorAll<HTMLButtonElement>(".tab")];
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => map.contentWindow?.postMessage({ type: "course-radar-showcase-select", page: tab.dataset.page }, location.origin));
  tab.addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    next.focus(); next.click();
  });
});
let landed = false;
function land() {
  if (landed) return;
  landed = true;
  document.documentElement.classList.add("landed");
}
function stick() {
  hero.style.setProperty("--stick", `${Math.min(0, innerHeight - hero.offsetHeight)}px`);
}
addEventListener("message", event => {
  if (event.origin !== location.origin || event.source !== map.contentWindow) return;
  if (event.data?.type === "course-radar-showcase-ready") land();
  if (event.data?.type === "course-radar-showcase-page") {
    tabs.forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.page === event.data.page)));
  }
  if (event.data?.type !== "course-radar-map-height") return;
  const height = event.data.height;
  if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) return;
  if (innerWidth <= 960 && map.style.height !== `${height}px`) {
    map.style.height = `${height}px`;
    stick();
  }
});
addEventListener("resize", fitMap);
fitMap();

const links = [...document.querySelectorAll<HTMLAnchorElement>(".toc li a")];
const spy = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) links.forEach(link => link.classList.toggle("on", link.hash === `#${entry.target.id}`));
}), { rootMargin: "-35% 0px -60% 0px" });
document.querySelectorAll(".part").forEach(part => spy.observe(part));

void document.fonts.ready.then(fitMap);

const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  entry.target.classList.add("in");
  reveal.unobserve(entry.target);
}), { rootMargin: "0px 0px -12% 0px" });
document.querySelectorAll(".rv").forEach(element => reveal.observe(element));
