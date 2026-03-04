import React, { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { loginWithEmail, getMe } from "../api/authApi";
import { useAuth } from "../auth/AuthProvider";
import { migrateGuestData, clearGuestData } from "../utils/userStorage";

export default function Login() {
  const navigate = useNavigate();
  const auth = useAuth();
  const setUser = auth?.setUser;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const emailOk = useMemo(() => {
    const e = email.trim();
    if (!e) return false;
    return e.includes("@") && e.includes(".");
  }, [email]);

  const canSubmit = emailOk && password.trim() !== "";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please enter a valid email and password.");
      return;
    }

    setIsLoading(true);

    try {
      await loginWithEmail(email.trim(), password);

      try {
        const me = await getMe();
        if (me) {
          migrateGuestData(me);
          clearGuestData();
        }
        if (typeof setUser === "function") setUser(me);
      } catch {}

      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror")) {
        setError("Can't reach the server. Check your connection or try again later.");
      } else {
        setError(msg || "Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="brandBar">
        <div className="brandLeft">
          <div className="brandMark">
            <img className="brandLogo" src="/officialLogo.png" alt="FitGPT official logo" />
          </div>
        </div>
      </div>

      <div className="card authCard">
        <div className="authHeader">
          <div>
            <h1 className="authTitle">Sign in</h1>
            <p className="authSub">Welcome back. Let's get you styled.</p>
          </div>

          <button type="button" className="btn" onClick={() => navigate("/auth")}>
            Back
          </button>
        </div>

        <form onSubmit={onSubmit} className="authForm">
          <label className="authFormGroup">
            Email
            <input
              className="wardrobeInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="email"
            />
          </label>

          <label className="authFormGroup">
            Password
            <div className="authPasswordRow">
              <input
                className="wardrobeInput"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="wardrobeIconBtn authShowBtn"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div className="authForgotRow">
            <button
              type="button"
              className="linkBtn"
              onClick={() => navigate("/forgot-password")}
            >
              Forgot password?
            </button>
          </div>

          {error ? <div className="authError">{error}</div> : null}

          <button
            type="submit"
            className="btn primary authSubmit"
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>

          <div className="authFooter">
            <span className="heroSub">New here?</span>{" "}
            <NavLink to="/signup" className="linkLike">
              Create an account
            </NavLink>
          </div>
        </form>
      </div>
    </div>
  );
}
