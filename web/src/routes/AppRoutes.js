import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";

import AuthPrompt from "../components/AuthPrompt";
import Login from "../components/Login";
import Signup from "../components/Signup";
import Onboarding from "../components/onboarding/Onboarding";
import Dashboard from "../components/Dashboard";
import Wardrobe from "../components/Wardrobe";
import Favorites from "../components/Favorites";
import Profile from "../components/Profile";
import History from "../components/History";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />

      <Route path="/auth" element={<AuthPrompt />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/wardrobe" element={<Wardrobe />} />
      <Route path="/favorites" element={<Favorites />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/history" element={<History />} />

      <Route path="/onboarding" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}