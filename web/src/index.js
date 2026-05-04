import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

const sentryDsn = (process.env.REACT_APP_SENTRY_DSN || "").trim();
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div>Something went wrong. Refresh the page.</div>}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
