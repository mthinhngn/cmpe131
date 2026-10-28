import { Profiler, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import App from "./App";
import { CatalogProvider } from "./CatalogContext";
import PrerequisiteChart from "./PrerequisiteChart";
import { Workspace, Overview, Courses } from "./Workspace";
import SemesterPlanner from "./SemesterPlanner";
import DesignPreview from "./DesignPreview";
import { ScheduleProvider } from "./ScheduleContext";
import "./product-navigation.css";
import "./product-layout.css";
import "./product-typography.css";
function PrerequisiteLanding() { useEffect(() => { window.location.assign("/prerequisite-chart"); }, []); return null; }
function Landing() { useEffect(() => { window.location.assign("/"); }, []); return null; }

const profile = import.meta.env.DEV && new URLSearchParams(location.search).has("profile");
const content = (
  <StrictMode>
    <BrowserRouter>
      <CatalogProvider>
        <ScheduleProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/design-preview" element={<DesignPreview />} />
            <Route path="/planner" element={<SemesterPlanner />} />
            <Route element={<Workspace />}>
              <Route path="/overview" element={<Overview />} />
              <Route path="/catalog-overview" element={<Overview />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/roadmap" element={<App />} />
              <Route path="/prerequisite-chart" element={<PrerequisiteLanding />} />
              <Route path="/catalog-prerequisites" element={<PrerequisiteChart />} />
              <Route path="/recommendations" element={<Navigate to="/courses" replace />} />
              <Route path="*" element={<Overview />} />
            </Route>
          </Routes>
        </ScheduleProvider>
      </CatalogProvider>
    </BrowserRouter>
  </StrictMode>
);
createRoot(document.getElementById("root")!).render(profile ? <Profiler id="page" onRender={(_id, _phase, duration) => window.dispatchEvent(new CustomEvent("course-radar-commit", { detail: duration }))}>{content}</Profiler> : content);

