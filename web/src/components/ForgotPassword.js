import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/apiFetch";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const emailOk = useMemo(() => {
    const e = email.trim();
    if (!e) return false;
    return e.includes("@") && e.includes(".");
  }, [email]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!emailOk) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSuccess(true);
    } catch (err) {
      const msg = err?.message || "";
      if (
        msg.toLowerCase().includes("failed to fetch") ||
        msg.toLowerCase().includes("networkerror")
      ) {
        setError(
          "Can't reach the server. Check your connection or try again later."
        );
      } else {
        // Show generic success even on most errors to avoid leaking whether email exists
        setSuccess(true);
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
            <img
              className="brandLogo"
              src="/officialLogo.png"
              alt="FitGPT official logo"
            />
          </div>
        </div>
      </div>

      <div className="card authCard">
        <div className="authHeader">
          <div>
            <h1 className="authTitle">Reset password</h1>
            <p className="authSub">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => navigate("/login")}
          >
            Back
          </button>
        </div>

        {success ? (
          <div className="authForm">
            <div className="authSuccess">
              If an account exists with that email, you'll receive a reset link
              shortly.
            </div>

            <div className="authFooter">
              <button
                type="button"
                className="linkLike"
                onClick={() => navigate("/login")}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                Back to Login
              </button>
            </div>
          </div>
        ) : (
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

            {error ? <div className="authError">{error}</div> : null}

            <button
              type="submit"
              className="btn primary authSubmit"
              disabled={!emailOk || isLoading}
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </button>

            <div className="authFooter">
              <span className="heroSub">Remember your password?</span>{" "}
              <button
                type="button"
                className="linkLike"
                onClick={() => navigate("/login")}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                Sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
