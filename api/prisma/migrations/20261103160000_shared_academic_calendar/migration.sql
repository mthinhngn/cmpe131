CREATE TABLE "SharedAcademicCalendar" (
    "id" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedAcademicCalendar_pkey" PRIMARY KEY ("id")
);
