// web/src/components/Login.js
import React, { useMemo, useState } from "react";

export default function Login({ onLogin }) {
  const [name, setName] = useState("");

  const canContinue = useMemo(() => {
    return name.trim().length >= 2;
  }, [name]);

  const loginAsGoogleMock = () => {
    if (typeof onLogin !== "function") return;
    onLogin({ provider: "google", name: name.trim() });
  };

  const loginAsGuest = () => {
    if (typeof onLogin !== "function") return;
    onLogin({ provider: "guest", name: name.trim() || "Guest" });
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

      <div className="card loginCard">
        <h1 className="heroTitle">Welcome back</h1>
        <p className="heroSub">
          For now, login is a frontend mock so you can keep building the app. Your progress saves on
          this device.
        </p>

        <div className="loginForm">
          <div>
            <div className="fieldLabel">Name</div>
            <input
              className="textInput"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your name"
              autoComplete="name"
            />
          </div>

          <div className="loginButtons">
            <button
              type="button"
              className="btn primary"
              onClick={loginAsGoogleMock}
              disabled={!canContinue}
            >
              Continue with Google
            </button>

            <button type="button" className="btn" onClick={loginAsGuest}>
              Continue as guest
            </button>
          </div>

          <div className="noteBox">
            Real Google sign-in + saving across devices will be added when the backend auth endpoint
            is ready.
          </div>
        </div>
      </div>
    </div>
  );
}
