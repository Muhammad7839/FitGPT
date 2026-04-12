import React from "react";
import { useNavigate } from "react-router-dom";

export default function GuestModeNotice({
  title = "Sign in to unlock this page",
  message = "",
  compact = false,
}) {
  const navigate = useNavigate();

  return (
    <div className="profileEmpty" style={{ marginTop: compact ? 0 : 24 }}>
      <div className="dashStrong">{title}</div>
      {message ? (
        <div className="dashSubText" style={{ marginTop: 6 }}>
          {message}
        </div>
      ) : null}
      <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn primary" type="button" onClick={() => navigate("/login")}>
          Sign In
        </button>
        <button className="btn" type="button" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
