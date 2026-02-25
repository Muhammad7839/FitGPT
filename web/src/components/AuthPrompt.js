import React from "react";
import { useNavigate } from "react-router-dom";

const AUTH_KEY = "fitgpt_auth_mode_v1";

export default function AuthPrompt() {
  const navigate = useNavigate();

  const continueGuest = () => {
    localStorage.setItem(AUTH_KEY, "guest");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="card dashWide" style={{ marginTop: 12 }}>
        <h1 className="heroTitle" style={{ fontSize: 34, marginBottom: 6 }}>
          Save your setup?
        </h1>

        <p className="heroSub" style={{ marginTop: 0 }}>
          Create an account to save your wardrobe, favorites, and outfit picks. Or continue as a guest.
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <button type="button" className="btnPrimary" onClick={() => navigate("/signup")}>
            Create account
          </button>

          <button type="button" className="btnSecondary" onClick={() => navigate("/login")}>
            Sign in
          </button>

          <button type="button" className="linkBtn" onClick={continueGuest}>
            Continue as guest
          </button>
        </div>

        <div className="noteBox" style={{ marginTop: 16 }}>
          Guest mode is fine for now. Later, when you connect the backend, sign-in will let you sync across devices.
        </div>
      </div>
    </div>
  );
}