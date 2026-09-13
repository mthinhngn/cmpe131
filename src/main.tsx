import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import App from "./App";
import { CatalogProvider } from "./CatalogContext";
import PrerequisiteChart from "./PrerequisiteChart";
import { Workspace, Overview, Courses, Planner } from "./Workspace";
import { Recommendations } from "./Recommendations";
import DesignPreview from "./DesignPreview";
import { ScheduleProvider } from "./ScheduleContext";
import { AgentSessionProvider } from "./AgentSessionContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <CatalogProvider>
        <ScheduleProvider>
          <AgentSessionProvider>
          <Routes>
            <Route path="/design-preview" element={<DesignPreview />} />
            <Route element={<Workspace />}>
              <Route path="/" element={<Overview />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/roadmap" element={<App />} />
              <Route path="/prerequisite-chart" element={<PrerequisiteChart />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="*" element={<Overview />} />
            </Route>
          </Routes>
          </AgentSessionProvider>
        </ScheduleProvider>
      </CatalogProvider>
    </BrowserRouter>
  </StrictMode>,
);
