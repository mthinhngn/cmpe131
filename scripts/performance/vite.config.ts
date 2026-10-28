import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vite";
import base from "../../vite.config";

// Serve captured source at its original module path, keeping relative imports intact.
const original = new Set(["RoadmapFlow.tsx", "DegreeRoadmap.tsx", "CatalogContext.tsx", "ScheduleContext.tsx", "LandingCourseNetwork.tsx", "prerequisiteGraph.ts"]);
export default mergeConfig(base, defineConfig({
  plugins: [{ name: "performance-baseline", enforce: "pre", async load(id) {
    const file = id.replace(/\\/g, "/").split("/").pop()!;
    if (!id.replace(/\\/g, "/").includes("/src/") || !original.has(file)) return;
    return readFile(fileURLToPath(new URL(`../../tmp/performance/baseline/${file}`, import.meta.url)), "utf8");
  } }],
  server: { port: 5175, strictPort: true },
}));
