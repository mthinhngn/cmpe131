import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SCHOOL_ID = "U2Nob29sLTg4MQ==";
const root = new URL("../", import.meta.url);
export const normalizeName = value => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

export function matchProfessor(name, directory) {
  const normalized = normalizeName(name);
  const eligible = directory.filter(p => p.schoolId === SCHOOL_ID && Number.isSafeInteger(p.id) && p.id > 0);
  const exact = eligible.filter(p => normalizeName(`${p.firstName} ${p.lastName}`) === normalized);
  if (exact.length === 1) return { profile: exact[0], match: "exact" };
  if (exact.length > 1) return { reason: "ambiguous" };
  // Allow omitted middle names, but never infer an identity from initials alone.
  const similar = eligible.filter(p => {
    const last = normalizeName(p.lastName);
    if (!normalized.endsWith(` ${last}`)) return false;
    const given = normalized.slice(0, -last.length).trim().split(" ");
    const candidate = normalizeName(p.firstName).split(" ");
    return given[0].length > 1 && given[0] === candidate[0]
      && (given.join(" ") === candidate.slice(0, given.length).join(" ")
        || candidate.join(" ") === given.slice(0, candidate.length).join(" "));
  });
  return similar.length === 1 ? { profile: similar[0], match: "similar" } : { reason: similar.length ? "ambiguous" : "unmatched" };
}

async function json(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`${new URL(url).pathname}: HTTP ${response.status}`);
  const result = await response.json();
  if (result.errors) throw Error(JSON.stringify(result.errors));
  return result;
}

async function sync() {
  const base = process.env.COURSE_RADAR_SYNC_API || "http://localhost:5175/api/v1/";
  const programs = await json(`${base}bootstrap/programs`);
  const bootstrap = await json(`${base}bootstrap?program=${encodeURIComponent(programs.programs[0].slug)}`);
  const terms = [...new Set([bootstrap.catalog.currentTerm.id, ...(bootstrap.catalog.availableTerms || [])])];
  const names = new Set();
  let sections = 0;
  for (const term of terms) {
    const data = await json(`${base}university/sections?term=${encodeURIComponent(term)}`);
    sections += data.offerings.length;
    data.offerings.forEach(section => section.instructors.forEach(name => names.add(name)));
  }
  const cache = new URL("data/ratemyprofessors/sjsu-directory.json", root);
  let snapshot;
  if (process.argv.includes("--cached")) snapshot = JSON.parse(await readFile(cache, "utf8"));
  else {
    const directory = new Map();
    let after = "", resultCount = 0;
    for (let page = 0; page < 100; page++) {
      const result = await json("https://www.ratemyprofessors.com/graphql", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query($after:String) { newSearch { teachers(first:100, after:$after, query:{schoolID:"${SCHOOL_ID}",text:"",fallback:true}) { edges { node { legacyId firstName lastName department school { id name } } } pageInfo { hasNextPage endCursor } resultCount } } }`, variables: { after } }),
      });
      const teachers = result.data.newSearch.teachers;
      resultCount = teachers.resultCount;
      for (const { node } of teachers.edges) {
        if (node.school.id !== SCHOOL_ID) throw Error("Directory returned a different school");
        directory.set(node.legacyId, { id: node.legacyId, firstName: node.firstName.trim(), lastName: node.lastName.trim(), department: node.department, schoolId: node.school.id });
      }
      console.log(`Directory page ${page + 1}: ${directory.size}/${resultCount}`);
      if (!teachers.pageInfo.hasNextPage) break;
      if (!teachers.edges.length || teachers.pageInfo.endCursor === after) throw Error("Directory pagination stalled");
      after = teachers.pageInfo.endCursor;
      if (page === 99) throw Error("Directory exceeded pagination limit");
    }
    if (directory.size < resultCount * .98) throw Error("Directory incomplete; preserving the previous snapshot");
    snapshot = { school: "San Jose State University", schoolId: SCHOOL_ID, sourceUrl: "https://www.ratemyprofessors.com/search/professors/881", fetchedAt: new Date().toISOString(), directory: [...directory.values()] };
    await mkdir(new URL("data/ratemyprofessors/", root), { recursive: true });
    await writeFile(cache, JSON.stringify(snapshot, null, 2) + "\n");
  }
  const profiles = {}, unresolved = [];
  let exact = 0, similar = 0;
  for (const name of [...names].sort()) {
    const result = matchProfessor(name, snapshot.directory);
    if (!result.profile) { unresolved.push({ name, reason: result.reason }); continue; }
    const p = result.profile;
    profiles[name] = { id: p.id, name: `${p.firstName} ${p.lastName}`, match: result.match };
    if (result.match === "exact") exact++; else similar++;
  }
  const report = { fetchedAt: snapshot.fetchedAt, programs: programs.programs.length, terms, sections, instructors: names.size, exact, similar, unresolved };
  await mkdir(new URL("src/data/", root), { recursive: true });
  await writeFile(new URL("src/data/professor-profiles.json", root), JSON.stringify({ schoolId: SCHOOL_ID, fetchedAt: snapshot.fetchedAt, profiles }, null, 2) + "\n");
  await writeFile(new URL("data/ratemyprofessors/match-report.json", root), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, unresolved: unresolved.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) sync().catch(error => { console.error(error); process.exitCode = 1; });
