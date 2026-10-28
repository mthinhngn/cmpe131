// Opt-in development benchmark: /prerequisites?profile (never loaded in production).
export {};
type Sample = { duration: number };
const commits: Sample[] = [];
const results: Record<string, unknown> = {};
window.addEventListener("course-radar-commit", event => {
  commits.push({ duration: (event as CustomEvent<number>).detail });
});
const frame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const percentile = (values: number[], q: number) => [...values].sort((a,b) => a-b)[Math.floor((values.length - 1) * q)] ?? 0;
function summarize(samples: Sample[], frames: number[], elapsed: number) {
  const durations = samples.map(sample => sample.duration);
  return { commits: samples.length, reactMs: sum(durations), commitP95Ms: percentile(durations, .95), frameP95Ms: percentile(frames, .95), framesOver25ms: frames.filter(ms => ms > 25).length, elapsed };
}
async function run() {
  const selector = location.pathname === "/roadmap" ? ".degree-course" : ".react-flow__node-course";
  for (let tries = 0; tries < 200 && !document.querySelector(selector); tries++) await pause(50);
  await document.fonts.ready;
  await pause(1500);
  const nodes = [...document.querySelectorAll<HTMLElement>(selector)];
  if (!nodes.length) throw new Error(`No benchmark targets: ${selector}`);
  const measures = [];
  for (let trial = 0; trial < 3; trial++) {
    commits.length = 0;
    const frames: number[] = [];
    const start = performance.now();
    let last = await frame();
    for (let i = 0; i < 40; i++) {
      const node = nodes[(i * 7) % nodes.length];
      node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
      const now = await frame(); frames.push(now - last); last = now;
      node.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
      const next = await frame(); frames.push(next - last); last = next;
    }
    measures.push(summarize([...commits], frames, performance.now() - start));
  }
  results.route = location.pathname;
  results.targets = nodes.length;
  results.trials = measures;
  results.complete = true;
  const output = document.createElement("pre");
  output.id = "course-radar-profile";
  output.textContent = JSON.stringify(results);
  document.body.append(output);
  console.info("Course Radar profile", JSON.stringify(results));
}
void run().catch(error => { console.error("Course Radar profile failed", error); });
