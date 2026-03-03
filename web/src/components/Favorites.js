import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const WARDROBE_KEY = "fitgpt_wardrobe_v1";
const GUEST_WARDROBE_KEY = "fitgpt_guest_wardrobe_v1";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readWardrobeFromStorage(storageObj, key) {
  const raw = storageObj.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function loadWardrobeForUser(isSignedIn) {
  if (isSignedIn) return readWardrobeFromStorage(localStorage, WARDROBE_KEY);
  return readWardrobeFromStorage(sessionStorage, GUEST_WARDROBE_KEY);
}

function saveWardrobeForUser(isSignedIn, items) {
  const safe = Array.isArray(items) ? items : [];
  if (isSignedIn) {
    localStorage.setItem(WARDROBE_KEY, JSON.stringify(safe));
  } else {
    sessionStorage.setItem(GUEST_WARDROBE_KEY, JSON.stringify(safe));
    window.dispatchEvent(new Event("fitgpt:guest-wardrobe-changed"));
  }
}

function normalizeId(id) {
  return (id ?? "").toString().trim();
}

function itemMatchesQuery(item, qLower) {
  if (!qLower) return true;
  const blob = `${item?.name || ""} ${item?.color || ""} ${item?.category || ""}`.toLowerCase();
  return blob.includes(qLower);
}

function ensureUniqueById(list) {
  const seen = new Set();
  const out = [];
  for (const it of Array.isArray(list) ? list : []) {
    const id = normalizeId(it?.id);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

export default function Favorites() {
  const { user } = useAuth();
  const isSignedIn = Boolean(user);
  const navigate = useNavigate();

  const [items, setItems] = useState(() => loadWardrobeForUser(isSignedIn));
  const [query, setQuery] = useState("");

  useEffect(() => {
    setItems(loadWardrobeForUser(isSignedIn));
  }, [isSignedIn]);

  useEffect(() => {
    const refresh = () => setItems(loadWardrobeForUser(isSignedIn));

    const onStorage = (e) => {
      if (isSignedIn && e.key === WARDROBE_KEY) refresh();
    };

    const onFocus = () => refresh();

    const onGuestWardrobeChanged = () => {
      if (!isSignedIn) refresh();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("fitgpt:guest-wardrobe-changed", onGuestWardrobeChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("fitgpt:guest-wardrobe-changed", onGuestWardrobeChanged);
    };
  }, [isSignedIn]);

  const favorites = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = (Array.isArray(items) ? items : []).filter((it) => {
      if (!it) return false;
      if (it.is_active === false) return false;
      if (it.is_favorite !== true) return false;
      return itemMatchesQuery(it, q);
    });

    return ensureUniqueById(filtered);
  }, [items, query]);

  const unFavorite = (idRaw) => {
    const id = normalizeId(idRaw);
    if (!id) return;

    const next = (Array.isArray(items) ? items : []).map((it) => {
      if (!it) return it;
      const itId = normalizeId(it.id);
      if (itId !== id) return it;
      return { ...it, is_favorite: false };
    });

    setItems(next);
    saveWardrobeForUser(isSignedIn, next);
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="wardrobeHeader">
        <div>
          <div className="wardrobeTitleRow">
            <div className="wardrobeTitle">Favorites</div>
          </div>
          <div className="wardrobeSub">{isSignedIn ? "Your saved wardrobe items" : "Favorites (guest session)"}</div>
        </div>

        {!isSignedIn ? (
          <button type="button" className="btn primary" onClick={() => navigate("/auth")}>
            Sign in to save permanently
          </button>
        ) : null}
      </div>

      <section className="wardrobeControls">
        <div className="wardrobeSearchWrap">
          <input
            className="wardrobeSearch"
            placeholder="Search favorites..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>

      <section className="wardrobeGrid">
        {favorites.map((it) => {
          const id = normalizeId(it?.id);
          return (
            <div key={id} className="wardrobeCard">
              <div className="wardrobeThumbWrap">
                {it?.image_url ? (
                  <img className="wardrobeThumbImg" src={it.image_url} alt={it?.name || "Wardrobe item"} />
                ) : (
                  <div className="wardrobeThumb" aria-hidden="true" />
                )}
              </div>

              <div className="wardrobeCardBody">
                <div className="wardrobeItemName">{it?.name || "Wardrobe item"}</div>
                <div className="wardrobeItemMeta">
                  {(it?.category || "Item")} · {(it?.color || "Color")}
                </div>

                <div className="wardrobeCardActions">
                  <button
                    type="button"
                    className="wardrobeIconBtn fav active"
                    onClick={() => unFavorite(id)}
                    aria-label="Remove from favorites"
                    title="Unfavorite"
                  >
                    ♥
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!favorites.length ? (
          <div className="wardrobeEmpty">
            <div className="wardrobeEmptyTitle">No favorites yet</div>
            <div className="wardrobeEmptySub">Tap the heart on items in Wardrobe to save them here.</div>

            <div style={{ marginTop: 14 }}>
              <button className="btn primary" type="button" onClick={() => navigate("/wardrobe")}>
                Go to Wardrobe
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <nav className="dashBottomNav" aria-label="Dashboard navigation">
        <NavLink to="/dashboard" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Home
        </NavLink>

        <NavLink to="/wardrobe" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Wardrobe
        </NavLink>

        <NavLink to="/history" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          History
        </NavLink>

        <NavLink to="/profile" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Profile
        </NavLink>

        <NavLink to="/favorites" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Favorites
        </NavLink>
      </nav>
    </div>
  );
}