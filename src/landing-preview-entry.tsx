// The illustrative movie needs the original frame styles, without workspace state or UI.
import "./reference-landing.css";
import { createRoot } from "react-dom/client";
import LandingMapEmbed from "./LandingMapEmbed";

document.title = "CourseRadar product preview";
createRoot(document.getElementById("root")!).render(<LandingMapEmbed />);
