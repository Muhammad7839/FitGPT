// web/src/components/Profile.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { logout } from "../api/authApi";
import { readDemoAuth, writeDemoAuth, loadProfilePic, saveProfilePic, loadAnswers, saveAnswers } from "../utils/userStorage";
import { fileToDataUrl } from "../utils/helpers";

const STYLE_OPTIONS = [
  "Casual", "Professional", "Streetwear", "Athletic", "Minimalist", "Formal",
];

const COMFORT_OPTIONS = ["Balanced", "Relaxed", "Fitted", "Stretchy", "Layered"];

const DRESS_FOR_OPTIONS = [
  "Class / Campus", "Work", "Gym", "Date Night", "Errands", "Party / Event", "Travel",
];

const BODY_TYPE_OPTIONS = [
  { id: "pear", label: "Pear", note: "Balance with structure on top." },
  { id: "apple", label: "Apple", note: "Comfort + clean lines through the middle." },
  { id: "hourglass", label: "Hourglass", note: "Highlight waist, keep proportions balanced." },
  { id: "rectangle", label: "Rectangle", note: "Add shape with layers and contrast." },
  { id: "inverted", label: "Inverted Triangle", note: "Balance shoulders with volume below." },
];

const DEFAULT_PREFS = { style: [], comfort: [], dressFor: [], bodyType: null };

