export type Course = {
  id: string;
  code: string;
  title: string;
  units: number;
  description: string;
  recommendedSemester: number;
  prerequisiteCourseIds: string[];
  corequisiteCourseIds: string[];
  prerequisiteText?: string;
  sourceUrl: string;
};

export type CourseOffering = {
  instructors: string[];
  courseCode: string;
  sectionNumber: string;
  classNumber: string;
  mode: string;
  component: string;
  days: string;
  times: string;
  location: string;
  dates: string;
  openSeats: number;
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
  name: "Computer Engineering" | "Software Engineering";
  abbreviation: "BSCMPE" | "BSSE";
  catalogYear: string;
  dataVersion: string;
  dataStatus: "draft-unverified" | "reviewed";
  lastVerifiedAt: string;
  sourceUrl: string;
  programUrl: string;
  currentTerm: {
    id: string;
    name: string;
    sourceUrl: string;
    fetchedAt: string;
  };
  offerings: CourseOffering[];
  courses: Course[];
  requirementGroups: RequirementGroup[];
};
