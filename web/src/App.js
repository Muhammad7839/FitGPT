// web/src/App.js
import "./App.css";
import React, { useEffect, useState } from "react";
import Onboarding from "./components/onboarding/Onboarding";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";
import Wardrobe from "./components/Wardrobe";
import Favorites from "./components/Favorites";
import Profile from "./components/Profile";

const LS_KEY = "fitgpt_onboarding_v1";
const AUTH_KEY = "fitgpt_auth_v1";
const THEME_KEY = "fitgpt_theme_v1";
const DEFAULT_BODY_TYPE = "unspecified";

const TABS = [
  { id: "today", label: "Today" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "favorites", label: "Favorites" },
  { id: "profile", label: "Profile" },
];

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
  const [auth, setAuth] = useState({ loggedIn: false, provider: null, name: "", email: "" });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState("today");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");

  const [onboardingDraft, setOnboardingDraft] = useState({
    step: 1,
    answers: { style: [], dressFor: [], bodyType: null },
  });

  // Restore auth from localStorage
  useEffect(() => {
    const storedAuth = localStorage.getItem(AUTH_KEY);
    const parsedAuth = storedAuth ? safeParse(storedAuth) : null;

    if (parsedAuth?.loggedIn) {
      setAuth({
        loggedIn: true,
        provider: parsedAuth.provider ?? "guest",
        name: parsedAuth.name ?? "",
        email: parsedAuth.email ?? "",
      });
    }
  }, []);

  // Restore onboarding from localStorage
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

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const handleLogin = ({ provider, name, email }) => {
    const payload = { loggedIn: true, provider, name: name ?? "", email: email ?? "" };
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
    setAuth(payload);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuth({ loggedIn: false, provider: null, name: "", email: "" });
    setActiveTab("today");
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
    setActiveTab("today");
  };

  // ── Auth screens ──────────────────────────────────────────────
  if (!auth.loggedIn) {
    if (showRegister) {
      return (
        <div className="app">
          <Register
            onRegister={handleLogin}
            onSwitchToLogin={() => setShowRegister(false)}
          />
        </div>
      );
    }
    return (
      <div className="app">
        <Login
          onLogin={handleLogin}
          onSwitchToRegister={() => setShowRegister(true)}
        />
      </div>
    );
  }

  // ── Onboarding ────────────────────────────────────────────────
  if (!hasCompletedOnboarding) {
    return (
      <div className="app">
        <Onboarding
          onComplete={handleOnboardingComplete}
          initialStep={onboardingDraft.step}
          initialAnswers={onboardingDraft.answers}
          onProgress={handleOnboardingProgress}
        />
      </div>
    );
  }

  // ── Main app with tab navigation ─────────────────────────────
  const renderTab = () => {
    switch (activeTab) {
      case "wardrobe":
        return <Wardrobe />;
      case "favorites":
        return <Favorites />;
      case "profile":
        return (
          <Profile
            userName={auth.name}
            userEmail={auth.email}
            userProvider={auth.provider}
            answers={onboardingDraft.answers}
            onResetOnboarding={handleResetOnboarding}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        );
      default:
        return (
          <Dashboard
            answers={onboardingDraft.answers}
            userName={auth.name}
            onNavigate={setActiveTab}
          />
        );
    }
  };

  return (
    <div className="app">
      <div className="onboarding onboardingPage">
        {renderTab()}

        <nav className="dashBottomNav" aria-label="Main navigation">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`dashNavItem ${activeTab === tab.id ? "dashNavActive" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default App;
