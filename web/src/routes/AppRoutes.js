import React, { useCallback, useEffect, useState } from "react";
import { Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import ErrorBoundary from "../components/ErrorBoundary";
import { useAuth } from "../auth/AuthProvider";
import { loadAnswers, saveAnswers, isOnboarded, clearOnboarding, isTutorialDone } from "../utils/userStorage";
import { completeOnboarding } from "../api/profileApi";
import GuidedTutorial from "../components/GuidedTutorial";
import Login from "../components/Login";
import Signup from "../components/Signup";
import ForgotPassword from "../components/ForgotPassword";
import ResetPassword from "../components/ResetPassword";
import Onboarding from "../components/onboarding/Onboarding";
import Dashboard from "../components/Dashboard";
import Wardrobe from "../components/Wardrobe";
import Profile from "../components/Profile";
import HistoryAnalytics from "../components/HistoryAnalytics";
import Plans from "../components/Plans";
import SavedOutfits from "../components/SavedOutfits";

function OnboardingWrapper({ onComplete, savedAnswers }) {
  const navigate = useNavigate();

  const handleComplete = useCallback(
    (finalAnswers) => {
      onComplete(finalAnswers);
      navigate("/dashboard", { replace: true });
    },
    [onComplete, navigate]
  );

  return <Onboarding onComplete={handleComplete} initialAnswers={savedAnswers} />;
}

export default function AppRoutes() {
  const location = useLocation();
  const { pathname, search } = location;
  const { user } = useAuth();
  const remoteOnboarded = Boolean(user?.onboarding_complete ?? user?.onboardingComplete);

  const [answers, setAnswers] = useState(() => loadAnswers(user));
  const [onboarded, setOnboarded] = useState(() => remoteOnboarded || isOnboarded(user));
  const [justOnboarded, setJustOnboarded] = useState(false);
  const showTutorial = justOnboarded && !isTutorialDone();

  useEffect(() => {
    setAnswers(loadAnswers(user));
    setOnboarded(remoteOnboarded || isOnboarded(user));
  }, [remoteOnboarded, user]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("resetOnboarding") !== "1") return;

    Object.keys(localStorage)
      .filter(
        (key) =>
          key.startsWith("fitgpt_onboarded_v1") ||
          key.startsWith("fitgpt_onboarding_answers_v1") ||
          key.startsWith("fitgpt_tutorial_done_v1")
      )
      .forEach((key) => localStorage.removeItem(key));

    setAnswers(null);
    setOnboarded(false);
    setJustOnboarded(false);

    const nextParams = new URLSearchParams(search);
    nextParams.delete("resetOnboarding");
    const nextUrl = nextParams.toString() ? `/?${nextParams.toString()}` : "/";
    window.location.replace(nextUrl);
  }, [search]);

  const handleOnboardingComplete = useCallback(
    async (finalAnswers) => {
      setAnswers(finalAnswers);
      saveAnswers(finalAnswers, user);
      try {
        if (user) {
          await completeOnboarding(finalAnswers, user);
        }
      } catch {}
      setOnboarded(true);
      setJustOnboarded(true);
    },
    [user]
  );

  const handleResetOnboarding = useCallback(() => {
    clearOnboarding(user);
    setAnswers(null);
    setOnboarded(false);
  }, [user]);

  const handleTutorialDismiss = useCallback(() => {
    setJustOnboarded(false);
  }, []);

  return (
    <>
      <PageTransition>
        <Routes>
          <Route
            path="/"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : onboarded ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <OnboardingWrapper
                  onComplete={handleOnboardingComplete}
                  savedAnswers={answers}
                />
              )
            }
          />

          <Route path="/auth" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/dashboard"
            element={
              <ErrorBoundary resetKey={pathname}>
                <Dashboard answers={answers} onResetOnboarding={handleResetOnboarding} />
              </ErrorBoundary>
            }
          />
          <Route
            path="/wardrobe"
            element={
              <ErrorBoundary resetKey={pathname}>
                <Wardrobe />
              </ErrorBoundary>
            }
          />
          <Route path="/favorites" element={<Navigate to="/wardrobe" replace />} />
          <Route
            path="/profile"
            element={
              <ErrorBoundary resetKey={pathname}>
                <Profile onResetOnboarding={handleResetOnboarding} />
              </ErrorBoundary>
            }
          />
          <Route
            path="/history"
            element={
              <ErrorBoundary resetKey={pathname}>
                <HistoryAnalytics />
              </ErrorBoundary>
            }
          />
          <Route
            path="/plans"
            element={
              <ErrorBoundary resetKey={pathname}>
                <Plans />
              </ErrorBoundary>
            }
          />
          <Route
            path="/saved-outfits"
            element={
              <ErrorBoundary resetKey={pathname}>
                <SavedOutfits />
              </ErrorBoundary>
            }
          />
          <Route path="/analytics" element={<Navigate to="/history?tab=analytics" replace />} />

          <Route
            path="/onboarding"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : onboarded ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <OnboardingWrapper
                  onComplete={handleOnboardingComplete}
                  savedAnswers={answers}
                />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>

      <GuidedTutorial show={!!showTutorial} onDismiss={handleTutorialDismiss} />
    </>
  );
}
