import type { CSSProperties } from "react";
import { courseCategory, type CourseCategory } from "../api/src/course-category.ts";

export type CourseSubject = CourseCategory;

export function courseSubject(code: string, inRoadmap = true, program = "computer-engineering"): CourseSubject {
  return courseCategory(code, inRoadmap, program);
}

export function subjectTone(code: string, inRoadmap = true, program = "computer-engineering"): CSSProperties {
  const subject = courseSubject(code, inRoadmap, program);
  return { "--c": `var(--s-${subject})`, "--c-ink": subject === "writing" ? "#fff" : "#000" } as CSSProperties;
}
