export type Availability = "open" | "closed" | "waitlist" | "unknown";

export type Meeting = {
  days: string[];
  startTime: string | null;
  endTime: string | null;
  location: string | null;
};

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

export type Section = {
  id: string;
  courseId: string;
  term: "Fall 2026";
  sectionNumber: string;
  instructor: string | null;
  meetings: Meeting[];
  availability: Availability;
  openSeats: number | null;
  sourceUrl: string;
};

export type StudentPlan = {
  schemaVersion: 1;
  major: string;
  catalog: string;
  completedCourseIds: string[];
  selectedSectionIds: string[];
  updatedAt: string;
};

export type PrerequisiteResult = {
  courseId: string;
  status: "met" | "unmet";
  missingCourseIds: string[];
};

export type ScheduleConflict = {
  firstSectionId: string;
  secondSectionId: string;
  day: string;
};
