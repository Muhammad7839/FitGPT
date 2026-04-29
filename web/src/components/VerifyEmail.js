import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api/authApi";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    let alive = true;
    const token = (params.get("token") || "").trim();
    if (!token) {
      setStatus("error");
      setMessage("Verification link is missing a token.");
      return () => {
        alive = false;
      };
    }

    verifyEmail(token)
      .then((response) => {
        if (!alive) return;
        setStatus("success");
        setMessage(response?.message || "Email verified successfully");
        window.setTimeout(() => navigate("/login", { replace: true }), 3000);
      })
      .catch((error) => {
        if (!alive) return;
        setStatus("error");
        setMessage(error?.message || "Verification link is invalid or expired.");
      });

    return () => {
      alive = false;
    };
  }, [params, navigate]);

  return (
    <div className="onboarding onboardingPage">
      <div className="card authCard verifyEmailCard">
        <div className="authHeader">
          <div>
            <h1 className="authTitle">Verify email</h1>
            <p className="authSub">{message}</p>
          </div>
        </div>
        {status === "success" ? (
          <div className="authHint">Redirecting to sign in...</div>
        ) : status === "error" ? (
          <button type="button" className="btn primary" onClick={() => navigate("/login")}>
            Back to login
          </button>
        ) : null}
      </div>
    </div>
  );
}
