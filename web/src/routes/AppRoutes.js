import React, { useCallback, useEffect, useState } from "react";
import { Route, Routes, Navigate, useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../auth/AuthProvider";
import { userKey, ONBOARDING_ANSWERS_KEY, ONBOARDED_KEY } from "../utils/userStorage";

import AuthPrompt from "../components/AuthPrompt";
import Login from "../components/Login";
import Signup from "../components/Signup";
import Onboarding from "../components/onboarding/Onboarding";
import Dashboard from "../components/Dashboard";
import Wardrobe from "../components/Wardrobe";
import Favorites from "../components/Favorites";
import Profile from "../components/Profile";
import History from "../components/History";
import Plans from "../components/Plans";

function loadAnswers(user) {
  try {
    const key = userKey(ONBOARDING_ANSWERS_KEY, user);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAnswers(answers, user) {
  try {
    localStorage.setItem(userKey(ONBOARDING_ANSWERS_KEY, user), JSON.stringify(answers));
    localStorage.setItem(userKey(ONBOARDED_KEY, user), "1");
  } catch {}
}

function isOnboarded(user) {
  return localStorage.getItem(userKey(ONBOARDED_KEY, user)) === "1";
}

function clearOnboarding(user) {
  localStorage.removeItem(userKey(ONBOARDING_ANSWERS_KEY, user));
  localStorage.removeItem(userKey(ONBOARDED_KEY, user));
}

function OnboardingWrapper({ onComplete, savedAnswers }) {
  const navigate = useNavigate();

  const handleComplete = useCallback(
    (finalAnswers) => {
      onComplete(finalAnswers);
      navigate("/dashboard", { replace: true });
    },
    [onComplete, navigate]
  );

  return (
    <Onboarding
      onComplete={handleComplete}
      initialAnswers={savedAnswers}
    />
  );
}

export default function AppRoutes() {
  const { user } = useAuth();

  const [answers, setAnswers] = useState(() => loadAnswers(user));
  const [onboarded, setOnboarded] = useState(() => isOnboarded(user));

  // Re-evaluate onboarding state when user changes (login/logout)
  useEffect(() => {
    setAnswers(loadAnswers(user));
    setOnboarded(isOnboarded(user));
  }, [user]);

  const handleOnboardingComplete = useCallback((finalAnswers) => {
    setAnswers(finalAnswers);
    saveAnswers(finalAnswers, user);
    setOnboarded(true);
  }, [user]);

  const handleResetOnboarding = useCallback(() => {
    clearOnboarding(user);
    setAnswers(null);
    setOnboarded(false);
  }, [user]);

  return (
    <PageTransition>
      <Routes>
        <Route
          path="/"
          element={
            onboarded ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <OnboardingWrapper
                onComplete={handleOnboardingComplete}
                savedAnswers={answers}
              />
            )
          }
        />

        <Route path="/auth" element={<AuthPrompt />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route
          path="/dashboard"
          element={
            <Dashboard
              answers={answers}
              onResetOnboarding={handleResetOnboarding}
            />
          }
        />
        <Route path="/wardrobe" element={<Wardrobe />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/profile" element={<Profile onResetOnboarding={handleResetOnboarding} />} />
        <Route path="/history" element={<History />} />
        <Route path="/plans" element={<Plans />} />

        <Route path="/onboarding" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageTransition>
  );
}
