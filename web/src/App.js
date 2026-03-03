// web/src/App.js
import React from "react";
import "./App.css";

import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./auth/AuthProvider";

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}