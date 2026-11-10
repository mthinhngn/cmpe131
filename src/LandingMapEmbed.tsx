import { lazy, Suspense, useEffect, useRef } from "react";
const CourseNetwork = lazy(() => import("./LandingCourseNetwork"));
import "./landing-hero.css";

// Frames the active Home preview and shared course map.
// `?fade=<hex>` matches the right-edge shade to the host page background.
function GlidePreview() {
  const viewport = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const fit = () => {
      if (!viewport.current || !frame.current) return;
      frame.current.style.transform = `scale(${viewport.current.clientWidth / 980}, ${viewport.current.clientHeight / 560})`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(viewport.current!);
    const bridge = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      if (event.source === parent && event.data?.type === "course-radar-showcase-select") {
        frame.current?.contentWindow?.postMessage(event.data, location.origin);
      } else if (event.source === frame.current?.contentWindow && (event.data?.type === "course-radar-showcase-page" || event.data?.type === "course-radar-showcase-ready")) {
        parent.postMessage(event.data, location.origin);
      }
    };
    addEventListener("message", bridge);
    return () => { observer.disconnect(); removeEventListener("message", bridge); };
  }, []);
  return <div ref={viewport} style={{ position: "relative", height: "100%", minHeight: 0, overflow: "hidden", borderRadius: 6 }}>
    <iframe ref={frame} src="/showcase/index.html?embedded=1" title="Illustrative looping product preview" style={{ display: "block", width: 980, height: 560, border: 0, transformOrigin: "top left" }} />
  </div>;
}

export default function LandingMapEmbed() {
  const fade = `#${(new URLSearchParams(location.search).get("fade") ?? "f4f4f4").replace(/[^0-9a-f]/gi, "").slice(0, 6) || "f4f4f4"}`;

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const post = () => window.parent.postMessage({ type: "course-radar-map-height", height: document.querySelector(".landing-map-embed")!.getBoundingClientRect().height }, location.origin);
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    post();
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-home landing-map-embed" style={{ padding: "24px 0 72px 48px" }}>
      <div className="hero-product-column">
        <div className="product-frame hero-window-shell" id="course-map">
          {new URLSearchParams(location.search).get("preview") === "glide" ? <GlidePreview /> : <Suspense fallback={null}><CourseNetwork variant="hero" /></Suspense>}
          <div className="hero-window-shade" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${fade}00, ${fade}52 40%, ${fade}d9 78%, ${fade})` }} />
        </div>
      </div>
    </div>
  );
}
