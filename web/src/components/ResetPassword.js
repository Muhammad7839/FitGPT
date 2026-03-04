import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/apiFetch";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = password.trim().length >= 6 && confirmPassword.trim() !== "";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: password }),
      });
      setSuccess(true);
    } catch (err) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("expired")) {
        setError("This reset link has expired. Please request a new one.");
      } else if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("token")) {
        setError("Invalid reset link. Please request a new one.");
      } else if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror")) {
        setError("Can't reach the server. Check your connection or try again later.");
      } else {
        setError(msg || "Failed to reset password. Please try again.");
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
        {success ? (
          <>
            <div className="authHeader">
              <div>
                <h1 className="authTitle">Password reset</h1>
                <p className="authSub">
                  Your password has been updated successfully. You can now sign in with your new password.
                </p>
              </div>
            </div>

            <div className="authForm">
              <button
                type="button"
                className="btn primary authSubmit"
                onClick={() => navigate("/login")}
              >
                Go to Login
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="authHeader">
              <div>
                <h1 className="authTitle">Reset password</h1>
                <p className="authSub">Enter your new password below.</p>
              </div>

              <button type="button" className="btn" onClick={() => navigate("/login")}>
                Back
              </button>
            </div>

            <form onSubmit={onSubmit} className="authForm">
              <label className="authFormGroup">
                New Password
                <div className="authPasswordRow">
                  <input
                    className="wardrobeInput"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
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
              </label>

              <label className="authFormGroup">
                Confirm Password
                <input
                  className="wardrobeInput"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                />
              </label>

              {error ? <div className="authError">{error}</div> : null}

              <button
                type="submit"
                className="btn primary authSubmit"
                disabled={!canSubmit || isLoading}
              >
                {isLoading ? "Resetting..." : "Reset password"}
              </button>

              <div className="authFooter">
                <span className="heroSub">Remember your password?</span>{" "}
                <button
                  type="button"
                  className="linkLike"
                  onClick={() => navigate("/login")}
                  style={{ background: "none", border: "none", padding: 0, font: "inherit" }}
                >
                  Sign in
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
