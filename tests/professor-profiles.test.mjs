import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { matchProfessor } from "../scripts/sync-professor-profiles.mjs";

const professor = (id, firstName, lastName, schoolId = "U2Nob29sLTg4MQ==") => ({ id, firstName, lastName, schoolId });

test("matches names only to valid SJSU profile IDs, normalizing punctuation and accents", () => {
  const directory = [professor(1, "José", "O'Neill"), professor(2, "Daphne", "Chen", "other-school"), professor(-1, "Daphne", "Chen")];
  assert.equal(matchProfessor("Jose O-Neill", directory).profile.id, 1);
  assert.equal(matchProfessor("Daphne Chen", directory).reason, "unmatched");
});

test("allows a unique middle-name variation without guessing from initials or conflicting names", () => {
  const directory = [professor(1846569, "Ishie Badari", "Eswar")];
  assert.equal(matchProfessor("Ishie Eswar", directory).match, "similar");
  assert.equal(matchProfessor("I Eswar", directory).reason, "unmatched");
  assert.equal(matchProfessor("Ishie Other Eswar", directory).reason, "unmatched");
  assert.equal(matchProfessor("Unknown Teacher", directory).reason, "unmatched");
});

test("prefers unique full-name matches and rejects ambiguous profiles", () => {
  const directory = [professor(1, "Jane", "Doe"), professor(2, "Jane Marie", "Doe")];
  assert.equal(matchProfessor("Jane Doe", directory).profile.id, 1);
  assert.equal(matchProfessor("Jane Doe", [directory[0], professor(3, "Jane", "Doe")]).reason, "ambiguous");
  assert.equal(matchProfessor("Jane Doe", [directory[1], professor(3, "Jane Anne", "Doe")]).reason, "ambiguous");
});

test("generated links come from the SJSU snapshot and account for every imported instructor", {
  skip: !existsSync(new URL("../data/ratemyprofessors/sjsu-directory.json", import.meta.url)) || !existsSync(new URL("../data/ratemyprofessors/match-report.json", import.meta.url))
    ? "Local import cache unavailable; run npm run data:professors to verify against source records."
    : false,
}, async () => {
  const load = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
  const [snapshot, generated, report] = await Promise.all([
    load("../data/ratemyprofessors/sjsu-directory.json"),
    load("../src/data/professor-profiles.json"),
    load("../data/ratemyprofessors/match-report.json"),
  ]);
  const byId = new Map(snapshot.directory.map(p => [p.id, p]));
  for (const profile of Object.values(generated.profiles)) {
    const source = byId.get(profile.id);
    assert.ok(source, `${profile.name}: profile in directory`);
    assert.equal(source.schoolId, "U2Nob29sLTg4MQ==");
    assert.equal(profile.name, `${source.firstName} ${source.lastName}`);
  }
  assert.equal(Object.keys(generated.profiles).length, report.exact + report.similar);
  assert.equal(report.exact + report.similar + report.unresolved.length, report.instructors);
  for (const { name } of report.unresolved) assert.equal(Object.hasOwn(generated.profiles, name), false);
});
