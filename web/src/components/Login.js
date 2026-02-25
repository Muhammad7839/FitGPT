// web/src/components/Login.js
import React, { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

// Optional backend hook-up (turn on when your teammate confirms payloads)
// import { login } from "../api/authApi";

export default function Login() {
  const navigate = useNavigate();

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
      // UI-only flow for now
      await new Promise((r) => setTimeout(r, 350));

      // When backend is ready, replace the UI-only block with:
      // await login({ email: email.trim(), password });

      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
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

      <div className="card dashWide" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 className="heroTitle" style={{ fontSize: 34, marginBottom: 6 }}>
              Sign in
            </h1>
            <p className="heroSub" style={{ marginTop: 0 }}>
              Welcome back. Let’s get you styled.
            </p>
          </div>

          <button type="button" className="btnSecondary" onClick={() => navigate("/auth")}>
            Back
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 18 }}>
          <label className="wardrobeLabel">
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

          <label className="wardrobeLabel" style={{ marginTop: 12 }}>
            Password
            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="wardrobeInput"
                style={{ flex: 1 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="wardrobeIconBtn"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btnSecondary"
              onClick={() => setError("Password reset UI coming next.")}
            >
              Forgot password?
            </button>
          </div>

          {error ? <div className="wardrobeFormError">{error}</div> : null}

          <button
            type="submit"
            className="btnPrimary"
            style={{ width: "100%", marginTop: 14 }}
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>

          <div style={{ marginTop: 14, textAlign: "center" }}>
            <span className="heroSub" style={{ fontSize: 14 }}>
              New here?
            </span>{" "}
            <NavLink to="/signup" className="linkLike">
              Create an account
            </NavLink>
          </div>
        </form>
      </div>
    </div>
  );
}