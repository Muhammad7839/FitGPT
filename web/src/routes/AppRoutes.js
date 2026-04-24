import React, { useCallback, useEffect, useState } from "react";
import { Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import ErrorBoundary from "../components/ErrorBoundary";
import { useAuth } from "../auth/AuthProvider";
import {
  loadAnswers,
  saveAnswers,
  isOnboarded,
  clearOnboarding,
  isTutorialDone,
  clearTutorialDone,
  isSplashSeen,
  markSplashSeen,
  setGuestMode,
} from "../utils/userStorage";
import { completeOnboarding } from "../api/profileApi";
import {
  getGuestProtectedRedirect,
  getStartupStage,
  isGuestRouteAllowed,
  shouldShowTutorial,
} from "../utils/firstLaunchFlow";
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
import OutfitBuilder from "../components/OutfitBuilder";

function OnboardingWrapper({
  onComplete,
  savedAnswers,
  showSplashOnLoad = true,
  onSplashComplete,
}) {
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
      showSplashOnLoad={showSplashOnLoad}
      onSplashComplete={onSplashComplete}
    />
  );
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { user } = useAuth();

  if (!user) {
    return <Navigate to={getGuestProtectedRedirect(location.pathname)} replace />;
  }

  return children;
}

export default function AppRoutes() {
  const location = useLocation();
  const { pathname, search, state } = location;
  const { user, isChecking } = useAuth();
  const navigate = useNavigate();
  const remoteOnboarded = Boolean(user?.onboarding_complete ?? user?.onboardingComplete);

  const [answers, setAnswers] = useState(() => loadAnswers(user));
  const [onboarded, setOnboarded] = useState(() => remoteOnboarded || isOnboarded(user));
  const [justOnboarded, setJustOnboarded] = useState(false);
  const [splashSeen, setSplashSeen] = useState(() => isSplashSeen());
  const [tutorialDone, setTutorialDone] = useState(() => isTutorialDone());
  const tutorialEligiblePath = pathname === "/dashboard" || pathname === "/wardrobe";
  const showTutorial =
    tutorialEligiblePath &&
    shouldShowTutorial({
      user,
      onboarded,
      tutorialDone,
      justOnboarded,
    });

  useEffect(() => {
    setAnswers(loadAnswers(user));
    setOnboarded(remoteOnboarded || isOnboarded(user));
    setTutorialDone(isTutorialDone());
  }, [remoteOnboarded, user]);

  useEffect(() => {
    if (user) {
      setGuestMode(false);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("resetOnboarding") !== "1") return;

    Object.keys(localStorage)
      .filter(
        (key) =>
          key.startsWith("fitgpt_onboarded_v1") ||
          key.startsWith("fitgpt_onboarding_complete") ||
          key.startsWith("fitgpt_onboarding_answers_v1") ||
          key.startsWith("fitgpt_tutorial_done_v1") ||
          key.startsWith("fitgpt_tutorial_complete") ||
          key.startsWith("fitgpt_splash_seen") ||
          key.startsWith("fitgpt_guest_mode")
      )
      .forEach((key) => localStorage.removeItem(key));

    setAnswers(null);
    setOnboarded(false);
    setJustOnboarded(false);
    setSplashSeen(false);
    setTutorialDone(false);

    const nextParams = new URLSearchParams(search);
    nextParams.delete("resetOnboarding");
    const nextUrl = nextParams.toString() ? `/?${nextParams.toString()}` : "/";
    navigate(nextUrl, { replace: true, state: { skipOnboardingSplash: true } });
  }, [navigate, search]);

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
      setTutorialDone(isTutorialDone());
    },
    [user]
  );

  const handleResetOnboarding = useCallback(() => {
    clearOnboarding(user);
    clearTutorialDone();
    setAnswers(null);
    setOnboarded(false);
    setJustOnboarded(false);
    setTutorialDone(false);
    navigate("/", { replace: true, state: { skipOnboardingSplash: true } });
  }, [navigate, user]);

  const handleSplashComplete = useCallback(() => {
    markSplashSeen();
    setSplashSeen(true);
  }, []);

  const handleTutorialDismiss = useCallback(() => {
    setGuestMode(!user);
    setTutorialDone(true);
    setJustOnboarded(false);
  }, [user]);

  if (isChecking) return null;

  const startupStage = getStartupStage({
    user,
    isChecking,
    onboarded,
    tutorialDone,
    splashSeen,
  });

  return (
    <>
      <PageTransition>
        <Routes>
          <Route
            path="/"
            element={
              startupStage === "guest-home" ||
              startupStage === "tutorial" ||
              startupStage === "signed-in-home" ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <OnboardingWrapper
                  onComplete={handleOnboardingComplete}
                  savedAnswers={answers}
                  showSplashOnLoad={!user && !state?.skipOnboardingSplash && !splashSeen}
                  onSplashComplete={handleSplashComplete}
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
              <ProtectedRoute>
                <ErrorBoundary resetKey={pathname}>
                  <Profile onResetOnboarding={handleResetOnboarding} />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <ErrorBoundary resetKey={pathname}>
                  <HistoryAnalytics />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans"
            element={
              <ProtectedRoute>
                <ErrorBoundary resetKey={pathname}>
                  <Plans />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved-outfits"
            element={
              <ProtectedRoute>
                <ErrorBoundary resetKey={pathname}>
                  <SavedOutfits />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/builder"
            element={
              <ProtectedRoute>
                <ErrorBoundary resetKey={pathname}>
                  <OutfitBuilder />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              user ? (
                <Navigate to="/history?tab=analytics" replace />
              ) : (
                <Navigate to={getGuestProtectedRedirect("/analytics")} replace />
              )
            }
          />

          <Route
            path="/onboarding"
            element={
              onboarded ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <OnboardingWrapper
                  onComplete={handleOnboardingComplete}
                  savedAnswers={answers}
                  showSplashOnLoad={!user && !state?.skipOnboardingSplash && !splashSeen}
                  onSplashComplete={handleSplashComplete}
                />
              )
            }
          />
          <Route
            path="*"
            element={
              !user && !isGuestRouteAllowed(pathname) ? (
                <Navigate to={getGuestProtectedRedirect(pathname)} replace />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </PageTransition>

      <GuidedTutorial
        show={!!showTutorial}
        mode={user ? "full" : "guest"}
        onDismiss={handleTutorialDismiss}
      />
    </>
  );
}
