import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./dashboard.tsx";
import "./styles.css";

const root = document.querySelector("#root");
if (!(root instanceof HTMLElement)) throw new Error("The dashboard root is missing.");

createRoot(root).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
