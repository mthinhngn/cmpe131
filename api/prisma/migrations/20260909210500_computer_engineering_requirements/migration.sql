-- Remove scheduling tables from the graduation-requirements-only scope.
DROP TABLE "Meeting";
DROP TABLE "Section";
DROP TABLE "Instructor";
DROP TABLE "Term";
DROP TABLE "RoadmapItem";
DROP TYPE "Availability";

ALTER TABLE "CourseVersion" ADD COLUMN "prerequisiteText" TEXT;

CREATE TYPE "RequirementItemType" AS ENUM ('COURSE', 'PLACEHOLDER');

CREATE TABLE "RequirementGroup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "catalogVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "RequirementGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramRequirement" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "requirementGroupId" TEXT NOT NULL,
    "itemType" "RequirementItemType" NOT NULL,
    "courseVersionId" TEXT,
    "label" TEXT,
    "description" TEXT,
    "recommendedSemester" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "ProgramRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequirementGroup_catalogVersionId_sortOrder_key" ON "RequirementGroup"("catalogVersionId", "sortOrder");
CREATE UNIQUE INDEX "RequirementGroup_catalogVersionId_key_key" ON "RequirementGroup"("catalogVersionId", "key");
CREATE UNIQUE INDEX "ProgramRequirement_requirementGroupId_sortOrder_key" ON "ProgramRequirement"("requirementGroupId", "sortOrder");
CREATE UNIQUE INDEX "ProgramRequirement_requirementGroupId_sourceKey_key" ON "ProgramRequirement"("requirementGroupId", "sourceKey");

ALTER TABLE "RequirementGroup" ADD CONSTRAINT "RequirementGroup_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "CatalogVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramRequirement" ADD CONSTRAINT "ProgramRequirement_requirementGroupId_fkey" FOREIGN KEY ("requirementGroupId") REFERENCES "RequirementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramRequirement" ADD CONSTRAINT "ProgramRequirement_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES "CourseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
