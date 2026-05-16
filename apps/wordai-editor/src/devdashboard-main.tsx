/**
 * Entry point for the Dev Dashboard window (separate OS window).
 * Renders the DevDashboard content directly without the overlay,
 * since it's already in its own native window.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import "./utils/reactInternals";
import { DevDashboardWindow } from "./components/DevDashboardWindow";
import { notificationRegistry } from "./services/notificationRegistry";
import "./styles/variables.css";
import "./styles/base.css";

// Initialize notification registry so DevDashboard can see policies
void notificationRegistry.initialize();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DevDashboardWindow />
  </React.StrictMode>,
);
