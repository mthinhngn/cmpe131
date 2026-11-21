import type { CSSProperties } from "react";
import { courseCategory, type CourseCategory } from "../api/src/course-category.ts";

export type CourseSubject = CourseCategory;

export function courseSubject(code: string, inRoadmap = true): CourseSubject {
  return courseCategory(code, inRoadmap);
}

export function subjectTone(code: string, inRoadmap = true): CSSProperties {
  const subject = courseSubject(code, inRoadmap);
  return { "--c": `var(--s-${subject})`, "--c-ink": subject === "writing" ? "#fff" : "#000" } as CSSProperties;
}
