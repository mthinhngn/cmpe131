import type { ProgramCatalog } from "./course-types";

// An empty program key represents a guest who has not selected a degree yet.
export function emptyCatalog(): ProgramCatalog {
  return {
    name: "", abbreviation: "", catalogYear: "", dataVersion: "unselected",
    dataStatus: "draft-unverified", lastVerifiedAt: "", sourceUrl: "", programUrl: "",
    currentTerm: { id: "fall-2026", name: "Fall 2026", sourceUrl: "", fetchedAt: "" },
    selectedPrograms: [], requirementEvidence: [], roadmapCourseIds: [],
    courses: [], offerings: [], requirementGroups: [],
  };
}
