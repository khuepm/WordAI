/**
 * Entry point for the Preferences window (separate OS window).
 * This renders the PreferencesDialog content directly without the modal overlay,
 * since it's already in its own native window.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import "./utils/reactInternals";
import { PreferencesWindow } from "./components/PreferencesWindow";
import { AuthStateProvider } from "./services/authStore";
import "./styles/variables.css";
import "./styles/base.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthStateProvider>
      <PreferencesWindow />
    </AuthStateProvider>
  </React.StrictMode>,
);
