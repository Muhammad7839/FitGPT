import React, { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { registerWithEmail, getMe } from "../api/authApi";
import { useAuth } from "../auth/AuthProvider";
import { migrateGuestData, clearGuestData } from "../utils/userStorage";
import GoogleSignInButton from "./GoogleSignInButton";

export default function Signup() {
  const navigate = useNavigate();
  const auth = useAuth();
  const setUser = auth?.setUser;

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const emailOk = useMemo(() => {
    const e = email.trim();
    if (!e) return false;
    return e.includes("@") && e.includes(".");
  }, [email]);

  const pwOk = password.trim().length >= 6;
  const matchOk = confirm.trim() !== "" && confirm === password;

  const canSubmit = fullName.trim() !== "" && emailOk && pwOk && matchOk;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please fill in all fields correctly.");
      return;
    }

    setIsLoading(true);

    try {
      await registerWithEmail(email.trim(), password);

      try {
        const me = await getMe();
        if (me) {
          migrateGuestData(me);
          clearGuestData();
        }
        if (typeof setUser === "function") setUser(me);
      } catch {}

      navigate("/login", { replace: true });
    } catch (err) {
      setError(err?.message || "Registration failed. Please try again.");
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
            <h1 className="authTitle">Create account</h1>
            <p className="authSub">Save your wardrobe, favorites, and outfit picks.</p>
          </div>

          <button type="button" className="btn" onClick={() => navigate("/auth")}>
            Back
          </button>
        </div>

        <GoogleSignInButton />

        <div className="authDivider"><span>or</span></div>

        <form onSubmit={onSubmit} className="authForm">
          <label className="authFormGroup">
            Full name
            <input
              className="wardrobeInput"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              autoComplete="name"
            />
          </label>

          <label className="authFormGroup">
            Date of birth (optional)
            <input
              className="wardrobeInput"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </label>

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
                placeholder="Min 6 characters"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="wardrobeIconBtn authShowBtn"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            <span className="authHint">Password must be at least 6 characters.</span>
          </label>

          <label className="authFormGroup">
            Confirm password
            <div className="authPasswordRow">
              <input
                className="wardrobeInput"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="wardrobeIconBtn authShowBtn"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error ? <div className="authError">{error}</div> : null}

          <button
            type="submit"
            className="btn primary authSubmit"
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? "Creating..." : "Create account"}
          </button>

          <div className="authFooter">
            <span className="heroSub">Already have an account?</span>{" "}
            <NavLink to="/login" className="linkLike">
              Sign in
            </NavLink>
          </div>
        </form>
      </div>
    </div>
  );
}
