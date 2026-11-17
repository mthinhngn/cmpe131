ALTER TABLE "Term"
ADD COLUMN "sourceUpdatedOn" DATE,
ADD COLUMN "sourceSha256" TEXT,
ADD COLUMN "checkedAt" TIMESTAMP(3),
ADD COLUMN "lastImportedAt" TIMESTAMP(3);

ALTER TABLE "UniversitySectionRecord" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "Section" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
