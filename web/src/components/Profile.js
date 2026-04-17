// web/src/components/Profile.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { logout } from "../api/authApi";
import { readDemoAuth, writeDemoAuth, loadProfilePic, saveProfilePic, loadAnswers, saveAnswers, mirrorUserDataToGuest } from "../utils/userStorage";
import { fileToDataUrl, getProfilePicUploadIssue } from "../utils/helpers";
import { STYLE_OPTIONS, COMFORT_OPTIONS, DRESS_FOR_OPTIONS, BODY_TYPE_OPTIONS, GENDER_OPTIONS } from "../utils/formOptions";
import {
  readRotationAlertPreferences,
  ROTATION_REMINDER_OPTIONS,
  setRotationAlertsEnabled,
  setRotationReminderPace,
} from "../utils/rotationAlertPreferences";
import {
  TEXT_SIZES,
  readAccessibilityPrefs,
  writeAccessibilityPrefs,
  applyAccessibilityToDocument,
} from "../utils/accessibilityPrefs";
import GuestModeNotice from "./GuestModeNotice";
import BodyTypeFigure from "./BodyTypeFigure";

const TEXT_SIZE_LABELS = {
  default: "Default",
  large: "Large",
  xlarge: "Extra Large",
};

const DEFAULT_PREFS = { style: [], comfort: [], dressFor: [], bodyType: null, gender: "", heightCm: "" };

