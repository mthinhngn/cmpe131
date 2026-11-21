import { Controller, Get } from "@nestjs/common";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaService } from "./prisma/prisma.service";
import { UsersService } from "./auth/users.service";

const root = resolve(__dirname, "../..");
const processStartedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();

function checkout() {
  if (existsSync(join(root, ".git"))) {
    try {
      const git = (args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).trim();
      return { commit: git(["rev-parse", "HEAD"]), dirty: Boolean(git(["status", "--porcelain"])) };
    } catch {
      // Minimal deployments may omit Git.
    }
  }
  return { commit: null, dirty: null };
}

const git = checkout();

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly users: UsersService) {}

  @Get()
  async health() {
    const [programDataVersion, terms] = await Promise.all([
      this.prisma.$queryRaw<{ catalogYear: string; programCount: number; version: string; eligibilityVersion: string }[]>`
        WITH eligibility AS (
          SELECT v."catalogYear", md5(string_agg(to_jsonb(e)::text, ',' ORDER BY e.id)) AS version
          FROM "CatalogCourseEligibility" e JOIN "CatalogVersion" v ON v.id=e."catalogVersionId"
          GROUP BY v."catalogYear"
        )
        SELECT v."catalogYear", count(*)::int AS "programCount",
            md5(string_agg(json_build_array(v."programId", v."dataVersion")::text, ',' ORDER BY v."programId")) AS version,
            COALESCE(e.version, md5('')) AS "eligibilityVersion"
        FROM "CatalogVersion" v LEFT JOIN eligibility e ON e."catalogYear"=v."catalogYear"
        GROUP BY v."catalogYear", e.version ORDER BY v."catalogYear"`,
      this.prisma.term.findMany({ select: { id: true, sourceUpdatedOn: true, lastImportedAt: true }, orderBy: { id: "asc" } }),
      this.users.$queryRaw`SELECT 1`,
    ]);
    const scheduleTerms = terms.map(({ id, sourceUpdatedOn, lastImportedAt }) => ({
      term: id, sourceUpdatedOn: sourceUpdatedOn?.toISOString().slice(0, 10) ?? null, lastImportedAt: lastImportedAt?.toISOString() ?? null,
    }));
    return { status: "ok", database: "connected", userDatabase: "connected", git, processStartedAt, pid: process.pid,
      programDataVersion, scheduleTerms, checkedAt: new Date().toISOString() };
  }
}
