import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyMark36TabTitle } from "./utils/tabTitle";
import "./styles.css";

applyMark36TabTitle();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
