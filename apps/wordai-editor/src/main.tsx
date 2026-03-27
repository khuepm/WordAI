import React from "react";
import ReactDOM from "react-dom/client";
import "./utils/reactInternals";
import App from "./App";
import { AppStateProvider } from "./services/stateManager";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/variables.css";
import "./styles/base.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
