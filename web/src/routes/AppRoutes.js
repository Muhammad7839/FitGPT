import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Route, Routes, Navigate, useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import ErrorBoundary from "../components/ErrorBoundary";
import { useAuth } from "../auth/AuthProvider";
import { loadAnswers, saveAnswers, isOnboarded, clearOnboarding, isTutorialDone } from "../utils/userStorage";
import GuidedTutorial from "../components/GuidedTutorial";

// Light routes — eagerly loaded (auth flow, small components)
import Login from "../components/Login";
import Signup from "../components/Signup";
import ForgotPassword from "../components/ForgotPassword";
import ResetPassword from "../components/ResetPassword";

// Heavy routes — lazy loaded
const Onboarding = lazy(() => import("../components/onboarding/Onboarding"));
const Dashboard = lazy(() => import("../components/Dashboard"));
const Wardrobe = lazy(() => import("../components/Wardrobe"));

const Profile = lazy(() => import("../components/Profile"));
const HistoryAnalytics = lazy(() => import("../components/HistoryAnalytics"));
const Plans = lazy(() => import("../components/Plans"));
const SavedOutfits = lazy(() => import("../components/SavedOutfits"));


function RouteSpinner() {
  return (
    <div className="routeSpinner">
      <div className="routeSpinnerDot" />
      <div className="routeSpinnerDot" />
      <div className="routeSpinnerDot" />
    </div>
  );
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

  const [justOnboarded, setJustOnboarded] = useState(false);

  const showTutorial = justOnboarded && !isTutorialDone();

  const handleOnboardingComplete = useCallback((finalAnswers) => {
    setAnswers(finalAnswers);
    saveAnswers(finalAnswers, user);
    setOnboarded(true);
    setJustOnboarded(true);
  }, [user]);

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
      <ErrorBoundary>
      <Suspense fallback={<RouteSpinner />}>
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

          <Route path="/auth" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/dashboard"
            element={
              <ErrorBoundary>
                <Dashboard
                  answers={answers}
                  onResetOnboarding={handleResetOnboarding}
                />
              </ErrorBoundary>
            }
          />
          <Route path="/wardrobe" element={<ErrorBoundary><Wardrobe /></ErrorBoundary>} />
          <Route path="/favorites" element={<Navigate to="/wardrobe" replace />} />
          <Route path="/profile" element={<ErrorBoundary><Profile onResetOnboarding={handleResetOnboarding} /></ErrorBoundary>} />
          <Route path="/history" element={<ErrorBoundary><HistoryAnalytics /></ErrorBoundary>} />
          <Route path="/plans" element={<ErrorBoundary><Plans /></ErrorBoundary>} />
          <Route path="/saved-outfits" element={<ErrorBoundary><SavedOutfits /></ErrorBoundary>} />
          <Route path="/analytics" element={<Navigate to="/history?tab=analytics" replace />} />


          <Route path="/onboarding" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
      </Suspense>
      </ErrorBoundary>

      <GuidedTutorial show={!!showTutorial} onDismiss={handleTutorialDismiss} />

    </>
  );
}
