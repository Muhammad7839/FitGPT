import React, { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { loginWithEmail, getMe } from "../api/authApi";
import { useAuth } from "../auth/AuthProvider";
import { migrateGuestData, clearGuestData } from "../utils/userStorage";
import { isNetworkError } from "../utils/helpers";
import { SYMPOSIUM_APK_DOWNLOAD_URL } from "../constants/symposiumRelease";

function isLikelyStorageError(err) {
  const name = (err?.name || "").toString().toLowerCase();
  const message = (err?.message || "").toString().toLowerCase();
  return (
    name.includes("securityerror") ||
    name.includes("quotaexceedederror") ||
    message.includes("localstorage") ||
    message.includes("sessionstorage") ||
    message.includes("storage") ||
    message.includes("quota") ||
    message.includes("private browsing")
  );
}

function getLoginErrorMessage(err) {
  const status = Number(err?.status || 0);
  const code = (err?.code || "").toString().toLowerCase();

  if (status === 401) {
    return "Incorrect email or password. Please check your login details and try again.";
  }
  if (status === 429) {
    return "Too many attempts. Please wait a moment before trying again.";
  }
  if (code === "request_timeout") {
    return "The server may still be waking up. Please wait a few seconds and try again.";
  }
  if (code === "network_error" || isNetworkError(err)) {
    return "We could not reach the FitGPT server. Check your connection and try again.";
  }
  if (status >= 500) {
    return "The server had a temporary issue. Please try again shortly.";
  }
  if (isLikelyStorageError(err)) {
    return "Your browser may be blocking saved login sessions. Try turning off private browsing or use another browser.";
  }
  return err?.message || "Login failed. Please try again.";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const setUser = auth?.setUser;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const params = new URLSearchParams(location.search);
  const protectedMessage =
    location.state?.message ||
    (params.get("reason") === "guest_protected"
      ? "Sign in to unlock the full FitGPT experience."
      : "");

  const androidApkQrSrc = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(SYMPOSIUM_APK_DOWNLOAD_URL)}`,
    []
  );

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
        const onboardingComplete = Boolean(me?.onboarding_complete ?? me?.onboardingComplete);
        navigate(onboardingComplete ? "/dashboard" : "/onboarding", { replace: true });
        return;
      } catch {}

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err));
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

          <button type="button" className="btn" onClick={() => navigate("/dashboard")}>
            Back
          </button>
        </div>

        {protectedMessage ? <div className="authHint">{protectedMessage}</div> : null}

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

        <div className="authFooter">
          <span className="heroSub">Just browsing?</span>{" "}
          <button type="button" className="linkBtn" onClick={() => navigate("/dashboard")}>
            Continue as guest.
          </button>
        </div>
        <div className="authHint" style={{ marginTop: 8 }}>
          If login fails on school Wi-Fi, try refreshing once or switching to cellular/hotspot.
        </div>
      </div>

      <div className="authQrRow">
        <div className="authQrCard">
          <img
            className="authQrCode"
            src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https%3A%2F%2Fwww.fitgpt.tech"
            alt="QR code for FitGPT web app"
            loading="lazy"
          />
          <span className="authQrLabel">Open on phone</span>
          <span className="authQrSub">fitgpt.tech</span>
        </div>

        <div className="authQrDivider" aria-hidden="true" />

        <div className="authQrCard">
          <img
            className="authQrCode"
            src={androidApkQrSrc}
            alt="QR code to download FitGPT Android app"
            loading="lazy"
          />
          <span className="authQrLabel">Android app</span>
          <span className="authQrSub">Download FitGPT APK</span>
        </div>
      </div>
    </div>
  );
}
