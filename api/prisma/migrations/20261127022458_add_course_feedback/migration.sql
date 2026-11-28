-- CreateTable
CREATE TABLE "CourseFeedback" (
    "id" SERIAL NOT NULL,
    "courseCode" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "authorName" TEXT NOT NULL DEFAULT 'Student',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseFeedback_courseCode_createdAt_idx" ON "CourseFeedback"("courseCode", "createdAt");
