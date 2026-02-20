import React, { useCallback, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import Onboarding from "../components/onboarding/Onboarding";
import Dashboard from "../components/Dashboard";
import Wardrobe from "../components/Wardrobe";
import Profile from "../components/Profile";

const LS_KEY = "fitgpt_onboarding_v1";
const AUTH_KEY = "fitgpt_auth_mode_v1";
const DEFAULT_BODY_TYPE = "unspecified";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeAnswers(raw) {
  return {
    style: Array.isArray(raw?.style) ? raw.style : [],
    dressFor: Array.isArray(raw?.dressFor) ? raw.dressFor : [],
    bodyType: raw?.bodyType ?? null,
  };
}

function finalizeAnswers(raw) {
  const normalized = normalizeAnswers(raw);
  return { ...normalized, bodyType: normalized.bodyType ?? DEFAULT_BODY_TYPE };
}

function clampStep(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 1;
  return Math.min(Math.max(num, 1), 5);
}

function readOnboardingState() {
  const raw = localStorage.getItem(LS_KEY);
  const parsed = raw ? safeParse(raw) : null;

  if (parsed?.completed === true) {
    return { completed: true, answers: finalizeAnswers(parsed.answers), step: 1 };
  }

  if (parsed?.completed === false) {
    const step = clampStep(parsed.step);
    return { completed: false, answers: normalizeAnswers(parsed.answers), step };
  }

  return { completed: false, answers: normalizeAnswers({}), step: 1 };
}

function readAuthMode() {
  const mode = localStorage.getItem(AUTH_KEY);
  if (mode === "google") return "google";
  if (mode === "email") return "email";
  return "guest";
}

function writeAuthMode(mode) {
  const v = mode === "google" ? "google" : mode === "email" ? "email" : "guest";
  localStorage.setItem(AUTH_KEY, v);
  return v;
}

function Favorites() {
  return (
    <div className="onboarding onboardingPage">
      <div className="card dashWide" style={{ marginTop: 12 }}>
        <h1 className="heroTitle" style={{ fontSize: 34 }}>
          Favorites
        </h1>
        <p className="heroSub">Coming next.</p>
      </div>
    </div>
  );
}

export default function AppRoutes() {
  const navigate = useNavigate();

  const [onboarding, setOnboarding] = useState(() => readOnboardingState());
  const [authMode, setAuthMode] = useState(() => readAuthMode());

  const home = useMemo(() => {
    return onboarding.completed ? "/dashboard" : "/onboarding";
  }, [onboarding.completed]);

  const handleOnboardingProgress = useCallback((draft) => {
    const step = clampStep(draft?.step);
    const answers = normalizeAnswers(draft?.answers);

    const next = { completed: false, step, answers };
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ ...next, savedAt: Date.now() })
    );
    setOnboarding(next);
  }, []);

  const handleOnboardingComplete = useCallback(
    (answers) => {
      const finalized = finalizeAnswers(answers);
      const next = { completed: true, step: 1, answers: finalized };

      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ completed: true, answers: finalized, savedAt: Date.now() })
      );

      setOnboarding(next);
      navigate("/dashboard", { replace: true });
    },
    [navigate]
  );

  const handleResetOnboarding = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    const next = { completed: false, step: 1, answers: normalizeAnswers({}) };
    setOnboarding(next);
    navigate("/onboarding", { replace: true });
  }, [navigate]);

  const handleSignIn = useCallback(() => {
    navigate("/profile");
  }, [navigate]);

  const handleSignedIn = useCallback(
    (mode) => {
      const stored = writeAuthMode(mode);
      setAuthMode(stored);
      navigate("/dashboard", { replace: true });
    },
    [navigate]
  );

  return (
    <Routes>
      <Route path="/" element={<Navigate to={home} replace />} />

      <Route
        path="/onboarding"
        element={
          onboarding.completed ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Onboarding
              onComplete={handleOnboardingComplete}
              initialStep={onboarding.step}
              initialAnswers={onboarding.answers}
              onProgress={handleOnboardingProgress}
            />
          )
        }
      />

      <Route
        path="/dashboard"
        element={
          onboarding.completed ? (
            <Dashboard
              answers={onboarding.answers}
              onResetOnboarding={handleResetOnboarding}
              authMode={authMode}
              onSignIn={handleSignIn}
            />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />

      <Route
        path="/wardrobe"
        element={
          onboarding.completed ? (
            <Wardrobe answers={onboarding.answers} />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />

      <Route
        path="/favorites"
        element={
          onboarding.completed ? <Favorites /> : <Navigate to="/onboarding" replace />
        }
      />

      <Route
        path="/profile"
        element={
          onboarding.completed ? (
            <Profile onSignedIn={handleSignedIn} />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />

      <Route path="/login" element={<Navigate to={home} replace />} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}