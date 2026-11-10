import { useCatalog } from "./CatalogContext";

export function useChatPrompts() {
  const { catalog, takenCourseIds } = useCatalog();
  const code = catalog.courses.find(course => !takenCourseIds.has(course.id))?.code ?? "a course";
  return [`Open ${code}`, `Add ${code} to my current semester`, `Remove ${code} from my plan`];
}
