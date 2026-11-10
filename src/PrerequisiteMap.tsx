import { ProductPageHeading } from "./ProductPageHeading";
import { ProductHeader } from "./ProductHeader";
import { useEffect, useRef, useState, type ReactNode } from "react";
import CourseNetwork from "./LandingCourseNetwork";
import { useCatalog } from "./CatalogContext";

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal${visible ? " is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Prerequisites() {
  const { catalog, program } = useCatalog();

  return (
    <div className="site-shell prereq-shell is-stepper" id="top" >
      <ProductHeader activePath="/roadmap" />

      <main>
        <section className="prereq-full-page" id="map-workspace">
          <ProductPageHeading title="Roadmap" />
          <Reveal className="prereq-map-frame" delay={90}>
            <div className="prereq-map-frame-topline">
              <span className="map-live-dot" />
              <span>{catalog.requirementGroups.length}-SEMESTER COURSE MAP</span>
              <span className="map-frame-caption">{catalog.name.toUpperCase()} · {catalog.catalogYear}</span>
            </div>
            <div className="prereq-product-frame">
              <CourseNetwork key={`${program}:${catalog.dataVersion}`} density="compact" source="computer-engineering-plan" stepper />
            </div>
          </Reveal>
        </section>
      </main>

    </div>
  );
}

