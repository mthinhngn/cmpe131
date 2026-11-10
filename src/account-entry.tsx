import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./AuthContext";
import Account from "./Account";
document.body.classList.add("account-document");
document.title = "Your account · Course Radar";
createRoot(document.getElementById("root")!).render(<StrictMode><AuthProvider><Account /></AuthProvider></StrictMode>);

import "./product-surfaces.css";
