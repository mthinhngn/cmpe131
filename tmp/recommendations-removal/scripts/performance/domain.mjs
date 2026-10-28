import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { getHighlightedPath } from '../../src/prerequisiteGraph.ts';
import { getHighlightedPath as oldPath } from '../../tmp/performance/baseline/prerequisiteGraph.ts';
import { generateScheduleCandidates, findConflicts } from '../../api/src/agent/schedule-domain.ts';
import { generateScheduleCandidates as oldCandidates, findConflicts as oldConflicts } from '../../tmp/performance/baseline/schedule-domain.ts';
import { buildAutonomousSchedule } from '../../api/src/agent/autonomous-schedule-domain.ts';
import { buildAutonomousSchedule as oldAutonomous } from '../../tmp/performance/baseline/autonomous-schedule-domain.ts';
import { computerEngineeringCatalog } from '../../src/data.ts';
import { mkdir, writeFile } from 'node:fs/promises';

const edges = Array.from({length: 120}, (_, i) => ({from: `c${i}`, to: `c${i+1}`, kind: 'prerequisite'}));
edges.push({from: 'c20', to: 'lab', kind: 'corequisite'});
for (const id of [null, 'c0', 'c20', 'c60', 'c120', 'lab']) {
  const normalize = path => Object.fromEntries(Object.entries(path).map(([key, values]) => [key, [...values].sort()]));
  assert.deepEqual(normalize(getHighlightedPath(id, edges)), normalize(oldPath(id, edges)));
}
const sections = Array.from({length: 32}, (_, i) => ({courseId:`course-${Math.floor(i/8)}`, courseCode:`TEST ${Math.floor(i/8)}`, classNumber:String(i), component:'LEC', sectionNumber:String(i%8), days:['MW','TR','F'][i%3], times:`${8+i%4}:00AM-${9+i%4}:00AM`, openSeats:20, mode:'In Person', dates:'Fall', location:'ENGR', instructors:[]}));
const input = {sections, courseIds: ['course-0','course-1','course-2','course-3'], unavailableTimes:[], maxResults:3, maxCombinations:5000};
const autonomousInput = {courses: input.courseIds.map((courseId,i)=>({courseId,courseCode:`TEST ${i}`,units:3,roadmapSemester:1,downstreamUnlocks:0,rules:[],sections:sections.filter(section=>section.courseId===courseId)})), completedCourseIds:[], lockedSections:[], unavailableTimes:[], avoidDays:[], requiredCourseCodes:[], minimumUnits:6,targetUnits:9,maxResults:3,maxCombinations:5000,assumedNewStudent:true};
const catalogEdges = computerEngineeringCatalog.courses.flatMap(course => [
  ...course.prerequisiteCourseIds.map(from=>({from,to:course.id,kind:'prerequisite'})),
  ...course.corequisiteCourseIds.map(from=>({from,to:course.id,kind:'corequisite'})),
]);
assert.deepEqual(generateScheduleCandidates(input), oldCandidates(input));
assert.deepEqual(findConflicts(sections), oldConflicts(sections));
assert.deepEqual(buildAutonomousSchedule(autonomousInput), oldAutonomous(autonomousInput));
function bench(fn, iterations) {
  for(let i=0;i<3;i++) fn();
  const samples = Array.from({length:7}, () => {
    const start = performance.now();
    for(let i=0;i<iterations;i++) fn();
    return (performance.now()-start)/iterations;
  }).sort((a,b)=>a-b);
  return Number(samples[3].toFixed(4));
}
const results = [];
for (const [name, before, after, iterations] of [
  ['path traversal, current CMPE catalog',()=>oldPath('ce-cmpe126',catalogEdges),()=>getHighlightedPath('ce-cmpe126',catalogEdges),1000],
  ['path traversal, 121 edges',()=>oldPath('c60',edges),()=>getHighlightedPath('c60',edges),1000],
  ['schedule candidates, 32 sections / 5000 branch budget',()=>oldCandidates(input),()=>generateScheduleCandidates(input),5],
  ['conflicts, 32 sections',()=>oldConflicts(sections),()=>findConflicts(sections),100],
  ['autonomous schedule, 32 sections / 5000 branch budget',()=>oldAutonomous(autonomousInput),()=>buildAutonomousSchedule(autonomousInput),3],
]) {
  const beforeMs = bench(before,iterations), afterMs = bench(after,iterations);
  const result = {name,beforeMs,afterMs,speedup:Number((beforeMs/afterMs).toFixed(2)),equivalent:true};
  results.push(result);
  console.log(JSON.stringify(result));
}
await mkdir(new URL('../../tmp/performance/',import.meta.url),{recursive:true});
await writeFile(new URL('../../tmp/performance/domain-results.json',import.meta.url),JSON.stringify({node:process.version,platform:process.platform,method:'median of 7 warmed batches, milliseconds per call; synthetic scheduling fixture',results},null,2));
