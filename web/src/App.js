// web/src/App.js
import "./App.css";
import React, { useEffect, useState } from "react";
import Onboarding from "./components/onboarding/Onboarding";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";

const LS_KEY = "fitgpt_onboarding_v1";
const AUTH_KEY = "fitgpt_auth_v1";
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
  return {
    ...normalized,
    bodyType: normalized.bodyType ?? DEFAULT_BODY_TYPE,
  };
}

function App() {
  const [auth, setAuth] = useState({ loggedIn: false, provider: null, name: "" });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const [onboardingDraft, setOnboardingDraft] = useState({
    step: 1,
    answers: { style: [], dressFor: [], bodyType: null },
  });

  useEffect(() => {
    const storedAuth = localStorage.getItem(AUTH_KEY);
    const parsedAuth = storedAuth ? safeParse(storedAuth) : null;

    if (parsedAuth?.loggedIn) {
      setAuth({
        loggedIn: true,
        provider: parsedAuth.provider ?? "guest",
        name: parsedAuth.name ?? "",
      });
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return;

    const parsed = safeParse(stored);

    if (parsed?.completed === true) {
      const finalized = finalizeAnswers(parsed.answers);

      setHasCompletedOnboarding(true);
      setOnboardingDraft({ step: 1, answers: finalized });

      if (parsed?.answers?.bodyType == null) {
        const upgradedPayload = {
          completed: true,
          answers: finalized,
          savedAt: parsed?.savedAt ?? Date.now(),
        };
        localStorage.setItem(LS_KEY, JSON.stringify(upgradedPayload));
      }
      return;
    }

    if (parsed?.completed === false) {
      const step = Number.isFinite(Number(parsed.step)) ? Number(parsed.step) : 1;
      setOnboardingDraft({
        step: Math.min(Math.max(step, 1), 5),
        answers: normalizeAnswers(parsed.answers),
      });
      return;
    }

    if (stored === "true") setHasCompletedOnboarding(true);
  }, []);

  const handleLogin = ({ provider, name }) => {
    const payload = { loggedIn: true, provider, name: name ?? "" };
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
    setAuth(payload);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuth({ loggedIn: false, provider: null, name: "" });
  };

  const handleOnboardingProgress = (draft) => {
    const step = Number.isFinite(Number(draft?.step)) ? Number(draft.step) : 1;
    const answers = normalizeAnswers(draft?.answers);

    const payload = {
      completed: false,
      step: Math.min(Math.max(step, 1), 5),
      answers,
      savedAt: Date.now(),
    };

    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    setOnboardingDraft({ step: payload.step, answers: payload.answers });
  };

  const handleOnboardingComplete = (answers) => {
    const finalized = finalizeAnswers(answers);

    const payload = {
      completed: true,
      answers: finalized,
      savedAt: Date.now(),
    };

    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    setOnboardingDraft({ step: 1, answers: finalized });
    setHasCompletedOnboarding(true);
  };

  const handleResetOnboarding = () => {
    localStorage.removeItem(LS_KEY);
    setHasCompletedOnboarding(false);
    setOnboardingDraft({
      step: 1,
      answers: { style: [], dressFor: [], bodyType: null },
    });
  };

  if (!auth.loggedIn) {
    return (
      <div className="app">
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      {hasCompletedOnboarding ? (
        <Dashboard
          answers={onboardingDraft.answers}
          onResetOnboarding={handleResetOnboarding}
          onLogout={handleLogout}
          userName={auth.name}
        />
      ) : (
        <Onboarding
          onComplete={handleOnboardingComplete}
          initialStep={onboardingDraft.step}
          initialAnswers={onboardingDraft.answers}
          onProgress={handleOnboardingProgress}
        />
      )}
    </div>
  );
}

export default App;
