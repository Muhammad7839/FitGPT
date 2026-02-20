import React from "react";

const AUTH_KEY = "fitgpt_auth_mode_v1";

export default function Profile({ onSignedIn }) {
  const signInGoogle = () => {
    localStorage.setItem(AUTH_KEY, "google");
    if (typeof onSignedIn === "function") onSignedIn("google");
  };

  const signInEmail = () => {
    localStorage.setItem(AUTH_KEY, "email");
    if (typeof onSignedIn === "function") onSignedIn("email");
  };

  return (
    <div className="onboarding onboardingPage profilePage">
      <div className="card dashWide profileCard">
        <h1 className="heroTitle" style={{ fontSize: 40 }}>
          Sign in
        </h1>
        <p className="heroSub">
          Sign in only if you want to save your picks across devices.
        </p>

        <div className="loginButtons" style={{ marginTop: 18 }}>
          <button className="btn primary" type="button" onClick={signInGoogle}>
            Sign in with Google
          </button>

          <button className="btn" type="button" onClick={signInEmail}>
            Sign in with Email
          </button>
        </div>

        <div className="noteBox" style={{ marginTop: 16 }}>
          Guest mode stays on this device. Sign in is for saving later.
        </div>
      </div>
    </div>
  );
}