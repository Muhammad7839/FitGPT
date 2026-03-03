// web/src/components/Profile.js
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { logout } from "../api/authApi";
import { savedOutfitsApi } from "../api/savedOutfitsApi";

const DEMO_AUTH_KEY = "fitgpt_demo_auth_v1";
const REUSE_OUTFIT_KEY = "fitgpt_reuse_outfit_v1";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readDemoAuth() {
  const raw = localStorage.getItem(DEMO_AUTH_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : null;
}

function writeDemoAuth(objOrNull) {
  if (!objOrNull) localStorage.removeItem(DEMO_AUTH_KEY);
  else localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(objOrNull));
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function uniq(arr) {
  const out = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

export default function Profile({ onResetOnboarding = () => {} }) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const demoUser = useMemo(() => readDemoAuth(), []);
  const effectiveUser = user || demoUser;

  const email = effectiveUser?.email || effectiveUser?.user?.email || effectiveUser?.demoEmail || "";

  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [savedMsg, setSavedMsg] = useState("");

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



  const refreshSaved = async () => {
    if (!effectiveUser) {
      setSavedOutfits([]);
      return;
    }

    setLoadingSaved(true);
    setSavedMsg("");

    try {
      const res = await savedOutfitsApi.listSaved(effectiveUser);
      const list = Array.isArray(res?.saved_outfits) ? res.saved_outfits : [];
      setSavedOutfits(list);
    } catch (e) {
      setSavedOutfits([]);
      setSavedMsg(e?.message || "Could not load saved outfits.");
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    refreshSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!effectiveUser]);

  const sortedSaved = useMemo(() => {
    return [...savedOutfits].sort((a, b) => {
      const da = (a?.created_at || "").toString();
      const db = (b?.created_at || "").toString();
      return db.localeCompare(da);
    });
  }, [savedOutfits]);

  const reuseOutfit = (outfit) => {
    const ids = uniq(outfit?.items || []).map((x) => (x ?? "").toString().trim()).filter(Boolean);
    if (!ids.length) return;

    sessionStorage.setItem(
      REUSE_OUTFIT_KEY,
      JSON.stringify({
        items: savedOutfitsApi.normalizeItems(ids),
        saved_outfit_id: outfit?.saved_outfit_id || "",
      })
    );

    navigate("/dashboard");
  };

  return (
    <div className="onboarding onboardingPage profilePage">
      <div className="card dashWide profileCard">
        <div className="profileHeaderRow">
          <div>
            <h1 className="heroTitle profileTitle">Profile</h1>
            <p className="heroSub profileSub">Manage your account and saved outfits.</p>
          </div>

          <div className="profileHeaderActions">
            <NavLink to="/dashboard" className="btn">
              Back
            </NavLink>
          </div>
        </div>

        {effectiveUser ? (
          <>
            <div className="noteBox" style={{ marginTop: 16 }}>
              {email ? `Signed in as ${email}` : "Signed in"}
            </div>

            <div className="loginButtons" style={{ marginTop: 18 }}>
              <button className="btn primary" type="button" onClick={handleLogout}>
                Logout
              </button>
              <button className="btn" type="button" onClick={() => navigate("/dashboard")}>
                Dashboard
              </button>
              <button className="btn" type="button" onClick={() => navigate("/history")}>
                Outfit history
              </button>
              <button className="btn" type="button" onClick={() => { onResetOnboarding(); navigate("/"); }}>
                Redo Onboarding
              </button>
            </div>

            <div className="profileSection">
              <div className="profileSectionTop">
                <div className="dashCardTitle" style={{ marginBottom: 0 }}>
                  Saved Outfits
                </div>

                <button className="btn" type="button" onClick={refreshSaved} disabled={loadingSaved}>
                  {loadingSaved ? "Loading..." : "Refresh"}
                </button>
              </div>

              {savedMsg ? (
                <div className="noteBox" style={{ marginTop: 12 }}>
                  {savedMsg}
                </div>
              ) : null}

              {!loadingSaved && sortedSaved.length === 0 ? (
                <div className="profileEmpty">
                  <div className="dashStrong">No saved outfits yet</div>
                  <div className="dashSubText" style={{ marginTop: 6 }}>
                    Save an outfit from your recommendations to see it here.
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button className="btn primary" type="button" onClick={() => navigate("/dashboard")}>
                      Go to recommendations
                    </button>
                  </div>
                </div>
              ) : null}

              {sortedSaved.length ? (
                <div className="savedOutfitsList">
                  {sortedSaved.map((o) => {
                    const details = Array.isArray(o?.item_details) ? o.item_details : [];
                    const itemCount = Array.isArray(o?.items) ? o.items.length : 0;
                    const createdAt = formatDate(o?.created_at);
                    const title = o?.name ? o.name : "Saved outfit";

                    return (
                      <div key={o?.saved_outfit_id || o?.outfit_signature} className="savedOutfitCard">
                        <div className="savedOutfitTop">
                          <div className="savedOutfitTitle">{title}</div>
                          <div className="savedOutfitMeta">
                            {createdAt ? `${createdAt} • ` : ""}
                            {itemCount} item{itemCount === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div className="savedOutfitItems" aria-label="Saved outfit items">
                          {details.length > 0
                            ? details.slice(0, 6).map((d, idx) => (
                                <div
                                  key={`${o?.saved_outfit_id || o?.outfit_signature}_${idx}`}
                                  className="savedOutfitItemChip"
                                >
                                  {d?.image_url ? (
                                    <img
                                      className="savedOutfitItemImg"
                                      src={d.image_url}
                                      alt={d?.name || "Item"}
                                    />
                                  ) : (
                                    <div className="savedOutfitItemPh" />
                                  )}
                                  <span className="savedOutfitItemName">
                                    {d?.name || "Item"}
                                  </span>
                                </div>
                              ))
                            : (Array.isArray(o?.items) ? o.items : []).slice(0, 6).map((id, idx) => (
                                <span
                                  key={`${o?.saved_outfit_id || o?.outfit_signature}_${idx}`}
                                  className="savedOutfitPill"
                                >
                                  {(id ?? "").toString().trim() || "item"}
                                </span>
                              ))}
                        </div>

                        <div className="savedOutfitActions">
                          <button className="btn primary" type="button" onClick={() => reuseOutfit(o)}>
                            Reuse
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

          </>
        ) : (
          <>
            <div className="noteBox" style={{ marginTop: 16 }}>
              Sign in to save outfits and access your profile.
            </div>

            <div className="loginButtons" style={{ marginTop: 18 }}>
              <button className="btn primary" type="button" onClick={() => navigate("/login")}>
                Sign in
              </button>
              <button className="btn" type="button" onClick={() => navigate("/dashboard")}>
                Continue
              </button>
              <button className="btn" type="button" onClick={() => navigate("/history")}>
                Outfit history
              </button>
              <button className="btn" type="button" onClick={() => { onResetOnboarding(); navigate("/"); }}>
                Redo Onboarding
              </button>
            </div>

            <div className="profileSection">
              <div className="dashCardTitle" style={{ marginBottom: 8 }}>
                Saved Outfits
              </div>
              <div className="dashSubText">Sign in to view saved outfits and reuse them.</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}