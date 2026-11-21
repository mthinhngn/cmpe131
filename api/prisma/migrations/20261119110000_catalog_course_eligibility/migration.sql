CREATE TABLE "CatalogCourseEligibility" (
    "catalogVersionId" TEXT NOT NULL,
    "requirementKey" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "checkedOn" DATE NOT NULL,
    "termId" TEXT,
    "sectionNumbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "topic" TEXT,
    "conditionText" TEXT,
    CONSTRAINT "CatalogCourseEligibility_pkey" PRIMARY KEY ("catalogVersionId", "requirementKey", "courseId"),
    CONSTRAINT "CatalogCourseEligibility_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "CatalogVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogCourseEligibility_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