export default function Profile({ onResetOnboarding = () => {} }) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const demoUser = useMemo(() => readDemoAuth(), []);
  const effectiveUser = user || demoUser;

  const email = effectiveUser?.email || effectiveUser?.user?.email || effectiveUser?.demoEmail || "";

  // ── Profile picture ──
  const [profilePic, setProfilePic] = useState(() => loadProfilePic(effectiveUser));
  const fileInputRef = useRef(null);

  useEffect(() => {
    setProfilePic(loadProfilePic(effectiveUser));
  }, [effectiveUser]);

  const handlePicSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, 300);
      setPendingPic(dataUrl);
      setShowPicMenu(true);
    } catch {}
    e.target.value = "";
  };

  // ── Style preferences (loaded from onboarding answers) ──
  const loadPrefs = useCallback(() => {
    const p = loadAnswers(effectiveUser);
    if (!p) return DEFAULT_PREFS;
    return {
      style: Array.isArray(p?.style) ? p.style : [],
      comfort: Array.isArray(p?.comfort) ? p.comfort : [],
      dressFor: Array.isArray(p?.dressFor) ? p.dressFor : [],
      bodyType: p?.bodyType ?? null,
    };
  }, [effectiveUser]);

  const [prefs, setPrefs] = useState(loadPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // ── Account settings state ──
  const [showEmailEdit, setShowEmailEdit] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [showPicMenu, setShowPicMenu] = useState(false);
  const [pendingPic, setPendingPic] = useState(null); // null = no pending change, "" = reset, string = new pic

  useEffect(() => {
    setPrefs(loadPrefs());
  }, [loadPrefs]);

  const updatePrefs = useCallback((updater) => {
    setPrefs((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveAnswers(next, effectiveUser);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 1500);
      return next;
    });
  }, [effectiveUser]);

  const togglePref = useCallback((key, value) => {
    updatePrefs((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      const exists = list.includes(value);
      return { ...prev, [key]: exists ? list.filter((v) => v !== value) : [...list, value] };
    });
  }, [updatePrefs]);

  const setBodyType = useCallback((id) => {
    updatePrefs((prev) => ({ ...prev, bodyType: prev.bodyType === id ? null : id }));
  }, [updatePrefs]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore if backend is offline
    } finally {
      if (typeof setUser === "function") setUser(null);
      writeDemoAuth(null);
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="onboarding onboardingPage profilePage">
      <div className="card dashWide profileCard">
        <div className="profileHeaderRow">
          <div>
            <h1 className="heroTitle profileTitle">Profile</h1>
            <p className="heroSub profileSub">Manage your account and preferences.</p>
          </div>

          <div className="profileHeaderActions">
            <NavLink to="/dashboard" className="btn">
              Back
            </NavLink>
          </div>
        </div>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handlePicSelect}
        />
        <div className="profileAvatarRow">
          <div className="profileAvatarWrap">
            {profilePic ? (
              <img
                src={profilePic}
                alt="Profile"
                className="profileAvatar"
                onClick={() => setShowPicMenu(true)}
              />
            ) : (
              <div
                className="profileAvatar profileAvatarPlaceholder"
                onClick={() => setShowPicMenu(true)}
                title="Upload profile picture"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {effectiveUser ? (
          <>
            <div className="noteBox" style={{ marginTop: 16 }}>
              {email ? `Signed in as ${email}` : "Signed in"}
            </div>


            {/* ── Account Settings ── */}
            <div className="profileSection">
              <div className="dashCardTitle" style={{ marginBottom: 12 }}>Account Settings</div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => { setShowEmailEdit(true); setShowPasswordEdit(false); setEmailMsg(""); setNewEmail(""); }}
                >
                  Change Email
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => { setShowPasswordEdit(true); setShowEmailEdit(false); setPasswordMsg(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                >
                  Change Password
                </button>
                <button className="btn primary" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>

            {/* ── Style Preferences ── */}
            <div className="profileSection">
              <div className="profileSectionTop">
                <div className="dashCardTitle" style={{ marginBottom: 0 }}>
                  Style Preferences
                </div>
                {prefsSaved && (
                  <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>Saved</span>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="profilePrefLabel">Style</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.style.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("style", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Comfort</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {COMFORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.comfort.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("comfort", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Dressing For</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {DRESS_FOR_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.dressFor.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("dressFor", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Body Type</div>
                <div className="optionGrid" style={{ marginTop: 8 }}>
                  {BODY_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={prefs.bodyType === opt.id ? "optionCard selected" : "optionCard"}
                      onClick={() => setBodyType(opt.id)}
                    >
                      <div className="optionTitle">{opt.label}</div>
                      <div className="optionNote">{opt.note}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </>
        ) : (
          <>
            <div className="profileSignInCard">
              <div className="profileSignInIcon">&#x1F464;</div>
              <div className="profileSignInTitle">You're browsing as a guest</div>
              <div className="profileSignInSub">Sign in to save outfits, sync your wardrobe, and access your full profile.</div>
              <button className="btn primary" type="button" onClick={() => navigate("/login")}>
                Sign in
              </button>
            </div>

            {/* ── Style Preferences (guest) ── */}
            <div className="profileSection">
              <div className="profileSectionTop">
                <div className="dashCardTitle" style={{ marginBottom: 0 }}>
                  Style Preferences
                </div>
                {prefsSaved && (
                  <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>Saved</span>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="profilePrefLabel">Style</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.style.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("style", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Comfort</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {COMFORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.comfort.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("comfort", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Dressing For</div>
                <div className="pillGrid" style={{ marginTop: 8 }}>
                  {DRESS_FOR_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={prefs.dressFor.includes(opt) ? "pill selected" : "pill"}
                      onClick={() => togglePref("dressFor", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="profilePrefLabel">Body Type</div>
                <div className="optionGrid" style={{ marginTop: 8 }}>
                  {BODY_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={prefs.bodyType === opt.id ? "optionCard selected" : "optionCard"}
                      onClick={() => setBodyType(opt.id)}
                    >
                      <div className="optionTitle">{opt.label}</div>
                      <div className="optionNote">{opt.note}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </>
        )}
      </div>

      {showEmailEdit && ReactDOM.createPortal(
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Change Email</div>
            <div className="modalSub">Enter a new email address for your account.</div>

            <div className="wardrobeAddForm">
              <label className="wardrobeLabel">
                New email
                <input
                  className="wardrobeInput"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email"
                />
              </label>
              {emailMsg && <div className="noteBox" style={{ marginTop: 8 }}>{emailMsg}</div>}
            </div>

            <div className="modalActions">
              <button className="btnSecondary" type="button" onClick={() => setShowEmailEdit(false)}>
                Cancel
              </button>
              <button
                className="btnPrimary"
                type="button"
                onClick={() => {
                  if (!newEmail.trim() || !newEmail.includes("@")) {
                    setEmailMsg("Please enter a valid email.");
                    return;
                  }
                  const demo = readDemoAuth();
                  if (demo) {
                    writeDemoAuth({ ...demo, demoEmail: newEmail.trim() });
                  }
                  setEmailMsg("Email updated.");
                  setNewEmail("");
                  setTimeout(() => { setEmailMsg(""); setShowEmailEdit(false); }, 1500);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showPasswordEdit && ReactDOM.createPortal(
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Change Password</div>
            <div className="modalSub">Enter your current password and choose a new one.</div>

            <div className="wardrobeAddForm">
              <label className="wardrobeLabel">
                Current password
                <input
                  className="wardrobeInput"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </label>
              <label className="wardrobeLabel">
                New password
                <input
                  className="wardrobeInput"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </label>
              <label className="wardrobeLabel">
                Confirm new password
                <input
                  className="wardrobeInput"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
              </label>
              {passwordMsg && <div className="noteBox" style={{ marginTop: 8 }}>{passwordMsg}</div>}
            </div>

            <div className="modalActions">
              <button className="btnSecondary" type="button" onClick={() => setShowPasswordEdit(false)}>
                Cancel
              </button>
              <button
                className="btnPrimary"
                type="button"
                onClick={() => {
                  if (!currentPassword) {
                    setPasswordMsg("Please enter your current password.");
                    return;
                  }
                  if (newPassword.length < 6) {
                    setPasswordMsg("New password must be at least 6 characters.");
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    setPasswordMsg("Passwords do not match.");
                    return;
                  }
                  setPasswordMsg("Password updated.");
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setTimeout(() => { setPasswordMsg(""); setShowPasswordEdit(false); }, 1500);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showPicMenu && ReactDOM.createPortal(
        <div className="modalOverlay" role="dialog" aria-modal="true" onClick={() => { setShowPicMenu(false); setPendingPic(null); }}>
          <div className="modalCard profilePicMenu" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">Profile Picture</div>
            <div className="modalSub">Upload a photo or animated GIF as your avatar.</div>

            <div className="profilePicMenuPreview">
              {(pendingPic !== null ? pendingPic : profilePic) ? (
                <img src={pendingPic !== null ? pendingPic : profilePic} alt="Preview" className="profileAvatar" style={{ cursor: "default" }} />
              ) : (
                <div className="profileAvatar profileAvatarPlaceholder" style={{ cursor: "default" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </div>

            <div className="profilePicMenuActions">
              <button
                className="btnSecondary"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                {(pendingPic !== null ? pendingPic : profilePic) ? "Change Photo" : "Upload Photo"}
              </button>
              {(pendingPic !== null ? pendingPic : profilePic) && (
                <button
                  className="btnSecondary"
                  type="button"
                  onClick={() => setPendingPic("")}
                >
                  Reset
                </button>
              )}
              <button
                className="btnSecondary"
                type="button"
                onClick={() => { setShowPicMenu(false); setPendingPic(null); }}
              >
                Cancel
              </button>
              <button
                className="btnPrimary"
                type="button"
                disabled={pendingPic === null}
                onClick={() => {
                  saveProfilePic(pendingPic || "", effectiveUser);
                  setProfilePic(pendingPic || "");
                  setPendingPic(null);
                  setShowPicMenu(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}