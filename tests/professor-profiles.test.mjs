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

test("Schedule and the ratings service share a valid SJSU profile mapping", async () => {
  const [raw, component, ratingsService] = await Promise.all([
    readFile(new URL("../agent_service/data/professor-profiles.json", import.meta.url), "utf8"),
    readFile(new URL("../src/ProfessorReviewLink.tsx", import.meta.url), "utf8"),
    readFile(new URL("../agent_service/professor_ratings.py", import.meta.url), "utf8"),
  ]);
  const snapshot = JSON.parse(raw);
  assert.equal(snapshot.schoolId, "U2Nob29sLTg4MQ==");
  assert.ok(Object.keys(snapshot.profiles).length > 0);
  for (const [name, profile] of Object.entries(snapshot.profiles)) {
    assert.ok(Number.isInteger(profile.id) && profile.id > 0, name);
    assert.equal(typeof profile.name, "string");
    assert.ok(["exact", "similar"].includes(profile.match), name);
    assert.equal(Object.hasOwn(snapshot.unresolved, name), false);
  }
  assert.ok(component.includes('../agent_service/data/professor-profiles.json'));
  assert.ok(ratingsService.includes("parent / 'data/professor-profiles.json'"));
});
