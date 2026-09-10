import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import App from "./App";
import { CatalogProvider } from "./CatalogContext";
import PrerequisiteChart from "./PrerequisiteChart";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <CatalogProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/prerequisite-chart" element={<PrerequisiteChart />} />
        </Routes>
      </CatalogProvider>
    </BrowserRouter>
  </StrictMode>,
);
