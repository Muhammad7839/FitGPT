import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { savedOutfitsApi } from "../api/savedOutfitsApi";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import { plannedOutfitsApi } from "../api/plannedOutfitsApi";
import { loadWardrobe } from "../utils/userStorage";
import { EVT_SAVED_OUTFITS_CHANGED } from "../utils/constants";
import { buildWardrobeMap, formatCardDate, labelFromSource, setReuseOutfit as setReuse, buildGoogleCalendarUrl, tomorrowDateStr } from "../utils/helpers";
import GuestModeNotice from "./GuestModeNotice";

export default function SavedOutfits() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [msg, setMsg] = useState("");
  const [confirmUnsave, setConfirmUnsave] = useState(null);
  const [plannedOutfit, setPlannedOutfit] = useState(null);


  const wardrobe = useMemo(() => loadWardrobe(user), [user]);

  const wardrobeById = useMemo(() => buildWardrobeMap(wardrobe), [wardrobe]);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const res = await savedOutfitsApi.listSaved(user);
      const list = Array.isArray(res?.saved_outfits) ? res.saved_outfits : [];
      setSaved(list);
    } catch (e) {
      setSaved([]);
      setMsg(e?.message || "Could not load saved outfits.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
   
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => refresh();
    const onFocus = () => refresh();

    window.addEventListener(EVT_SAVED_OUTFITS_CHANGED, onChanged);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener(EVT_SAVED_OUTFITS_CHANGED, onChanged);
      window.removeEventListener("focus", onFocus);
    };
   
  }, [refresh]);

  const sorted = useMemo(() => {
    return [...saved].sort((a, b) => {
      const da = (a?.created_at || "").toString();
      const db = (b?.created_at || "").toString();
      return db.localeCompare(da);
    });
  }, [saved]);

  function reuseOutfit(outfit) {
    const itemIds = outfit?.items || [];
    setReuse(itemIds, outfit?.saved_outfit_id);
    outfitHistoryApi.recordWorn({
      item_ids: itemIds,
      source: "saved",
      context: { occasion: outfit?.context?.occasion || "" },
    }, user).catch(() => {});
    navigate("/dashboard");
  }

  async function handleUnsave(outfit) {
    const sig = (outfit?.outfit_signature || "").toString().trim();
    if (!sig) return;

    try {
      const result = await savedOutfitsApi.unsaveOutfit(sig, user);
      setSaved((prev) => prev.filter((o) => (o?.outfit_signature || "") !== sig));
      setPlannedOutfit(null);
      setMsg(result?.localOnly ? "Outfit removed locally only. Backend sync failed." : "Outfit removed.");
      window.setTimeout(() => {
        setMsg("");
        setPlannedOutfit(null);
      }, 2500);
    } catch (e) {
      setPlannedOutfit(null);
      setMsg(e?.message || "Could not remove outfit.");
      window.setTimeout(() => {
        setMsg("");
        setPlannedOutfit(null);
      }, 2500);
    }
    setConfirmUnsave(null);
  }

  function resolveItem(id, outfit) {
    const trimmed = (id ?? "").toString().trim();
    const fromWardrobe = wardrobeById.get(trimmed);
    if (fromWardrobe) return fromWardrobe;

    const details = Array.isArray(outfit?.item_details) ? outfit.item_details : [];
    const match = details.find((d) => (d?.id ?? "").toString().trim() === trimmed);
    if (match) return match;

    return { id: trimmed, name: "Item", image_url: "" };
  }

  async function handlePlanForLater(outfit) {
    const date = tomorrowDateStr();
    const occasion = outfit?.context?.occasion || "";

    const itemIds = Array.isArray(outfit?.items) ? outfit.items : [];
    const itemDetails = itemIds.map((id) => {
      const item = resolveItem(id, outfit);
      return {
        id: (id ?? "").toString(),
        name: item?.name || "",
        category: item?.category || "",
        color: item?.color || "",
        image_url: item?.image_url || "",
      };
    });

    const calUrl = buildGoogleCalendarUrl({
      date,
      occasion,
      itemNames: itemDetails.map((d) => d.name),
    });
    window.open(calUrl, "_blank", "noopener");

    const result = await plannedOutfitsApi.planOutfit({
      item_ids: itemIds,
      item_details: itemDetails,
      planned_date: date,
      occasion,
      source: "planner",
    }, user).catch(() => null);

    if (result?.created) {
      setPlannedOutfit(result?.planned_outfit || null);
      setMsg(result?.localOnly ? "Outfit planned successfully. Backend sync is pending." : "Outfit planned successfully.");
    } else {
      setPlannedOutfit(null);
      setMsg(result?.message || "Could not plan outfit.");
    }
    window.setTimeout(() => {
      setMsg("");
      setPlannedOutfit(null);
    }, 2500);
  }

  const onHoloMove = useCallback((e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const angle = Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI) + 180;
    el.style.setProperty("--holo-angle", `${angle}deg`);
    el.style.setProperty("--holo-spot", `${x * 100}% ${y * 100}%`);
  }, []);

  if (!user) {
    return (
      <div className="onboarding onboardingPage">
        <div className="historyTopBar">
          <div>
            <div className="historyTitle">Saved Outfits</div>
            <div className="historySub">Sign in to save and revisit outfit combinations</div>
          </div>
        </div>
        <GuestModeNotice compact />
      </div>
    );
  }

  return (
    <div className="onboarding onboardingPage">
      <div className="historyTopBar">
        <div>
          <div className="historyTitle">Saved Outfits</div>
          <div className="historySub">Your favorite outfit combinations</div>
        </div>

        <div className="historyTopRight">

          <div className="historyControls">
            <button className="btn" onClick={refresh} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <div className="noteBox" style={{ marginTop: 12 }} role="status" aria-live="polite">
          <div>{msg}</div>
          {plannedOutfit ? (
            <div style={{ marginTop: 10 }}>
              <button className="btn" type="button" onClick={() => navigate("/plans")}>
                Open Plans
              </button>
            </div>
          ) : null}
        </div>
      )}

      {confirmUnsave && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Remove saved outfit?</div>
            <div className="modalSub">This outfit will be removed from your saved list.</div>
            <div className="modalActions">
              <button className="btn" onClick={() => setConfirmUnsave(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                style={{ background: "var(--color-danger, #e74c3c)" }}
                onClick={() => handleUnsave(confirmUnsave)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}


      {!loading && sorted.length === 0 && (
        <div className="historyList" style={{ marginTop: 14 }}>
          <div className="historyCard" style={{ justifyContent: "center", textAlign: "center", padding: 32 }}>
            <div className="historyCardTitle" style={{ marginTop: 0 }}>No saved outfits yet</div>
            <div className="historyItemsLine" style={{ marginTop: 8 }}>
              Save your favorite recommendations here so you can reuse them later in one tap.
            </div>
            <div className="historyActions" style={{ justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
              <button className="btn primary" onClick={() => navigate("/dashboard")}>
                Go to Recommendations
              </button>
              <button className="btn" onClick={() => navigate("/plans")}>
                Open Plans
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="historyList">
        {sorted.map((o) => {
          const date = formatCardDate(o?.created_at);
          const sourceLabel = labelFromSource(o?.source);
          const title = o?.context?.occasion || o?.name || "Saved Outfit";

          const itemIds = Array.isArray(o?.items) ? o.items : [];
          const previewIds = itemIds.slice(0, 4);

          return (
            <div key={o?.saved_outfit_id || o?.outfit_signature} className="historyCard" onPointerMove={onHoloMove}>
              <div className="historyCardLeft">
                <div className="historyThumbGrid">
                  {previewIds.map((id) => {
                    const item = resolveItem(id, o);
                    const img = item?.image_url;
                    const name = item?.name || "Item";

                    return (
                      <div key={`${o?.saved_outfit_id}_${id}`} className="historyThumbTile">
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
                  <div className="historyMetaDate">{date}</div>
                  <span className={`historyBadge ${sourceLabel.toLowerCase()}`}>
                    {sourceLabel}
                  </span>
                </div>

                <div className="historyCardTitle">{title}</div>

                <div className="historyItemsLine">
                  {itemIds
                    .map((id) => resolveItem(id, o)?.name || "Item")
                    .join(" | ")}
                </div>

                <div className="historyActions">
                  <button className="btn primary" onClick={() => reuseOutfit(o)}>
                    Wear Again
                  </button>
                  <button className="btn" onClick={() => handlePlanForLater(o)}>
                    Plan for Later
                  </button>
                  <button
                    className="btn"
                    style={{ color: "var(--color-danger, #e74c3c)" }}
                    onClick={() => setConfirmUnsave(o)}
                  >
                    Unsave
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
