import type { ReactNode } from "react";
import { useCatalog } from "./CatalogContext";

export function ProductPageHeading({ title, children }: { title: string; children?: ReactNode }) {
  const { catalog } = useCatalog();
  return <header className="cr-page-heading"><h1>{title} <span>&middot; {catalog.name}</span></h1>{children}</header>;
}
