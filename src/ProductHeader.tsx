import { CourseRadarBrand } from "./CourseRadarBrand";
import { productNavigation } from "./product-navigation";
import "./product-header.css";

/** One navigation treatment for every connected product screen. */
export function ProductHeader({ activePath }: { activePath: string }) {
  return <header className="cr-product-header">
    <CourseRadarBrand />
    <nav aria-label="Product navigation">
      {productNavigation.map(({ to, label }) => <a key={to} href={to} aria-current={to === activePath ? "page" : undefined}>{label}</a>)}
    </nav>
    <a className="cr-product-account" href="/account" aria-current={activePath === "/account" ? "page" : undefined}>Account</a>
  </header>;
}
