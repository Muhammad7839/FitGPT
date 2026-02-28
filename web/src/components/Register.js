// web/src/components/Register.js
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

function saveAccount(account) {
  const accounts = getAccounts();
  accounts.push(account);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export default function Register({ onRegister, onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    const accounts = getAccounts();
    if (accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())) {
      setError("An account with this email already exists.");
      return;
    }

    saveAccount({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      createdAt: Date.now(),
    });

    onRegister({ provider: "email", name: name.trim(), email: email.trim().toLowerCase() });
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
        <h1 className="heroTitle">Create account</h1>
        <p className="heroSub">
          Join FitGPT and get personalized outfit recommendations every day.
        </p>

        <form className="loginForm" onSubmit={handleSubmit}>
          <div>
            <div className="fieldLabel">Full name</div>
            <input
              className="textInput"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

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
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <div className="fieldLabel">Confirm password</div>
            <input
              className="textInput"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Retype your password"
              autoComplete="new-password"
            />
          </div>

          {error && <div className="formError">{error}</div>}

          <div className="loginButtons">
            <button type="submit" className="btn primary">
              Create account
            </button>
          </div>

          <div className="authSwitch">
            Already have an account?{" "}
            <button type="button" className="linkBtn authSwitchLink" onClick={onSwitchToLogin}>
              Log in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
