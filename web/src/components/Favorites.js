// web/src/components/Favorites.js
import React, { useEffect, useState } from "react";

const FAVORITES_KEY = "fitgpt_favorites_v1";

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

function titleCase(text) {
  if (!text) return "";
  return text
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export default function Favorites() {
  const [favorites, setFavorites] = useState(() => loadFavorites());

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  // Listen for external changes (e.g. saving from Dashboard)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === FAVORITES_KEY) setFavorites(loadFavorites());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const removeFavorite = (id) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div>
      <div className="wdHeader">
        <div>
          <h2 className="wdTitle">Saved Outfits</h2>
          <div className="dashSubText">
            {favorites.length} outfit{favorites.length !== 1 ? "s" : ""} saved
          </div>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="card wdEmpty">
          <div className="wdEmptyIcon">{"\u2764\uFE0F"}</div>
          <div className="wdEmptyTitle">No saved outfits yet</div>
          <div className="dashSubText">
            When you save an outfit from your daily recommendation, it will show up here so you can
            wear it again.
          </div>
        </div>
      ) : (
        <div className="favGrid">
          {favorites.map((fav) => (
            <div key={fav.id} className="card favCard">
              <div className="favHeader">
                <div className="dashStrong">{fav.name || "Saved outfit"}</div>
                <button
                  type="button"
                  className="linkBtn wdDeleteBtn"
                  onClick={() => removeFavorite(fav.id)}
                >
                  Remove
                </button>
              </div>

              <div className="favItems">
                {(fav.items || []).map((item, i) => (
                  <div key={i} className="favItem">
                    <span className="favItemDot" />
                    <span className="dashStrong">{item.name || "Item"}</span>
                    <span className="dashMuted">
                      {item.category ? ` \u00B7 ${titleCase(item.category)}` : ""}
                      {item.color ? ` \u00B7 ${titleCase(item.color)}` : ""}
                    </span>
                  </div>
                ))}
              </div>

              {fav.savedAt && (
                <div className="favDate">
                  Saved {new Date(fav.savedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
