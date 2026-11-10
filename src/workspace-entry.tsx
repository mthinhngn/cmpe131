import { AuthProvider } from "./AuthContext";
import { ChatWidget } from "./ChatWidget";
import { lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import { CatalogProvider } from "./CatalogContext";
import { Workspace } from "./Workspace";
import { PageLoading } from "./PageLoading";
import { PageReady } from "./PageReady";
import { ScheduleProvider } from "./ScheduleContext";
import "./product-navigation.css";
import "./product-layout.css";
import "./product-typography.css";
function OverviewRedirect() { useEffect(() => { window.location.replace("/overview"); }, []); return null; }
function Landing() { useEffect(() => { window.location.assign("/"); }, []); return null; }

// Fetch the initial screen alongside account/workspace hydration.
const pagePath = window.location.pathname.replace(/\/$/, "");
const coursesModule = pagePath === "/schedule" ? import("./CourseExplorer") : null;
const plannerModule = pagePath === "/planner" ? import("./SemesterPlanner") : null;
const Courses = lazy(() => (coursesModule ?? import("./CourseExplorer")).then(module => ({ default: module.Courses })));
const SemesterPlanner = lazy(() => plannerModule ?? import("./SemesterPlanner"));

const content = (
  <StrictMode><AuthProvider>
    <BrowserRouter>
      <CatalogProvider>
        <ScheduleProvider>
          <Suspense fallback={<PageLoading />}><Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/design-preview" element={<Landing />} />
            <Route path="/planner" element={<PageReady><SemesterPlanner /></PageReady>} />
            <Route element={<Workspace />}>
              <Route path="/overview" element={<OverviewRedirect />} />
              <Route path="/catalog-overview" element={<OverviewRedirect />} />
              <Route path="/schedule" element={<PageReady><Courses /></PageReady>} />
              <Route path="/recommendations" element={<Navigate to="/schedule" replace />} />
              <Route path="*" element={<OverviewRedirect />} />
            </Route>
          </Routes></Suspense>
          <ChatWidget />
        </ScheduleProvider>
      </CatalogProvider>
    </BrowserRouter>
  </AuthProvider></StrictMode>
);
createRoot(document.getElementById("root")!).render(content);


import "./product-surfaces.css";
