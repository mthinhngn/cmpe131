import { StrictMode } from "react";
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
document.title = "Course Radar";
createRoot(document.getElementById("root")!).render(<StrictMode><Home /></StrictMode>);
