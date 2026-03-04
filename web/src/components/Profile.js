// web/src/components/Profile.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { logout } from "../api/authApi";
import { userKey, ONBOARDING_ANSWERS_KEY } from "../utils/userStorage";

const DEMO_AUTH_KEY = "fitgpt_demo_auth_v1";

const STYLE_OPTIONS = [
  "Casual", "Professional", "Streetwear", "Athletic", "Minimalist", "Formal",
];

const COMFORT_OPTIONS = ["Balanced", "Relaxed", "Fitted", "Stretchy", "Layered"];

const DRESS_FOR_OPTIONS = [
  "Class / Campus", "Work", "Gym", "Date Night", "Errands", "Party / Event", "Travel",
];

const BODY_TYPE_OPTIONS = [
  { id: "pear", label: "Pear", note: "Balance with structure on top." },
  { id: "apple", label: "Apple", note: "Comfort + clean lines through the middle." },
  { id: "hourglass", label: "Hourglass", note: "Highlight waist, keep proportions balanced." },
  { id: "rectangle", label: "Rectangle", note: "Add shape with layers and contrast." },
  { id: "inverted", label: "Inverted Triangle", note: "Balance shoulders with volume below." },
];

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readDemoAuth() {
  const raw = localStorage.getItem(DEMO_AUTH_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : null;
}

function writeDemoAuth(objOrNull) {
  if (!objOrNull) localStorage.removeItem(DEMO_AUTH_KEY);
  else localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(objOrNull));
}


export default function Profile({ onResetOnboarding = () => {} }) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const demoUser = useMemo(() => readDemoAuth(), []);
  const effectiveUser = user || demoUser;

  const email = effectiveUser?.email || effectiveUser?.user?.email || effectiveUser?.demoEmail || "";

  // ── Style preferences (loaded from onboarding answers) ──
  const prefsKey = useMemo(() => userKey(ONBOARDING_ANSWERS_KEY, effectiveUser), [effectiveUser]);

  const loadPrefs = useCallback(() => {
    try {
      const raw = localStorage.getItem(prefsKey);
      if (!raw) return { style: [], comfort: [], dressFor: [], bodyType: null };
      const p = JSON.parse(raw);
      return {
        style: Array.isArray(p?.style) ? p.style : [],
        comfort: Array.isArray(p?.comfort) ? p.comfort : [],
        dressFor: Array.isArray(p?.dressFor) ? p.dressFor : [],
        bodyType: p?.bodyType ?? null,
      };
    } catch {
      return { style: [], comfort: [], dressFor: [], bodyType: null };
    }
  }, [prefsKey]);

  const [prefs, setPrefs] = useState(loadPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, [loadPrefs]);

  const updatePrefs = useCallback((updater) => {
    setPrefs((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem(prefsKey, JSON.stringify(next));
      } catch {}
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 1500);
      return next;
    });
  }, [prefsKey]);

  const togglePref = useCallback((key, value) => {
    updatePrefs((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      const exists = list.includes(value);
      return { ...prev, [key]: exists ? list.filter((v) => v !== value) : [...list, value] };
    });
  }, [updatePrefs]);

  const setBodyType = useCallback((id) => {
    updatePrefs((prev) => ({ ...prev, bodyType: prev.bodyType === id ? null : id }));
  }, [updatePrefs]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore if backend is offline
    } finally {
      if (typeof setUser === "function") setUser(null);
      writeDemoAuth(null);
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="onboarding onboardingPage profilePage">
      <div className="card dashWide profileCard">
        <div className="profileHeaderRow">
          <div>
            <h1 className="heroTitle profileTitle">Profile</h1>
            <p className="heroSub profileSub">Manage your account and preferences.</p>
          </div>

          <div className="profileHeaderActions">
            <NavLink to="/dashboard" className="btn">
              Back
            </NavLink>
          </div>
        </div>

        {effectiveUser ? (
          <>
            <div className="noteBox" style={{ marginTop: 16 }}>
              {email ? `Signed in as ${email}` : "Signed in"}
            </div>

            <div className="loginButtons" style={{ marginTop: 18 }}>
              <button className="btn primary" type="button" onClick={handleLogout}>
                Logout
              </button>
              <button className="btn" type="button" onClick={() => navigate("/dashboard")}>
                Dashboard
              </button>
              <button className="btn" type="button" onClick={() => navigate("/history")}>
                Outfit history
              </button>
              <button className="btn" type="button" onClick={() => { onResetOnboarding(); navigate("/"); }}>
                Redo Onboarding
              </button>
            </div>

            {/* ── Style Preferences ── */}
            <div className="profileSection">
              <div className="profileSectionTop">
                <div className="dashCardTitle" style={{ marginBottom: 0 }}>
                  Style Preferences
                </div>
                {prefsSaved && (
                  <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>Saved</span>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="profilePrefLabel">Style</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.style.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("style", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Comfort</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {COMFORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.comfort.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("comfort", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Dressing For</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {DRESS_FOR_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.dressFor.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("dressFor", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Body Type</div>
                <div className="optionGrid" style={{ marginTop: 8 }}>
                  {BODY_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={prefs.bodyType === opt.id ? "optionCard selected" : "optionCard"}
                      onClick={() => setBodyType(opt.id)}
                    >
                      <div className="optionTitle">{opt.label}</div>
                      <div className="optionNote">{opt.note}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </>
        ) : (
          <>
            <div className="noteBox" style={{ marginTop: 16 }}>
              Sign in to save outfits and access your profile.
            </div>

            <div className="loginButtons" style={{ marginTop: 18 }}>
              <button className="btn primary" type="button" onClick={() => navigate("/login")}>
                Sign in
              </button>
              <button className="btn" type="button" onClick={() => navigate("/dashboard")}>
                Continue
              </button>
              <button className="btn" type="button" onClick={() => navigate("/history")}>
                Outfit history
              </button>
              <button className="btn" type="button" onClick={() => { onResetOnboarding(); navigate("/"); }}>
                Redo Onboarding
              </button>
            </div>

            {/* ── Style Preferences (guest) ── */}
            <div className="profileSection">
              <div className="profileSectionTop">
                <div className="dashCardTitle" style={{ marginBottom: 0 }}>
                  Style Preferences
                </div>
                {prefsSaved && (
                  <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>Saved</span>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="profilePrefLabel">Style</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.style.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("style", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Comfort</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {COMFORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.comfort.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("comfort", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Dressing For</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {DRESS_FOR_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.dressFor.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("dressFor", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Body Type</div>
                <div className="optionGrid" style={{ marginTop: 8 }}>
                  {BODY_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={prefs.bodyType === opt.id ? "optionCard selected" : "optionCard"}
                      onClick={() => setBodyType(opt.id)}
                    >
                      <div className="optionTitle">{opt.label}</div>
                      <div className="optionNote">{opt.note}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}