CREATE TABLE "UniversityCourseRecord" (
    "courseId" TEXT NOT NULL,
    "catalogYear" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "units" DOUBLE PRECISION,
    "unitsText" TEXT NOT NULL,
    "description" TEXT,
    "prerequisiteText" TEXT,
    "corequisiteText" TEXT,
    "prerequisiteCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "corequisiteCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sourceUrl" TEXT NOT NULL,
    "catalogStatus" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UniversityCourseRecord_pkey" PRIMARY KEY ("courseId", "catalogYear"),
    CONSTRAINT "UniversityCourseRecord_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "UniversitySectionRecord" (
    "termId" TEXT NOT NULL,
    "classNumber" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UniversitySectionRecord_pkey" PRIMARY KEY ("termId", "classNumber"),
    CONSTRAINT "UniversitySectionRecord_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UniversitySectionRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UniversitySectionRecord_courseId_termId_idx" ON "UniversitySectionRecord"("courseId", "termId");
