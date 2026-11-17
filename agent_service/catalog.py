"""Parameterised read-only catalog access; never executes model-generated SQL."""

import os
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import psycopg
from psycopg.rows import dict_row


def database_url() -> str:
    # Neon's pooler rejects the startup options used below, so prefer its direct URL.
    value = os.getenv("AGENT_DATABASE_URL") or os.getenv("DATABASE_URL_UNPOOLED") or os.getenv("DATABASE_URL") or "postgresql://course_radar:course_radar@127.0.0.1:5432/course_radar"
    parts = urlsplit(value)
    # Prisma's schema argument is not a libpq connection option.
    return urlunsplit(parts._replace(query=urlencode([(k, v) for k, v in parse_qsl(parts.query) if k != "schema"])))


class CatalogRepository:
    def catalog_courses(self):
        with psycopg.connect(database_url(), connect_timeout=5, row_factory=dict_row,
                             options='-c default_transaction_read_only=on -c statement_timeout=5000') as conn:
            return [dict(r) for r in conn.execute('''
                SELECT c.id AS course_id, c.code, r.title, r.units, r.description,
                       r."prerequisiteText" AS prerequisite_text, r."prerequisiteCodes" AS prerequisite_codes,
                       r."corequisiteText" AS corequisite_text, r."corequisiteCodes" AS corequisite_codes,
                       r."sourceUrl" AS catalog_url, r."fetchedAt" AS fetched_at
                FROM "UniversityCourseRecord" r JOIN "Course" c ON c.id=r."courseId"
                WHERE r."catalogYear"=%s ORDER BY c.code
            ''', ('2026-2027',)).fetchall()]

    def course_details(self, code):
        normalized = re.sub(r'[^A-Z0-9]', '', code.upper())
        return next((r for r in self.catalog_courses() if re.sub(r'[^A-Z0-9]', '', r['code'].upper()) == normalized), None)

    def section_records(self, term):
        from .web_contracts import parse_term
        term = parse_term(term).id
        with psycopg.connect(database_url(), connect_timeout=5, row_factory=dict_row,
                             options='-c default_transaction_read_only=on -c statement_timeout=5000') as conn:
            return [{**r['evidence'], 'course_id': r['courseId'], 'sourceUrl': r['sourceUrl'],
                     'fetchedAt': r['fetchedAt'].isoformat(),
                     **{key: r[key].isoformat() if r[key] else None
                        for key in ('sourceUpdatedOn', 'checkedAt', 'lastImportedAt')}} for r in conn.execute('''
                SELECT s."courseId",s."sourceUrl",s.evidence,t."fetchedAt",t."sourceUpdatedOn",t."checkedAt",t."lastImportedAt"
                FROM "UniversitySectionRecord" s JOIN "Term" t ON t.id=s."termId"
                WHERE s."termId"=%s AND (t."lastImportedAt" IS NULL OR s.evidence->>'sourceKind'='ischool'
                                       OR s."lastSeenAt">=t."lastImportedAt")
                ORDER BY s."classNumber"
            ''', (term,)).fetchall()]

    def prerequisite_rules(self, program):
        with psycopg.connect(database_url(), connect_timeout=5, row_factory=dict_row, options='-c default_transaction_read_only=on -c statement_timeout=5000') as conn:
            return [dict(r) for r in conn.execute('''
                SELECT cv."courseId" AS course_id, r."requiredCourseId" AS required_id,
                       r."groupKey" AS group_key, r.operator, r."isCorequisite" AS corequisite,
                       r."requiresManualReview" AS manual_review
                FROM "PrerequisiteRule" r JOIN "CourseVersion" cv ON cv.id=r."courseVersionId"
                JOIN "CatalogVersion" v ON v.id=cv."catalogVersionId" JOIN "Program" p ON p.id=v."programId"
                WHERE p.slug=%s AND v."catalogYear"='2026-2027'
            ''', (program,)).fetchall()]

    def planned_courses(self, program, course_ids):
        with psycopg.connect(database_url(), connect_timeout=5, row_factory=dict_row,
                             options='-c default_transaction_read_only=on -c statement_timeout=5000') as conn:
            return [dict(r) for r in conn.execute('''
                SELECT c.id AS course_id, c.code FROM "Course" c
                WHERE c.id = ANY(%s) AND (
                  EXISTS (SELECT 1 FROM "CourseVersion" cv JOIN "CatalogVersion" v ON v.id=cv."catalogVersionId"
                    JOIN "Program" p ON p.id=v."programId" WHERE cv."courseId"=c.id AND p.slug=%s AND v."catalogYear"='2026-2027')
                  OR EXISTS (SELECT 1 FROM "UniversityCourseRecord" r WHERE r."courseId"=c.id AND r."catalogYear"='2026-2027'))
            ''', (course_ids, program)).fetchall()]

    def find(self, program: str, query: str, course_id: str | None = None) -> list[dict]:
        normalized = re.sub(r"[^a-z0-9]", "", query.lower())
        normalized = re.sub(r"^course(?=[a-z]{2,}\d)", "", normalized)
        with psycopg.connect(database_url(), connect_timeout=5, row_factory=dict_row, options="-c default_transaction_read_only=on -c statement_timeout=5000") as conn:
            rows = conn.execute('''
                WITH selected AS (SELECT c.id AS course_id, c.code, cv.title, p.slug AS program_id
                FROM "Course" c
                JOIN "CourseVersion" cv ON cv."courseId" = c.id
                JOIN "CatalogVersion" v ON v.id = cv."catalogVersionId"
                JOIN "Program" p ON p.id = v."programId"
                WHERE p.slug = %s AND v."catalogYear" = '2026-2027')
                SELECT * FROM selected
                UNION ALL
                SELECT c.id AS course_id,c.code,r.title,%s AS program_id
                FROM "UniversityCourseRecord" r JOIN "Course" c ON c.id=r."courseId"
                WHERE r."catalogYear"='2026-2027' AND NOT EXISTS (SELECT 1 FROM selected s WHERE s.course_id=c.id)
                ORDER BY code
            ''', (program, program)).fetchall()
        if course_id:
            return [dict(r) for r in rows if r["course_id"] == course_id]
        exact = [dict(r) for r in rows if re.sub(r"[^a-z0-9]", "", r["code"].lower()) == normalized]
        if exact:
            return exact
        if not normalized:
            return []
        return [dict(r) for r in rows if normalized in re.sub(r"[^a-z0-9]", "", f'{r["code"]} {r["title"]}'.lower())][:12]
