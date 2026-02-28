// web/src/components/Login.js
import React, { useState } from "react";

const ACCOUNTS_KEY = "fitgpt_accounts_v1";

function getAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function Login({ onLogin, onSwitchToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("email");

  const handleEmailLogin = (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    const accounts = getAccounts();
    const account = accounts.find((a) => a.email === email.trim().toLowerCase());

    if (!account) {
      setError("No account found with that email. Register first.");
      return;
    }
    if (account.password !== password) {
      setError("Incorrect password. Please try again.");
      return;
    }

    onLogin({ provider: "email", name: account.name, email: account.email });
  };

  const loginAsGuest = () => {
    const name = guestName.trim() || "Guest";
    onLogin({ provider: "guest", name });
  };

  const loginAsGoogleMock = () => {
    if (guestName.trim().length < 2) {
      setError("Enter your name to continue with Google.");
      return;
    }
    onLogin({ provider: "google", name: guestName.trim() });
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="brandBar">
        <div className="brandLeft">
          <div className="brandMark">
            <img className="brandLogo" src="/officialLogo.png" alt="FitGPT" />
          </div>
        </div>
      </div>

      <div className="card loginCard">
        <h1 className="heroTitle">Welcome back</h1>
        <p className="heroSub">Sign in to pick up where you left off.</p>

        <div className="loginTabs">
          <button
            type="button"
            className={`loginTab ${mode === "email" ? "loginTabActive" : ""}`}
            onClick={() => {
              setMode("email");
              setError("");
            }}
          >
            Email
          </button>
          <button
            type="button"
            className={`loginTab ${mode === "guest" ? "loginTabActive" : ""}`}
            onClick={() => {
              setMode("guest");
              setError("");
            }}
          >
            Quick access
          </button>
        </div>

        {mode === "email" ? (
          <form className="loginForm" onSubmit={handleEmailLogin}>
            <div>
              <div className="fieldLabel">Email</div>
              <input
                className="textInput"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="fieldLabel">Password</div>
              <input
                className="textInput"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
              />
            </div>

            {error && <div className="formError">{error}</div>}

            <div className="loginButtons">
              <button type="submit" className="btn primary">
                Log in
              </button>
            </div>

            <div className="authSwitch">
              Don&rsquo;t have an account?{" "}
              <button
                type="button"
                className="linkBtn authSwitchLink"
                onClick={onSwitchToRegister}
              >
                Register
              </button>
            </div>
          </form>
        ) : (
          <div className="loginForm">
            <div>
              <div className="fieldLabel">Name (optional)</div>
              <input
                className="textInput"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Type your name"
                autoComplete="name"
              />
            </div>

            {error && <div className="formError">{error}</div>}

            <div className="loginButtons">
              <button
                type="button"
                className="btn primary"
                onClick={loginAsGoogleMock}
                disabled={guestName.trim().length < 2}
              >
                Continue with Google
              </button>
              <button type="button" className="btn" onClick={loginAsGuest}>
                Continue as guest
              </button>
            </div>

            <div className="noteBox">
              Quick access saves progress on this device only. Create an account for the full
              experience.
            </div>

            <div className="authSwitch">
              Want full features?{" "}
              <button
                type="button"
                className="linkBtn authSwitchLink"
                onClick={onSwitchToRegister}
              >
                Create an account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
