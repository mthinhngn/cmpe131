export type PrerequisiteCourse = {
  courseId: string;
  courseCode: string;
  rules: Array<{
    groupKey: string;
    operator: "AND" | "OR";
    minimumGrade: string | null;
    isCorequisite: boolean;
    requiresManualReview: boolean;
    requiredCourse: { id: string; code: string };
  }>;
};

export function evaluatePrerequisiteWarnings(courses: PrerequisiteCourse[], completedCourseIds: string[], sameTermCourseIds: string[]) {
  const completed = new Set(completedCourseIds);
  const sameTerm = new Set(sameTermCourseIds);
  const warnings: string[] = [];
  for (const course of courses) {
    const groups = new Map<string, PrerequisiteCourse["rules"]>();
    for (const rule of course.rules) groups.set(rule.groupKey, [...(groups.get(rule.groupKey) ?? []), rule]);
    for (const rules of groups.values()) {
      const satisfied = (rule: PrerequisiteCourse["rules"][number]) => completed.has(rule.requiredCourse.id)
        || (rule.isCorequisite && sameTerm.has(rule.requiredCourse.id));
      const groupSatisfied = rules[0]?.operator === "OR" ? rules.some(satisfied) : rules.every(satisfied);
      if (!groupSatisfied) warnings.push(`${course.courseCode}: prerequisite group ${rules[0]?.groupKey ?? "default"} is not satisfied by completed courses${rules.some((rule) => rule.isCorequisite) ? " or explicit same-term corequisites" : ""}.`);
      for (const rule of rules) {
        if (rule.minimumGrade) warnings.push(`${course.courseCode}: ${rule.requiredCourse.code} requires minimum grade ${rule.minimumGrade}; grades are not verified.`);
        if (rule.requiresManualReview) warnings.push(`${course.courseCode}: ${rule.requiredCourse.code} requires manual prerequisite review.`);
      }
    }
  }
  return [...new Set(warnings)];
}
