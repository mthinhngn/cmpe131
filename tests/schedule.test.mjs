import test from "node:test";
import assert from "node:assert/strict";
import { detectTimeConflicts, parseMeeting } from "../src/schedule.ts";

const offering = (overrides = {}) => ({
  instructors: [],
  courseCode: "CMPE 131",
  sectionNumber: "01",
  classNumber: "10001",
  mode: "In Person",
  component: "LEC",
  days: "MW",
  times: "09:00AM-10:15AM",
  location: "ENGR 101",
  dates: "08/19/2026-12/07/2026",
  openSeats: 10,
  ...overrides,
});

test("parses standard multi-day meeting times", () => {
  assert.deepEqual(parseMeeting(offering()), {
    status: "scheduled",
    patterns: [{ days: ["M", "W"], startMinute: 540, endMinute: 615 }],
  });
});

test("recovers embedded day tokens from imported composite time text", () => {
  assert.deepEqual(parseMeeting(offering({ days: "T / TBA", times: "T / 10:30AM-11:45AM / TBA / TBA" })), {
    status: "scheduled",
    patterns: [{ days: ["T"], startMinute: 630, endMinute: 705 }],
  });
});

test("keeps TBA sections out of the timed grid", () => {
  assert.deepEqual(parseMeeting(offering({ days: "TBA", times: "TBA" })), { status: "unscheduled", patterns: [] });
});

test("detects overlap on a shared day", () => {
  const conflicts = detectTimeConflicts([
    offering(),
    offering({ courseCode: "CMPE 102", classNumber: "10002", days: "W", times: "10:00AM-11:15AM" }),
  ]);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].days, ["W"]);
  assert.equal(conflicts[0].startMinute, 600);
  assert.equal(conflicts[0].endMinute, 615);
});

test("allows back-to-back sections", () => {
  const conflicts = detectTimeConflicts([
    offering(),
    offering({ courseCode: "CMPE 102", classNumber: "10002", times: "10:15AM-11:30AM" }),
  ]);
  assert.equal(conflicts.length, 0);
});

test("allows the same time on different days", () => {
  const conflicts = detectTimeConflicts([
    offering({ days: "M" }),
    offering({ courseCode: "CMPE 102", classNumber: "10002", days: "T" }),
  ]);
  assert.equal(conflicts.length, 0);
});
