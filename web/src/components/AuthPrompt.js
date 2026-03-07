import React from "react";
import { useNavigate } from "react-router-dom";
import GoogleSignInButton from "./GoogleSignInButton";

export default function AuthPrompt() {
  const navigate = useNavigate();

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
        <h1 className="heroTitle" style={{ fontSize: 34, marginBottom: 6 }}>Save your setup</h1>
        <p className="heroSub" style={{ marginTop: 0 }}>
          Create an account to save your wardrobe and favorites. Or continue as guest.
        </p>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <GoogleSignInButton />

          <div className="authDivider"><span>or</span></div>

          <button type="button" className="btn primary" onClick={() => navigate("/signup")}>
            Create account
          </button>

          <button type="button" className="btn" onClick={() => navigate("/login")}>
            Sign in
          </button>

          <button
            type="button"
            className="linkBtn"
            onClick={() => navigate("/dashboard", { replace: true })}
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  );
}