import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StatsigProvider } from "@statsig/react-bindings";
import App from "./App";
import { applyMark36TabTitle } from "./utils/tabTitle";
import { statsigClient } from "./config/statsig";
import "./styles.css";

applyMark36TabTitle();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StatsigProvider client={statsigClient}>
      <App />
    </StatsigProvider>
  </StrictMode>
);
