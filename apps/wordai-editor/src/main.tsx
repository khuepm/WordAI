import React from "react";
import ReactDOM from "react-dom/client";
import "./utils/reactInternals";
import App from "./App";
import { AppStateProvider } from "./services/stateManager";
import { AuthStateProvider } from "./services/authStore";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/variables.css";
import "./styles/base.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* AuthStateProvider wraps the entire app so auth state is available
          to all components. Requirements: 13.1, 13.2 */}
      <AuthStateProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </AuthStateProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
