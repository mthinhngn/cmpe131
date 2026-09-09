export type Course = {
  id: string;
  code: string;
  title: string;
  units: number;
  description: string;
  recommendedSemester: number;
  prerequisiteCourseIds: string[];
  sourceUrl: string;
};

export type RequirementItem = {
  id: string;
  type: "course" | "placeholder";
  courseId?: string;
  label?: string;
  description?: string;
  recommendedSemester?: number;
};

export type RequirementGroup = {
  id: string;
  title: string;
  description: string;
  items: RequirementItem[];
};

export type ProgramCatalog = {
  name: "Computer Engineering";
  abbreviation: "BSCMPE";
  catalogYear: string;
  dataVersion: string;
  dataStatus: "draft-unverified" | "reviewed";
  sourceUrl: string;
  programUrl: string;
  courses: Course[];
  requirementGroups: RequirementGroup[];
};
