import type { CSSProperties } from "react";

export function scheduleCourseColors(codes: string[], previewCode?: string): Map<string, CSSProperties> {
  const courses = [...new Set(codes)].sort();
  // Append previews so comparing a new course never recolors the saved week.
  if (previewCode && !courses.includes(previewCode)) courses.push(previewCode);
  return new Map(courses.map((code, index) => {
    const hue = (210 + index * 137.508) % 360;
    return [code, {
      "--course-fill": `hsl(${hue} 72% 88%)`,
      "--course-ink": `hsl(${hue} 48% 24%)`,
      "--course-edge": `hsl(${hue} 55% 48%)`,
    } as CSSProperties];
  }));
}
