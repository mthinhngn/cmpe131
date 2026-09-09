import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles.css";
import App from "./App";
import { StudentPlanProvider } from "./StudentPlanContext";
import { CatalogProvider } from "./CatalogContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <CatalogProvider><StudentPlanProvider><App /></StudentPlanProvider></CatalogProvider>
    </BrowserRouter>
  </StrictMode>,
);
