import test from "node:test";
import assert from "node:assert/strict";
import { courseSubject, subjectTone } from "../src/courseSubject.ts";

test("course views share subject identity and readable solid-fill labels", () => {
  for (const [code, subject] of [["CMPE 131", "major"], ["CS 46A", "major"], ["SE 185", "major"], ["MATH 31", "math"], ["PHYS 50", "science"], ["CHEM 1A", "science"], ["BIOL 10", "science"], ["ENGR 10", "eng"], ["EE 98", "eng"], ["ENGL 1A", "writing"], ["", "choice"]]) {
    assert.equal(courseSubject(code), subject);
    assert.equal(subjectTone(code)["--c"], `var(--s-${subject})`);
    assert.equal(subjectTone(code)["--c-ink"], subject === "writing" ? "#fff" : "#000");
  }
});


test("unlisted outside-roadmap courses are university electives regardless of subject", () => {
  for (const code of ["AAS 1", "AAS 175", "CMPE 999", "MATH 31", "ENGL 1A"]) {
    assert.equal(courseSubject(code, false), "university");
    assert.equal(subjectTone(code, false)["--c"], "var(--s-university)");
    assert.equal(subjectTone(code, false)["--c-ink"], "#000");
  }
  assert.equal(courseSubject("MATH 31", true), "math");
});

test("technical electives use the department list for the active major, with core-course priority", () => {
  assert.equal(courseSubject("CMPE 132", false, "computer-engineering"), "technical");
  assert.equal(courseSubject("CMPE 132", false, "software-engineering"), "university");
  assert.equal(courseSubject("CS 156", false, "software-engineering"), "technical");
  assert.equal(courseSubject("CS 156", false, "computer-engineering"), "university");
  assert.equal(courseSubject("CMPE 132", true, "software-engineering"), "major");
  assert.equal(courseSubject("CMPE 146", false), "university");
  assert.equal(courseSubject("CMPE 180", false), "university");
  assert.equal(subjectTone("CMPE 132", false)["--c"], "var(--s-technical)");
});
