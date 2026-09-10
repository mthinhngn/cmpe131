CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "classNumber" TEXT NOT NULL,
    "sectionNumber" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "days" TEXT NOT NULL,
    "times" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "dates" TEXT NOT NULL,
    "openSeats" INTEGER NOT NULL,
    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Section_termId_classNumber_key" ON "Section"("termId", "classNumber");
CREATE INDEX "Section_courseId_termId_idx" ON "Section"("courseId", "termId");

ALTER TABLE "Section" ADD CONSTRAINT "Section_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Section" ADD CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
