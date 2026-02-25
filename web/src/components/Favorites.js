
import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

const WARDROBE_KEY = "fitgpt_wardrobe_v1";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadWardrobe() {
  const raw = localStorage.getItem(WARDROBE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function saveWardrobe(items) {
  localStorage.setItem(WARDROBE_KEY, JSON.stringify(items));
}

export default function Favorites() {
  const [items, setItems] = useState(() => loadWardrobe());
  const [query, setQuery] = useState("");

  const favorites = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((it) => {
      if (it.is_active === false) return false;
      if (it.is_favorite !== true) return false;

      if (!q) return true;
      return `${it.name} ${it.color} ${it.category}`.toLowerCase().includes(q);
    });
  }, [items, query]);

  const unFavorite = (id) => {
    const next = items.map((it) =>
      it.id === id ? { ...it, is_favorite: false } : it
    );

    setItems(next);

    // keep storage lightweight
    const nextForStorage = next.map((it) => ({ ...it, image_url: "" }));
    saveWardrobe(nextForStorage);
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="wardrobeHeader">
        <div>
          <div className="wardrobeTitleRow">
            <div className="wardrobeTitle">Favorites</div>
          </div>
          <div className="wardrobeSub">Your saved wardrobe items</div>
        </div>
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
        {favorites.map((it) => (
          <div key={it.id} className="wardrobeCard">
            <div className="wardrobeThumbWrap">
              {it.image_url ? (
                <img className="wardrobeThumbImg" src={it.image_url} alt={it.name} />
              ) : (
                <div className="wardrobeThumb" aria-hidden="true" />
              )}
            </div>

            <div className="wardrobeCardBody">
              <div className="wardrobeItemName">{it.name}</div>
              <div className="wardrobeItemMeta">
                {it.category} · {it.color}
              </div>

              <div className="wardrobeCardActions">
                <button
                  type="button"
                  className="wardrobeIconBtn fav active"
                  onClick={() => unFavorite(it.id)}
                  aria-label="Remove from favorites"
                  title="Unfavorite"
                >
                  ♥
                </button>
              </div>
            </div>
          </div>
        ))}

        {!favorites.length ? (
          <div className="wardrobeEmpty">
            <div className="wardrobeEmptyTitle">No favorites yet</div>
            <div className="wardrobeEmptySub">
              Tap the heart on items in Wardrobe to save them here.
            </div>
          </div>
        ) : null}
      </section>

      <nav className="dashBottomNav" aria-label="Dashboard navigation">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}
        >
          Today
        </NavLink>

        <NavLink
          to="/wardrobe"
          className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}
        >
          Wardrobe
        </NavLink>

        <NavLink
          to="/favorites"
          className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}
        >
          Favorites
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}
        >
          Profile
        </NavLink>
      </nav>
    </div>
  );
}