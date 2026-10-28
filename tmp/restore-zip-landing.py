from pathlib import Path
root=Path('.')
base=Path('tmp/courseradar-reference-20261026/client/src')
# Retain source layout, typography, copy, interactions and map verbatim.
home=(base/'pages/Home.tsx').read_text(encoding='utf-8').replace('"@/components/CourseNetwork"','"./LandingCourseNetwork"')
Path('src/ReferenceLanding.tsx').write_text(home,encoding='utf-8')
Path('src/LandingCourseNetwork.tsx').write_bytes((base/'components/CourseNetwork.tsx').read_bytes())
Path('src/reference-landing.css').write_bytes((base/'index.css').read_bytes())
main=Path('src/main.tsx').read_text(encoding='utf-8')
main=main.replace('import { StrictMode }','import { StrictMode, useEffect }').replace('import Landing from "./ReferenceLanding";','function Landing() { useEffect(() => { window.location.assign("/"); }, []); return null; }')
Path('src/workspace-entry.tsx').write_text(main,encoding='utf-8')
Path('src/main.tsx').write_text('''// Separate document entries keep workspace CSS out of the supplied landing.
if (window.location.pathname === "/") {
  void import("./reference-entry");
} else {
  void import("./workspace-entry");
}
export {};
''',encoding='utf-8')
Path('src/reference-entry.tsx').write_text('''import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "./ReferenceLanding";
import "./reference-landing.css";

// The exact font families and weights requested by the ZIP's client/index.html.
for (const href of [
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
  "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap",
]) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
createRoot(document.getElementById("root")!).render(<StrictMode><Home /></StrictMode>);
''',encoding='utf-8')
