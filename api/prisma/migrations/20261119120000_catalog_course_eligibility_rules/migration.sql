BEGIN;

ALTER TABLE "CatalogCourseEligibility"
    ADD COLUMN "id" SERIAL,
    DROP CONSTRAINT "CatalogCourseEligibility_pkey",
    ADD CONSTRAINT "CatalogCourseEligibility_pkey" PRIMARY KEY ("id");

UPDATE "CatalogCourseEligibility"
    SET "termId" = COALESCE("termId", ''),
        "topic" = COALESCE("topic", ''),
        "conditionText" = COALESCE("conditionText", '')
    WHERE "termId" IS NULL OR "topic" IS NULL OR "conditionText" IS NULL;

ALTER TABLE "CatalogCourseEligibility"
    ALTER COLUMN "termId" SET DEFAULT '',
    ALTER COLUMN "termId" SET NOT NULL,
    ALTER COLUMN "topic" SET DEFAULT '',
    ALTER COLUMN "topic" SET NOT NULL,
    ALTER COLUMN "conditionText" SET DEFAULT '',
    ALTER COLUMN "conditionText" SET NOT NULL;

CREATE UNIQUE INDEX "CatalogCourseEligibility_rule_key"
    ON "CatalogCourseEligibility" ("catalogVersionId", "requirementKey", "sourceKind",
        "courseId", "sourceUrl", "termId", "sectionNumbers", "topic", "conditionText");

CREATE INDEX "CatalogCourseEligibility_source_scope_idx"
    ON "CatalogCourseEligibility" ("catalogVersionId", "requirementKey", "sourceKind");

COMMIT;
