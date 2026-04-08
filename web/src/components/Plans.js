import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { plannedOutfitsApi } from "../api/plannedOutfitsApi";
import { loadAnswers } from "../utils/userStorage";
import { EVT_OUTFIT_HISTORY_CHANGED, EVT_PLANNED_OUTFITS_CHANGED } from "../utils/constants";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import {
  buildWardrobeMap,
  formatCardDate,
  formatPlanDate,
  idsSignature,
  labelFromSource,
  monthKey,
  setReuseOutfit,
  buildGoogleCalendarUrl,
} from "../utils/helpers";
import useWardrobe from "../hooks/useWardrobe";
import GuestModeNotice from "./GuestModeNotice";
import UpcomingWeatherPlanner from "./UpcomingWeatherPlanner";
import TripPackingPlanner from "./TripPackingPlanner";
import PlanningCalendar from "./PlanningCalendar";

function withinDays(iso, days) {
  if (!days) return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;
  return now - t <= ms;
}

function isSameMonth(iso, nowDate) {
  return monthKey(iso) !== "" && monthKey(iso) === monthKey(nowDate);
}

export default function Plans() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [planned, setPlanned] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [timelineRange, setTimelineRange] = useState("30");
  const [confirmClear, setConfirmClear] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showPastPlans, setShowPastPlans] = useState(false);

  const wardrobe = useWardrobe(user);
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

  const filteredHistory = useMemo(() => {
    const d = timelineRange === "7" ? 7 : timelineRange === "30" ? 30 : 0;
    return (Array.isArray(history) ? history : []).filter((entry) => withinDays(entry?.worn_at, d));
  }, [history, timelineRange]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const monthEntries = (Array.isArray(history) ? history : []).filter((entry) =>
      isSameMonth(entry?.worn_at, now)
    );

    const outfitsWorn = monthEntries.length;
    const uniqueCombos = new Set(
      monthEntries.map((entry) =>
        idsSignature(Array.isArray(entry?.item_ids) ? entry.item_ids : [])
      )
    ).size;

    const itemCounts = new Map();
    for (const entry of monthEntries) {
      const ids = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
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
      ? wardrobeById.get(mostWornItemId)?.name || "-"
      : "-";

    const occCounts = new Map();
    for (const entry of monthEntries) {
      const occasion = (entry?.context?.occasion || "").toString().trim();
      if (!occasion) continue;
      occCounts.set(occasion, (occCounts.get(occasion) || 0) + 1);
    }

    let topOccasion = "-";
    let topOccCount = 0;
    for (const [occasion, count] of occCounts.entries()) {
      if (count > topOccCount) {
        topOccCount = count;
        topOccasion = occasion;
      }
    }

    return {
      outfitsWorn,
      uniqueCombos,
      mostWornItemName,
      topOccasion,
    };
  }, [history, wardrobeById]);

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

  const handleRemove = async (plannedId) => {
    try {
      await plannedOutfitsApi.removePlanned(plannedId, user);
      refresh();
    } catch {
      setMsg("Could not remove plan.");
      window.setTimeout(() => setMsg(""), 2500);
    }
  };

  const handleOpenGoogleCalendar = (plan) => {
    const names = (Array.isArray(plan?.item_details) ? plan.item_details : []).map((d) => d?.name).filter(Boolean);
    const url = buildGoogleCalendarUrl({ date: plan?.planned_date, occasion: plan?.occasion, itemNames: names });
    window.open(url, "_blank", "noopener");
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

  return (
    <div className="onboarding onboardingPage">
      <div className="historyTopBar">
        <div>
          <div className="historyTitle">Planning</div>
          {user ? (
            <div className="historySub">
              Open your calendar, upcoming outfits, timeline, and past plans in one place
            </div>
          ) : null}
        </div>

        {user ? (
          <div className="historyTopRight">
            <button className="btn" onClick={refresh} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        ) : null}
      </div>

      <UpcomingWeatherPlanner
        wardrobe={wardrobe}
        user={user}
        isGuestMode={!user}
        answers={answers}
      />

      <TripPackingPlanner
        wardrobe={wardrobe}
        user={user}
        answers={answers}
      />

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

      {!user ? (
        <div style={{ marginTop: 18 }}>
          <GuestModeNotice compact />
        </div>
      ) : null}

      {user && !loading && upcoming.length === 0 && past.length === 0 && history.length === 0 && (
        <div className="profileEmpty" style={{ marginTop: 24 }}>
          <div className="dashStrong">No planned outfits yet</div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn primary" type="button" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </button>
            <button className="btn" type="button" onClick={() => navigate("/history")}>
              Open Insights
            </button>
          </div>
        </div>
      )}

      {user ? (
        <>
          <div className="planningToggleStack">
            <button
              type="button"
              className={`planningSectionToggle${showCalendar ? " active" : ""}`}
              onClick={() => setShowCalendar((current) => !current)}
              aria-expanded={showCalendar}
            >
              <span>Calendar</span>
              <span className="planningSectionToggleMeta">
                {upcoming.length} upcoming | {history.length} worn
              </span>
            </button>

            {showCalendar ? (
              <PlanningCalendar
                plans={upcoming}
                history={history}
                wardrobeById={wardrobeById}
                onWearThis={handleWearThis}
                onRemovePlan={handleRemove}
                onAddToGoogleCalendar={handleOpenGoogleCalendar}
                onWearAgain={handleWearAgain}
              />
            ) : null}
          </div>

          <div className="planningToggleStack">
            <button
              type="button"
              className={`planningSectionToggle${showTimeline ? " active" : ""}`}
              onClick={() => setShowTimeline((current) => !current)}
              aria-expanded={showTimeline}
            >
              <span>Timeline</span>
              <span className="planningSectionToggleMeta">
                {filteredHistory.length} look{filteredHistory.length === 1 ? "" : "s"} in range
              </span>
            </button>

            {showTimeline ? (
              <section className="card dashWide planningTimelineCard">
                <div className="planningTimelineHeader">
                  <div>
                    <div className="plannedCalendarEyebrow">Outfit Timeline</div>
                    <div className="plannedCalendarTitle">What you wore</div>
                    <div className="plannedCalendarSub">
                      Browse recent looks without leaving Planning.
                    </div>
                  </div>
                </div>

                <div className="historyControls" style={{ marginTop: 14 }}>
                  <select
                    className="historySelect"
                    value={timelineRange}
                    onChange={(e) => setTimelineRange(e.target.value)}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="0">All</option>
                  </select>

                  <button className="btn" onClick={refresh} disabled={loading}>
                    {loading ? "Loading..." : "Refresh"}
                  </button>

                  {history.length > 0 ? (
                    <button
                      className="btn"
                      style={{ color: "var(--color-danger, #e74c3c)" }}
                      onClick={() => setConfirmClear(true)}
                    >
                      Clear History
                    </button>
                  ) : null}
                </div>

                {filteredHistory.length > 0 ? (
                  <div className="historyList">
                    {filteredHistory.map((entry) => {
                      const wornAt = formatCardDate(entry?.worn_at);
                      const sourceLabel = labelFromSource(entry?.source);
                      const title = entry?.context?.occasion || "Outfit";
                      const itemIds = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
                      const previewIds = itemIds.slice(0, 4);

                      return (
                        <div key={entry?.history_id || entry?.worn_at} className="historyCard">
                          <div className="historyCardLeft">
                            <div className="historyThumbGrid">
                              {previewIds.map((id) => {
                                const item = wardrobeById.get((id ?? "").toString().trim());
                                const img = item?.image_url;
                                const name = item?.name || "Item";

                                return (
                                  <div key={`${entry?.history_id}_${id}`} className="historyThumbTile">
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
                                .map((id) =>
                                  wardrobeById.get((id ?? "").toString().trim())?.name || "Item"
                                )
                                .join(" | ")}
                            </div>

                            <div className="historyActions">
                              <button className="btn primary" onClick={() => handleWearAgain(entry)}>
                                Wear Again
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <section className="card dashWide historyStatsCard historyRangeEmpty" style={{ marginTop: 14 }}>
                    <div className="historyStatsEmpty">
                      <div className="historyStatsEmptyIcon">&#x1F5D3;</div>
                      <div className="historyStatsEmptyTitle">No outfits in this range</div>
                      <div className="historyStatsEmptySub">
                        Try a wider range or open the calendar above to browse your full outfit history.
                      </div>
                    </div>
                  </section>
                )}
              </section>
            ) : null}
          </div>

          <div className="planningToggleStack">
            <button
              type="button"
              className={`planningSectionToggle${showPastPlans ? " active" : ""}`}
              onClick={() => setShowPastPlans((current) => !current)}
              aria-expanded={showPastPlans}
            >
              <span>Past Plans</span>
              <span className="planningSectionToggleMeta">
                {past.length} saved
              </span>
            </button>

            {showPastPlans ? (
              past.length > 0 ? (
                <section className="plannedSection">
                  <div className="plannedList">
                    {past.map(renderCard)}
                  </div>
                </section>
              ) : (
                <div className="plannedCalendarEmpty" style={{ marginTop: 12 }}>
                  No past plans yet.
                </div>
              )
            ) : null}
          </div>

          <section className="card dashWide historyStatsCard" style={{ marginTop: 18 }}>
            <div className="historyStatsTitle">This Month's Activity</div>

            {monthlyStats.outfitsWorn === 0 ? (
              <div className="historyStatsEmpty">
                <div className="historyStatsEmptyIcon">&#x1F4C5;</div>
                <div className="historyStatsEmptyTitle">No activity yet this month</div>
                <div className="historyStatsEmptySub">
                  Wear an outfit from your recommendations to start tracking your style stats.
                </div>
                <div style={{ marginTop: 14 }}>
                  <button className="btn primary" type="button" onClick={() => navigate("/dashboard")}>
                    Pick an outfit
                  </button>
                </div>
              </div>
            ) : (
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
                  <div className="historyStatValue">{monthlyStats.mostWornItemName || "-"}</div>
                  <div className="historyStatLabel">Most Worn Item</div>
                </div>

                <div className="historyStatTile historyStatTileText">
                  <div className="historyStatIcon">&#x1F3AF;</div>
                  <div className="historyStatValue">{monthlyStats.topOccasion || "-"}</div>
                  <div className="historyStatLabel">Top Occasion</div>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}

    </div>
  );
}
