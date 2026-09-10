import { readFile, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://www.sjsu.edu/classes/schedules/fall-2026.php";
const OUTPUT_PATH = new URL("../src/fall2026Offerings.generated.ts", import.meta.url);
const DATA_PATH = new URL("../src/data.ts", import.meta.url);

const decodeCell = (value) => value
  .replace(/<br\s*\/?>/gi, " / ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, "\"")
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, " ")
  .replace(/\s*\/\s*\/\s*/g, " / ")
  .trim();

const source = await readFile(DATA_PATH, "utf8") + await readFile(new URL("../src/softwareEngineeringData.ts", import.meta.url), "utf8");
const courseCodes = new Set([...source.matchAll(/course\("[^"]+",\s*"([^"]+)"/g)].map((match) => match[1]));
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`SJSU schedule returned ${response.status}`);
const html = await response.text();
const offerings = [];
const classNumbers = new Set();

for (const row of html.match(/<tr>[\s\S]*?<\/tr>/gi) ?? []) {
  const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((match) => decodeCell(match[1]));
  if (cells.length < 13) continue;
  const sectionMatch = cells[0].match(/^(.*?) \(Section (.*?)\)$/);
  if (!sectionMatch || !courseCodes.has(sectionMatch[1]) || classNumbers.has(cells[1])) continue;
  classNumbers.add(cells[1]);
  offerings.push({
    courseCode: sectionMatch[1],
    sectionNumber: sectionMatch[2],
    classNumber: cells[1],
    mode: cells[2],
    component: cells[6],
    instructors: [...new Set(cells[9].split(/\s*\/\s*/).map((name) => name.trim()).filter((name) => name && !/^(staff|tba|tbd|to be announced)$/i.test(name)))],
    days: cells[7],
    times: cells[8],
    location: cells[10],
    dates: cells[11],
    openSeats: Number.parseInt(cells[12], 10) || 0,
  });
}

offerings.sort((left, right) => left.courseCode.localeCompare(right.courseCode, undefined, { numeric: true }) || left.sectionNumber.localeCompare(right.sectionNumber, undefined, { numeric: true }));
if (!offerings.length) throw new Error("No sections parsed; preserving previous snapshot.");

const output = `// Generated from the official SJSU Fall 2026 schedule. Do not edit by hand.\n` +
  `import type { CourseOffering } from "./types";\n\n` +
  `export const FALL_2026_SCHEDULE_SOURCE = ${JSON.stringify(SOURCE_URL)};\n` +
  `export const FALL_2026_FETCHED_AT = ${JSON.stringify(new Date().toISOString())};\n\n` +
  `export const fall2026Offerings: CourseOffering[] = ${JSON.stringify(offerings, null, 2)};\n`;

await writeFile(OUTPUT_PATH, output, "utf8");
console.log(`Imported ${offerings.length} Fall 2026 schedule rows for ${courseCodes.size} roadmap courses.`);