export default function Profile({ onResetOnboarding = () => {} }) {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { user, setUser } = useAuth();

  const demoUser = readDemoAuth();
  const effectiveUser = user || demoUser;

  const email = effectiveUser?.email || effectiveUser?.user?.email || effectiveUser?.demoEmail || "";

  // ── Profile picture ──
  const [profilePic, setProfilePic] = useState(() => loadProfilePic(effectiveUser));
  const fileInputRef = useRef(null);
  const [picMsg, setPicMsg] = useState("");

  useEffect(() => {
    setProfilePic(loadProfilePic(effectiveUser));
  }, [effectiveUser]);

  const openPicMenu = useCallback(() => {
    setPicMsg("");
    setShowPicMenu(true);
  }, []);

  const closePicMenu = useCallback(() => {
    setShowPicMenu(false);
    setPendingPic(null);
    setPicMsg("");
  }, []);

  const handlePicSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = "";
      return;
    }

    const issue = getProfilePicUploadIssue(file);
    if (issue) {
      setPicMsg(issue);
      setShowPicMenu(true);
      e.target.value = "";
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file, 300);
      setPendingPic(dataUrl);
      setPicMsg("");
      setShowPicMenu(true);
    } catch {
      setPicMsg("Could not read that image. Please try another file.");
      setShowPicMenu(true);
    }
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
      gender: (p?.gender || "").toString(),
      heightCm: (p?.heightCm || "").toString(),
    };
  }, [effectiveUser]);

  const [prefs, setPrefs] = useState(loadPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [rotationPrefs, setRotationPrefs] = useState(() => readRotationAlertPreferences(effectiveUser));
  const [alertsSaved, setAlertsSaved] = useState(false);
  const smartAlertsRef = useRef(null);
  const alertsSavedTimerRef = useRef(null);
  const [accessibilityPrefs, setAccessibilityPrefs] = useState(() => readAccessibilityPrefs(effectiveUser));

  const updateTextSize = useCallback((next) => {
    const safe = writeAccessibilityPrefs({ ...accessibilityPrefs, textSize: next }, effectiveUser);
    setAccessibilityPrefs(safe);
    applyAccessibilityToDocument(safe);
  }, [accessibilityPrefs, effectiveUser]);

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

  useEffect(() => {
    setRotationPrefs(readRotationAlertPreferences(effectiveUser));
    setAccessibilityPrefs(readAccessibilityPrefs(effectiveUser));
  }, [effectiveUser]);

  useEffect(() => {
    if (hash !== "#smart-alerts") return;
    const node = smartAlertsRef.current;
    if (!node) return;

    window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, [hash]);

  useEffect(() => () => {
    if (alertsSavedTimerRef.current) {
      window.clearTimeout(alertsSavedTimerRef.current);
    }
  }, []);

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

  const setScalarPref = useCallback((key, value) => {
    updatePrefs((prev) => ({ ...prev, [key]: value }));
  }, [updatePrefs]);

  const flashAlertsSaved = useCallback(() => {
    setAlertsSaved(true);
    if (alertsSavedTimerRef.current) {
      window.clearTimeout(alertsSavedTimerRef.current);
    }
    alertsSavedTimerRef.current = window.setTimeout(() => setAlertsSaved(false), 1500);
  }, []);

  const handleToggleRotationAlerts = useCallback(() => {
    const next = setRotationAlertsEnabled(!rotationPrefs?.enabled, effectiveUser);
    setRotationPrefs(next);
    flashAlertsSaved();
  }, [effectiveUser, flashAlertsSaved, rotationPrefs]);

  const handleChangeReminderPace = useCallback((nextPace) => {
    const next = setRotationReminderPace(nextPace, effectiveUser);
    setRotationPrefs(next);
    flashAlertsSaved();
  }, [effectiveUser, flashAlertsSaved]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore if backend is offline
    } finally {
      mirrorUserDataToGuest(effectiveUser);
      if (typeof setUser === "function") setUser(null);
      writeDemoAuth(null);
      navigate("/dashboard", { replace: true });
    }
  };

  if (!user) {
    return (
      <div className="onboarding onboardingPage profilePage">
        <div className="card dashWide profileCard">
          <div className="profileHeaderRow">
            <div>
              <h1 className="heroTitle profileTitle">Profile</h1>
            </div>
          </div>
          <GuestModeNotice compact />
        </div>
      </div>
    );
  }

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
                onClick={openPicMenu}
              />
            ) : (
              <div
                className="profileAvatar profileAvatarPlaceholder"
                onClick={openPicMenu}
                title="Upload profile picture"
              >
                <span className="profileAvatarPlaceholderBadge">Profile</span>
                <span className="profileAvatarPlaceholderText">Add Photo</span>
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
                <button className="btn primary profileLogoutBtn" type="button" onClick={handleLogout}>
                  Log out
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
                      className={prefs.bodyType === opt.id ? "optionCard selected profileBodyTypeCard" : "optionCard profileBodyTypeCard"}
                      onClick={() => setBodyType(opt.id)}
                    >
                      <div className="profileBodyTypeRow">
                        <BodyTypeFigure bodyTypeId={opt.id} compact />
                        <div className="profileBodyTypeCopy">
                          <div className="optionTitle">{opt.label}</div>
                          <div className="optionNote">{opt.note}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <label className="wardrobeLabel">
                  Gender
                  <select className="wardrobeInput" value={prefs.gender || ""} onChange={(e) => setScalarPref("gender", e.target.value)}>
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option.value || "blank"} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="wardrobeLabel">
                  Height (cm)
                  <input
                    className="wardrobeInput"
                    inputMode="numeric"
                    placeholder="Example: 170"
                    value={prefs.heightCm || ""}
                    onChange={(e) => setScalarPref("heightCm", e.target.value.replace(/[^\d.]/g, ""))}
                  />
                </label>
              </div>
            </div>

            <div className="profileSection profileSettingsSection" id="smart-alerts" ref={smartAlertsRef}>
              <div className="profileSectionTop">
                <div className="dashCardTitle" style={{ marginBottom: 0 }}>
                  Smart Alerts
                </div>
                {alertsSaved ? (
                  <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>Saved</span>
                ) : null}
              </div>

              <div className="profileSettingsIntro">
                Control how FitGPT surfaces underused clothing so reminders stay helpful and not overwhelming.
              </div>

              <div className="profileSettingsCard">
                <div className="profileSettingsHeader">
                  <div>
                    <div className="profilePrefLabel">Underused Clothing Alerts</div>
                    <div className="profileSettingsSub">
                      Use your outfit history to spotlight pieces that have not been worn in a while.
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`btn profileToggleBtn${rotationPrefs?.enabled ? " active" : ""}`}
                    onClick={handleToggleRotationAlerts}
                    aria-pressed={rotationPrefs?.enabled !== false}
                  >
                    {rotationPrefs?.enabled ? "Alerts On" : "Alerts Off"}
                  </button>
                </div>

                <div className="profileSettingsGrid">
                  <label className="wardrobeLabel">
                    Reminder pace
                    <select
                      className="wardrobeInput"
                      value={rotationPrefs?.reminderPace || "balanced"}
                      onChange={(e) => handleChangeReminderPace(e.target.value)}
                    >
                      {ROTATION_REMINDER_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="profileSettingsHintCard">
                    <div className="profilePrefLabel">What this changes</div>
                    <div className="profileSettingsHintText">
                      Less often keeps alerts quiet longer after dismissal. Balanced is the default. More often brings items back sooner.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="profileSection profileSettingsSection">
              <div className="profileSectionTop">
                <div className="dashCardTitle" style={{ marginBottom: 0 }}>
                  Accessibility
                </div>
              </div>

              <div className="profileSettingsIntro">
                Adjust how FitGPT displays AI-generated recommendations, explanations, and chat replies.
              </div>

              <div className="profileAccessibilitySection">
                <div className="profilePrefLabel">Text size</div>
                <div className="profileAccessibilityOptions" role="radiogroup" aria-label="Text size">
                  {TEXT_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      role="radio"
                      aria-checked={accessibilityPrefs.textSize === size}
                      className={"profileAccessibilityOption" + (accessibilityPrefs.textSize === size ? " active" : "")}
                      onClick={() => updateTextSize(size)}
                    >
                      {TEXT_SIZE_LABELS[size]}
                    </button>
                  ))}
                </div>
                <div className="profileAccessibilityHint">
                  Large and Extra Large also split long AI replies into shorter paragraphs so dense blocks remain readable.
                </div>
              </div>
            </div>

          </>
        ) : (
          <>
            <div className="profileSignInCard">
              <div className="profileSignInIcon">&#x1F464;</div>
              <div className="profileSignInTitle">You're browsing as a guest</div>
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
                      className={prefs.bodyType === opt.id ? "optionCard selected profileBodyTypeCard" : "optionCard profileBodyTypeCard"}
                      onClick={() => setBodyType(opt.id)}
                    >
                      <div className="profileBodyTypeRow">
                        <BodyTypeFigure bodyTypeId={opt.id} compact />
                        <div className="profileBodyTypeCopy">
                          <div className="optionTitle">{opt.label}</div>
                          <div className="optionNote">{opt.note}</div>
                        </div>
                      </div>
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
        <div className="modalOverlay" role="dialog" aria-modal="true" onClick={closePicMenu}>
          <div className="modalCard profilePicMenu" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">Profile Picture</div>
            <div className="modalSub">Upload a photo or animated GIF as your avatar. Photos can be up to 10MB, and GIFs up to 3MB.</div>

            <div className="profilePicMenuPreview">
              {(pendingPic !== null ? pendingPic : profilePic) ? (
                <img src={pendingPic !== null ? pendingPic : profilePic} alt="Preview" className="profileAvatar" style={{ cursor: "default" }} />
              ) : (
                <div className="profileAvatar profileAvatarPlaceholder" style={{ cursor: "default" }}>
                  <span className="profileAvatarPlaceholderBadge">Profile</span>
                  <span className="profileAvatarPlaceholderText">Preview</span>
                </div>
              )}
            </div>
            {picMsg && <div className="noteBox" style={{ marginTop: 8 }}>{picMsg}</div>}

            <div className="profilePicMenuActions">
              <button
                className="btnSecondary"
                type="button"
                onClick={() => { setPicMsg(""); fileInputRef.current?.click(); }}
              >
                {(pendingPic !== null ? pendingPic : profilePic) ? "Change Photo" : "Upload Photo"}
              </button>
              {(pendingPic !== null ? pendingPic : profilePic) && (
                <button
                  className="btnSecondary"
                  type="button"
                  onClick={() => { setPendingPic(""); setPicMsg(""); }}
                >
                  Reset
                </button>
              )}
              <button
                className="btnSecondary"
                type="button"
                onClick={closePicMenu}
              >
                Cancel
              </button>
              <button
                className="btnPrimary"
                type="button"
                disabled={pendingPic === null}
                onClick={() => {
                  try {
                    saveProfilePic(pendingPic || "", effectiveUser);
                    setProfilePic(pendingPic || "");
                    setPendingPic(null);
                    setPicMsg("");
                    setShowPicMenu(false);
                  } catch {
                    setPicMsg("That profile picture is too large to save. Please choose a smaller image or GIF.");
                  }
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
