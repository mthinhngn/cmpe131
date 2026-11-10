export type Course = {
  plannerCategory?: import("../api/src/course-category").CourseCategory;
  id: string;
  code: string;
  title: string;
  units: number;
  unitsText?: string;
  description: string;
  recommendedSemester: number;
  prerequisiteCourseIds: string[];
  prerequisiteOptionCourseIds?: string[];
  corequisiteCourseIds: string[];
  corequisiteOptionCourseIds?: string[];
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
  seatsKnown?: boolean;
  scheduleReview?: boolean;
  notes?: string;
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
  name: string;
  abbreviation: string;
  sequenceKind?: "official" | "draft";
  selectedPrograms?: { slug: string; title: string; kind: string; sourceUrl: string }[];
  requirementEvidence?: { program: string; title: string; text: string; units: number; choice: boolean; courses: { code: string; title: string; units: number }[] }[];
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
  availableTerms?: string[];
  roadmapCourseIds?: string[];
  offerings: CourseOffering[];
  courses: Course[];
  requirementGroups: RequirementGroup[];
};
