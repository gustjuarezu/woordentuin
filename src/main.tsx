import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles/tokens.css";

// HashRouter: works on any static host (GitHub Pages included) with no
// rewrite rules, and inside sandboxed iframes.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

registerSW({ immediate: true });
