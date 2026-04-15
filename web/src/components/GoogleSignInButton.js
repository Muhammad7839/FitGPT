import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithGoogle, getMe } from "../api/authApi";
import { useAuth } from "../auth/AuthProvider";
import { migrateGuestData, clearGuestData } from "../utils/userStorage";
import { isNetworkError } from "../utils/helpers";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

export default function GoogleSignInButton() {
  const navigate = useNavigate();
  const auth = useAuth();
  const setUser = auth?.setUser;
  const btnRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });

    window.google.accounts.id.renderButton(btnRef.current, {
      theme: "outline",
      size: "large",
      width: btnRef.current?.offsetWidth || 300,
      text: "continue_with",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCredentialResponse(response) {
    const idToken = response?.credential;
    if (!idToken) {
      setError("Google sign-in failed. Please try again.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await loginWithGoogle(idToken);

      try {
        const me = await getMe();
        if (me) {
          migrateGuestData(me);
          clearGuestData();
        }
        if (typeof setUser === "function") setUser(me);
      } catch {}

      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (isNetworkError(err)) {
        setError("Can't reach the server. Check your connection or try again later.");
      } else {
        setError(err?.message || "Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="authGoogleSection">
        <div className="authGoogleTitle">Sign in with Google</div>
        <div className="authGoogleUnavailable">
          Google sign-in is not configured for this environment yet.
        </div>
      </div>
    );
  }

  return (
    <div className="authGoogleSection">
      <div className="authGoogleTitle">Sign in with Google</div>
      {loading && <div className="authHint">Signing in with Google...</div>}
      <div className="authGoogleButtonWrap">
        <div ref={btnRef} style={{ width: "100%" }} />
      </div>
      {error && <div className="authError">{error}</div>}
    </div>
  );
}
