"""Parameterised read-only catalog access; never executes model-generated SQL."""

import os
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import psycopg
from psycopg.rows import dict_row


def database_url() -> str:
    value = os.getenv("AGENT_DATABASE_URL") or os.getenv("DATABASE_URL") or "postgresql://course_radar:course_radar@127.0.0.1:5432/course_radar"
    parts = urlsplit(value)
    # Prisma's schema argument is not a libpq connection option.
    return urlunsplit(parts._replace(query=urlencode([(k, v) for k, v in parse_qsl(parts.query) if k != "schema"])))


class CatalogRepository:
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
