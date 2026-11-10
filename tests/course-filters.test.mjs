import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FILTERS, indexSections, selectFilteredCourses, readCourseFilters, writeCourseFilters, unitRange, filterGroups } from "../src/courseFilters.ts";

const course = (code, overrides = {}) => ({ id: code, code, title: code + " course", units: 3, recommendedSemester: 1, prerequisiteCourseIds: [], corequisiteCourseIds: [], description: "", sourceUrl: "", ...overrides });
const section = (code, id, overrides = {}) => ({ courseCode: code, classNumber: id, sectionNumber: "01", component: "LEC", mode: "In Person", days: "MW", times: "09:00AM-10:15AM", openSeats: 4, instructors: ["Ada Lovelace"], location: "ENG", dates: "", ...overrides });
const courses = [course("CMPE 131"), course("CS 46A"), course("MATH 30"), course("DATA 200", { recommendedSemester: 0, unitsText: "" })];
function select(filters = {}, sections = [], query = "") {
  return selectFilteredCourses(courses, query, { ...DEFAULT_FILTERS, ...filters }, {
    degreeIds: new Set(["CMPE 131", "MATH 30"]), scheduledCodes: new Set(["CS 46A"]), sections: indexSections(sections), courseText: new Map(courses.map(c => [c.id, `${c.code} ${c.title}`.toLowerCase()])),
  });
}
test("combined filters must match the same section, not different sections of a course", () => {
  const sections = [section("CMPE 131", "10001", { mode: "Fully Online", openSeats: 0 }), section("CMPE 131", "10002"), section("CS 46A", "10003", { mode: "Fully Online" })];
  const result = select({ modes: ["online"], availability: "open" }, sections);
  assert.deepEqual(result.courses.map(c => c.code), ["CS 46A"]);
  assert.deepEqual(result.matchingSections.get("CS 46A").map(o => o.classNumber), ["10003"]);
  assert.equal(sections.length, 3);
});
test("unknown seats are neither open nor full", () => {
  const sections = [section("CMPE 131", "10001", { openSeats: 0, seatsKnown: false })];
  assert.equal(select({ availability: "open" }, sections).courses.length, 0);
  assert.equal(select({ availability: "full" }, sections).courses.length, 0);
  assert.equal(select({ availability: "unknown" }, sections).courses.length, 1);
});
test("all meeting days and patterns must fit the selected days and bounds", () => {
  const sections = [section("CMPE 131", "10001"), section("CS 46A", "10002", { days: "M", times: "09:00AM-10:15AM / 02:00PM-03:00PM" })];
  assert.equal(select({ days: ["M"] }, sections).courses.length, 1);
  assert.equal(select({ days: ["M", "W"], after: "09:00", before: "10:15" }, sections).courses.length, 1);
  assert.equal(select({ after: "09:01", before: "10:15" }, sections).courses.length, 0);
});
test("TBA and partially unknown meetings cannot silently pass time filters", () => {
  const sections = [section("CMPE 131", "10001", { days: "TBA", times: "TBA" }), section("CS 46A", "10002", { times: "09:00AM-10:15AM / unverified" })];
  assert.equal(select({ before: "12:00" }, sections).courses.length, 0);
  assert.equal(select({ before: "12:00", includeUnknown: true }, sections).courses.length, 2);
  assert.equal(select({ before: "09:30", includeUnknown: true }, sections).courses.length, 1);
  assert.equal(select({ meeting: "unscheduled" }, sections).courses.length, 1);
  assert.equal(select({ meeting: "review" }, sections).courses.length, 2);
});
test("online is independent of scheduled versus unscheduled meetings", () => {
  const sections = [section("CMPE 131", "10001", { mode: "Fully Online" }), section("CS 46A", "10002", { mode: "Fully Online", days: "TBA", times: "TBA" })];
  assert.equal(select({ modes: ["online"], meeting: "scheduled" }, sections).courses.length, 1);
  assert.equal(select({ modes: ["online"], meeting: "unscheduled" }, sections).courses.length, 1);
});
test("degree and selected scopes work without a search, including nondegree selections", () => {
  assert.deepEqual(select({ scope: "degree" }).courses.map(c => c.code), ["CMPE 131", "MATH 30"]);
  assert.deepEqual(select({ scope: "scheduled" }).courses.map(c => c.code), ["CS 46A"]);
  assert.deepEqual(select({ subjects: ["CMPE", "MATH"] }).courses.map(c => c.code), ["CMPE 131", "MATH 30"]);
  assert.equal(select({ year: "early" }).courses.length, 3);
});
test("missing units are not zero; variable units match an overlapping range", () => {
  assert.equal(unitRange(course("TEST 1", { units: 0, unitsText: "" })), null);
  assert.deepEqual(unitRange(course("TEST 1", { unitsText: "1–4" })), [1, 4]);
  assert.deepEqual(unitRange(course("TEST 1", { unitsText: "3.0" })), [3, 3]);
  assert.equal(select({ minUnits: "0", maxUnits: "0" }).courses.length, 0);
  assert.equal(select({ minUnits: "3", maxUnits: "4" }).courses.length, 3);
});
test("search by instructor/class number respects the same-section predicate", () => {
  const sections = [section("CMPE 131", "12345"), section("CMPE 131", "12346", { instructors: ["Grace Hopper"], mode: "Fully Online" })];
  assert.equal(select({}, sections, "ada").courses.length, 1);
  assert.equal(select({ modes: ["online"] }, sections, "ada").courses.length, 0);
  assert.deepEqual(select({}, sections, "12346").matchingSections.get("CMPE 131").map(o => o.classNumber), ["12346"]);
  assert.equal(select({}, sections, "a").courses.length, 0);
});
test("class type, instructor and offered-this-term use real section evidence", () => {
  const sections = [section("CMPE 131", "12345", { component: "LAB" })];
  assert.equal(select({ offered: true }, sections).courses.length, 1);
  assert.equal(select({ components: ["LEC"] }, sections).courses.length, 0);
  assert.equal(select({ components: ["LAB"], instructor: "Lovelace" }, sections).courses.length, 1);
});
test("URL roundtrip preserves other state and validates malformed filters", () => {
  const filters = { ...DEFAULT_FILTERS, scope: "degree", availability: "open", subjects: ["CMPE", "CS"], days: ["M", "W"], after: "09:00", minUnits: "3", offered: true, modes: ["online"] };
  const params = writeCourseFilters(new URLSearchParams("q=math&profile=1&status=late"), filters);
  assert.deepEqual(readCourseFilters(params), filters);
  assert.equal(params.get("q"), "math"); assert.equal(params.get("profile"), "1"); assert.equal(params.has("status"), false);
  const bad = readCourseFilters(new URLSearchParams("scope=oops&after=55:99&days=X,M&minUnits=-3&availability=oops"));
  assert.equal(bad.scope, "all"); assert.equal(bad.after, ""); assert.equal(bad.minUnits, ""); assert.deepEqual(bad.days, ["M"]);
  assert.equal(filterGroups(filters).length, 8);
  assert.equal(readCourseFilters(new URLSearchParams("status=scheduled")).scope, "scheduled");
});
