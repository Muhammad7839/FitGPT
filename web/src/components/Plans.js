import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { plannedOutfitsApi } from "../api/plannedOutfitsApi";
import { loadAnswers, loadWardrobe } from "../utils/userStorage";
import { EVT_OUTFIT_HISTORY_CHANGED, EVT_PLANNED_OUTFITS_CHANGED } from "../utils/constants";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import { buildWardrobeMap, formatPlanDate, setReuseOutfit, buildGoogleCalendarUrl } from "../utils/helpers";
import GuestModeNotice from "./GuestModeNotice";
import PlanningCalendar from "./PlanningCalendar";
import UpcomingWeatherPlanner from "./UpcomingWeatherPlanner";
import TripPackingPlanner from "./TripPackingPlanner";

export default function Plans() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [planned, setPlanned] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const wardrobe = useMemo(() => loadWardrobe(user), [user]);
  const answers = useMemo(() => loadAnswers(user), [user]);

  const wardrobeById = useMemo(() => buildWardrobeMap(wardrobe), [wardrobe]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [plannedRes, historyRes] = await Promise.all([
        plannedOutfitsApi.listPlanned(user),
        outfitHistoryApi.listHistory(user),
      ]);
      const nextPlanned = Array.isArray(plannedRes?.planned_outfits) ? plannedRes.planned_outfits : [];
      const nextHistory = Array.isArray(historyRes?.history) ? historyRes.history : [];
      const sortedHistory = [...nextHistory].sort((a, b) => {
        const da = (a?.worn_at || "").toString();
        const db = (b?.worn_at || "").toString();
        return db.localeCompare(da);
      });

      setPlanned(nextPlanned);
      setHistory(sortedHistory);
    } catch {
      setPlanned([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const onChanged = () => refresh();
    window.addEventListener(EVT_PLANNED_OUTFITS_CHANGED, onChanged);
    window.addEventListener(EVT_OUTFIT_HISTORY_CHANGED, onChanged);
    return () => {
      window.removeEventListener(EVT_PLANNED_OUTFITS_CHANGED, onChanged);
      window.removeEventListener(EVT_OUTFIT_HISTORY_CHANGED, onChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(() => {
    return planned
      .filter((p) => (p?.planned_date || "") >= today)
      .sort((a, b) => (a?.planned_date || "").localeCompare(b?.planned_date || ""));
  }, [planned, today]);

  const past = useMemo(() => {
    return planned
      .filter((p) => (p?.planned_date || "") < today)
      .sort((a, b) => (b?.planned_date || "").localeCompare(a?.planned_date || ""));
  }, [planned, today]);

  const handleWearThis = (plan) => {
    const itemIds = plan?.item_ids || [];
    setReuseOutfit(itemIds, plan?.planned_id);
    outfitHistoryApi.recordWorn({
      item_ids: itemIds,
      source: "planner",
      context: { occasion: plan?.occasion || "" },
    }, user).catch(() => {});
    navigate("/dashboard");
  };

  const handleRemove = async (plannedId) => {
    try {
      const result = await plannedOutfitsApi.removePlanned(plannedId, user);
      refresh();
      if (result?.localOnly) {
        setMsg("Plan removed locally only. Backend sync failed.");
        window.setTimeout(() => setMsg(""), 2500);
      }
    } catch {
      setMsg("Could not remove plan.");
      window.setTimeout(() => setMsg(""), 2500);
    }
  };

  const handleWearAgain = (entry) => {
    const itemIds = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
    if (!itemIds.length) return;

    setReuseOutfit(itemIds, entry?.history_id || "");
    outfitHistoryApi.recordWorn({
      item_ids: itemIds,
      source: "history",
      context: entry?.context || {},
    }, user).catch(() => {});
    navigate("/dashboard");
  };

  const handleOpenGoogleCalendar = (plan) => {
    const names = (Array.isArray(plan?.item_details) ? plan.item_details : []).map((d) => d?.name).filter(Boolean);
    const url = buildGoogleCalendarUrl({ date: plan?.planned_date, occasion: plan?.occasion, itemNames: names });
    window.open(url, "_blank", "noopener");
  };

  const renderCard = (p) => {
    const details = Array.isArray(p?.item_details) ? p.item_details : [];
    const previewIds = Array.isArray(p?.item_ids) ? p.item_ids : [];

    return (
      <div key={p?.planned_id} className="plannedCard">
        <div className="plannedCardTop">
          <div>
            <div className="plannedCardDate">{formatPlanDate(p?.planned_date)}</div>
            {p?.occasion && <div className="plannedCardOccasion">{p.occasion}</div>}
          </div>
          <span className="historyBadge planned">Planned</span>
        </div>

        <div className="savedOutfitItems" style={{ marginTop: 10 }}>
          {details.length > 0
            ? details.map((d, idx) => (
                <div key={`${p?.planned_id}_d_${idx}`} className="savedOutfitItemChip">
                  {d?.image_url ? (
                    <img className="savedOutfitItemImg" src={d.image_url} alt={d?.name || "Item"} />
                  ) : (
                    <div className="savedOutfitItemPh" />
                  )}
                  <span className="savedOutfitItemName">{d?.name || "Item"}</span>
                </div>
              ))
            : previewIds.map((id, idx) => {
                const item = wardrobeById.get((id ?? "").toString().trim());
                return (
                  <div key={`${p?.planned_id}_i_${idx}`} className="savedOutfitItemChip">
                    {item?.image_url ? (
                      <img className="savedOutfitItemImg" src={item.image_url} alt={item?.name || "Item"} />
                    ) : (
                      <div className="savedOutfitItemPh" />
                    )}
                    <span className="savedOutfitItemName">{item?.name || "Item"}</span>
                  </div>
                );
              })}
        </div>

        <div className="historyActions" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => handleWearThis(p)}>
            Wear This
          </button>
          <button className="btn" onClick={() => handleOpenGoogleCalendar(p)}>
            Add to Google Calendar
          </button>
          <button className="btn" onClick={() => handleRemove(p?.planned_id)}>
            Remove
          </button>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="onboarding onboardingPage">
        <div className="historyTopBar">
          <div>
            <div className="historyTitle">Planned Outfits</div>
            <div className="historySub">Sign in to save calendar-ready outfit plans</div>
          </div>
        </div>
        <UpcomingWeatherPlanner wardrobe={wardrobe} user={user} isGuestMode={!user} answers={answers} />
        <TripPackingPlanner wardrobe={wardrobe} user={user} answers={answers} />
        <GuestModeNotice compact />
      </div>
    );
  }

  return (
    <div className="onboarding onboardingPage">
      <div className="historyTopBar">
        <div>
          <div className="historyTitle">Planned Outfits</div>
          <div className="historySub">Manage your upcoming outfit plans</div>
        </div>

        <div className="historyTopRight">
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <UpcomingWeatherPlanner wardrobe={wardrobe} user={user} isGuestMode={!user} answers={answers} />
      <TripPackingPlanner wardrobe={wardrobe} user={user} answers={answers} />
      <PlanningCalendar
        plans={upcoming}
        history={history}
        wardrobeById={wardrobeById}
        onWearThis={handleWearThis}
        onRemovePlan={handleRemove}
        onAddToGoogleCalendar={handleOpenGoogleCalendar}
        onWearAgain={handleWearAgain}
      />

      {msg && <div className="noteBox" style={{ marginTop: 12 }}>{msg}</div>}

      {!loading && upcoming.length === 0 && past.length === 0 && (
        <div className="profileEmpty" style={{ marginTop: 24 }}>
          <div className="dashStrong">No planned outfits yet</div>
          <div className="dashSubText" style={{ marginTop: 6 }}>
            Plan looks ahead for class, work, events, or weekends so you already know what to wear.
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn primary" type="button" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </button>
            <button className="btn" type="button" onClick={() => navigate("/history")}>
              Open History
            </button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="plannedSection">
          <div className="plannedSectionTitle">Upcoming</div>
          <div className="plannedList">
            {upcoming.map(renderCard)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="plannedSection">
          <div className="plannedSectionTitle">Past Plans</div>
          <div className="plannedList">
            {past.map(renderCard)}
          </div>
        </section>
      )}

    </div>
  );
}
