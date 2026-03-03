// web/src/components/Profile.js
import React from "react";

function titleCase(text) {
  if (!text) return "";
  return text
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function joinNice(list) {
  if (!Array.isArray(list) || list.length === 0) return "Not set";
  if (list.length === 1) return titleCase(list[0]);
  if (list.length === 2) return `${titleCase(list[0])} and ${titleCase(list[1])}`;
  return (
    list.slice(0, -1).map(titleCase).join(", ") + ", and " + titleCase(list[list.length - 1])
  );
}

export default function Profile({
  userName,
  userEmail,
  userProvider,
  answers,
  onResetOnboarding,
  onLogout,
  theme,
  onToggleTheme,
}) {
  const bodyType =
    answers?.bodyType && answers.bodyType !== "unspecified"
      ? titleCase(answers.bodyType)
      : "Not set";

  return (
    <div>
      <h2 className="wdTitle" style={{ marginBottom: 16 }}>
        Profile
      </h2>

      {/* User card */}
      <div className="card profCard">
        <div className="profAvatar">{(userName || "U")[0].toUpperCase()}</div>
        <div className="profName">{userName || "User"}</div>
        {userEmail && <div className="profEmail">{userEmail}</div>}
        <div className="profBadge">
          {userProvider === "email"
            ? "Email account"
            : userProvider === "google"
              ? "Google account"
              : "Guest"}
        </div>
      </div>

      {/* Style preferences */}
      <div className="card profSection">
        <div className="dashCardTitle">Style preferences</div>

        <div className="dashProfileRow">
          <div className="dashMuted">Style</div>
          <div className="dashStrong">{joinNice(answers?.style)}</div>
        </div>

        <div className="dashProfileRow">
          <div className="dashMuted">Dress for</div>
          <div className="dashStrong">{joinNice(answers?.dressFor)}</div>
        </div>

        <div className="dashProfileRow">
          <div className="dashMuted">Body type</div>
          <div className="dashStrong">{bodyType}</div>
        </div>

        <div className="buttonRow">
          <button type="button" className="btn" onClick={onResetOnboarding}>
            Redo onboarding
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="card profSection">
        <div className="dashCardTitle">Settings</div>

        <div className="profSettingRow">
          <div>
            <div className="dashStrong">Appearance</div>
            <div className="dashSubText">{theme === "dark" ? "Dark mode" : "Light mode"}</div>
          </div>
          <button type="button" className="btn" onClick={onToggleTheme}>
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="profLogout">
        <button type="button" className="btn profLogoutBtn" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
