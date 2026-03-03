import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import { savedOutfitsApi } from "../api/savedOutfitsApi";
import { loadWardrobe } from "../utils/userStorage";

const REUSE_OUTFIT_KEY = "fitgpt_reuse_outfit_v1";

function formatTodayTopRight() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCardDate(iso) {
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

function withinDays(iso, days) {
  if (!days) return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;
  return now - t <= ms;
}

function labelFromSource(src) {
  const s = (src || "").toString().trim().toLowerCase();
  if (s === "planner") return "Planned";
  return "Recommended";
}

function setReuseOutfit(itemIds, historyId) {
  const ids = savedOutfitsApi.normalizeItems(itemIds);
  sessionStorage.setItem(
    REUSE_OUTFIT_KEY,
    JSON.stringify({
      items: ids,
      saved_outfit_id: historyId || "",
    })
  );
}

function monthKey(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
}

function isSameMonth(iso, nowDate) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return monthKey(new Date(iso)) === monthKey(nowDate);
}

function signatureFromIds(ids) {
  const norm = savedOutfitsApi.normalizeItems(ids);
  return norm.join("|");
}

export default function History() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState([]);
  const [confirmClear, setConfirmClear] = useState(false);

  const wardrobe = useMemo(() => loadWardrobe(user), [user]);

  const wardrobeById = useMemo(() => {
    const map = new Map();
    for (const it of Array.isArray(wardrobe) ? wardrobe : []) {
      const id = (it?.id ?? "").toString().trim();
      if (!id) continue;
      if (!map.has(id)) map.set(id, it);
    }
    return map;
  }, [wardrobe]);

  const refresh = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await outfitHistoryApi.listHistory(user);
      const list = Array.isArray(res?.history) ? res.history : [];

      const sorted = [...list].sort((a, b) => {
        const da = (a?.worn_at || "").toString();
        const db = (b?.worn_at || "").toString();
        return db.localeCompare(da);
      });

      setHistory(sorted);
    } catch (e) {
      setHistory([]);
      setMsg(e?.message || "Could not load history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    const d = range === "7" ? 7 : range === "30" ? 30 : 0;
    return (Array.isArray(history) ? history : []).filter((h) =>
      withinDays(h?.worn_at, d)
    );
  }, [history, range]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const monthEntries = (Array.isArray(history) ? history : []).filter((h) =>
      isSameMonth(h?.worn_at, now)
    );

    const outfitsWorn = monthEntries.length;

    const uniqueCombos = new Set(
      monthEntries.map((h) =>
        signatureFromIds(Array.isArray(h?.item_ids) ? h.item_ids : [])
      )
    ).size;

    const itemCounts = new Map();
    for (const h of monthEntries) {
      const ids = Array.isArray(h?.item_ids) ? h.item_ids : [];
      for (const rawId of ids) {
        const id = (rawId ?? "").toString().trim();
        if (!id) continue;
        itemCounts.set(id, (itemCounts.get(id) || 0) + 1);
      }
    }

    let mostWornItemId = "";
    let mostWornCount = 0;
    for (const [id, count] of itemCounts.entries()) {
      if (count > mostWornCount) {
        mostWornCount = count;
        mostWornItemId = id;
      }
    }

    const mostWornItemName = mostWornItemId
      ? wardrobeById.get(mostWornItemId)?.name || "—"
      : "—";

    const occCounts = new Map();
    for (const h of monthEntries) {
      const occ = (h?.context?.occasion || "").toString().trim();
      if (!occ) continue;
      occCounts.set(occ, (occCounts.get(occ) || 0) + 1);
    }

    let topOccasion = "—";
    let topOccCount = 0;
    for (const [occ, count] of occCounts.entries()) {
      if (count > topOccCount) {
        topOccCount = count;
        topOccasion = occ;
      }
    }

    return {
      outfitsWorn,
      uniqueCombos,
      mostWornItemName,
      topOccasion,
    };
  }, [history, wardrobeById]);

  const handleWearAgain = (entry) => {
    const itemIds = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
    if (!itemIds.length) return;

    setReuseOutfit(itemIds, entry?.history_id || "");
    navigate("/dashboard");
  };

  const handleClearHistory = async () => {
    try {
      await outfitHistoryApi.clearHistory(user);
      setHistory([]);
      setMsg("History cleared.");
    } catch {
      setMsg("Could not clear history.");
    }
    setConfirmClear(false);
    window.setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="historyTopBar">
        <div>
          <div className="historyTitle">Outfit History</div>
          <div className="historySub">Track what you've worn</div>
        </div>

        <div className="historyTopRight">
          <div className="historyDate">{formatTodayTopRight()}</div>

          <div className="historyControls">
            <select
              className="historySelect"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="0">All</option>
            </select>

            <button className="btn" onClick={refresh} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>

            {history.length > 0 && (
              <button
                className="btn"
                style={{ color: "var(--color-danger, #e74c3c)" }}
                onClick={() => setConfirmClear(true)}
              >
                Clear History
              </button>
            )}
          </div>
        </div>
      </div>

      {msg && <div className="noteBox" style={{ marginTop: 12 }}>{msg}</div>}

      {confirmClear && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Clear all outfit history?</div>
            <div className="modalSub">This cannot be undone.</div>
            <div className="modalActions">
              <button className="btn" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                style={{ background: "var(--color-danger, #e74c3c)" }}
                onClick={handleClearHistory}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="historyList">
        {filtered.map((h) => {
          const wornAt = formatCardDate(h?.worn_at);
          const sourceLabel = labelFromSource(h?.source);
          const title = h?.context?.occasion || "Outfit";

          const itemIds = Array.isArray(h?.item_ids) ? h.item_ids : [];
          const previewIds = itemIds.slice(0, 4);

          return (
            <div key={h?.history_id || h?.worn_at} className="historyCard">
              <div className="historyCardLeft">
                <div className="historyThumbGrid">
                  {previewIds.map((id) => {
                    const item = wardrobeById.get((id ?? "").toString().trim());
                    const img = item?.image_url;
                    const name = item?.name || "Item";

                    return (
                      <div key={`${h?.history_id}_${id}`} className="historyThumbTile">
                        {img ? (
                          <img className="historyThumbImg" src={img} alt={name} />
                        ) : (
                          <div className="historyThumbPh" />
                        )}
                        <div className="historyThumbLabel">{name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="historyCardRight">
                <div className="historyMetaRow">
                  <div className="historyMetaDate">{wornAt}</div>
                  <span className={`historyBadge ${sourceLabel.toLowerCase()}`}>
                    {sourceLabel}
                  </span>
                </div>

                <div className="historyCardTitle">{title}</div>

                <div className="historyItemsLine">
                  {previewIds
                    .map(
                      (id) =>
                        wardrobeById.get((id ?? "").toString().trim())?.name || "Item"
                    )
                    .join(" • ")}
                </div>

                <div className="historyActions">
                  <button className="btn primary" onClick={() => handleWearAgain(h)}>
                    Wear Again
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* STATS AT BOTTOM */}
      <section className="card dashWide historyStatsCard" style={{ marginTop: 18 }}>
        <div className="historyStatsTitle">This Month's Activity</div>

        <div className="historyStatsGrid">
          <div className="historyStatTile">
            <div className="historyStatIcon">&#x1F455;</div>
            <div className="historyStatNumber">{monthlyStats.outfitsWorn}</div>
            <div className="historyStatLabel">Outfits Worn</div>
          </div>

          <div className="historyStatTile">
            <div className="historyStatIcon">&#x2728;</div>
            <div className="historyStatNumber">{monthlyStats.uniqueCombos}</div>
            <div className="historyStatLabel">Unique Combos</div>
          </div>

          <div className="historyStatTile historyStatTileText">
            <div className="historyStatIcon">&#x1F451;</div>
            <div className="historyStatValue">{monthlyStats.mostWornItemName || "—"}</div>
            <div className="historyStatLabel">Most Worn Item</div>
          </div>

          <div className="historyStatTile historyStatTileText">
            <div className="historyStatIcon">&#x1F3AF;</div>
            <div className="historyStatValue">{monthlyStats.topOccasion || "—"}</div>
            <div className="historyStatLabel">Top Occasion</div>
          </div>
        </div>
      </section>

      <div className="historyCallout">
        <div className="historyCalloutIcon">✦</div>
        <div className="historyCalloutText">
          <span className="historyCalloutStrong">Smart Recommendations:</span> FitGPT tracks your history to avoid suggesting recently worn outfits, keeping your style fresh.
        </div>
      </div>

      <nav className="dashBottomNav" aria-label="Dashboard navigation">
        <NavLink to="/dashboard" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Home
        </NavLink>
        <NavLink to="/wardrobe" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Wardrobe
        </NavLink>
        <NavLink to="/favorites" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Favorites
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          History
        </NavLink>
        <NavLink to="/saved-outfits" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Saved
        </NavLink>
        <NavLink to="/plans" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Plans
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Profile
        </NavLink>
      </nav>
    </div>
  );
}