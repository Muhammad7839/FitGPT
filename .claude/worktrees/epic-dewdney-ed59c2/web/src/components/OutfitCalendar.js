import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import { loadWardrobe } from "../utils/userStorage";
import { buildWardrobeMap, formatCardDate, labelFromSource, setReuseOutfit } from "../utils/helpers";
import { analyzeHistoryPatterns, groupHistoryByDate } from "../utils/recommendationEngine";

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OutfitCalendarContent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  const wardrobe = useMemo(() => loadWardrobe(user), [user]);
  const wardrobeById = useMemo(() => buildWardrobeMap(wardrobe), [wardrobe]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    outfitHistoryApi.listHistory(user).then((res) => {
      if (!alive) return;
      setHistory(Array.isArray(res?.history) ? res.history : []);
    }).catch(() => {
      if (alive) setHistory([]);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [user]);

  const byDate = useMemo(() => groupHistoryByDate(history), [history]);
  const patterns = useMemo(() => analyzeHistoryPatterns(history, wardrobe), [history, wardrobe]);

  const todayKey = useMemo(() => {
    const d = new Date();
    return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const isCurrentMonth = viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
    setSelectedDate(null);
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(null);
  };

  /* ── Build calendar grid ───────────────────────────────────────────── */
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = startDayOfMonth(viewYear, viewMonth);
  const weeks = [];
  let week = new Array(startDay).fill(null);

  for (let day = 1; day <= totalDays; day++) {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  /* ── Selected day entries ──────────────────────────────────────────── */
  const selectedEntries = useMemo(() => {
    if (!selectedDate) return [];
    const entries = byDate[selectedDate] || [];
    return [...entries].sort((a, b) => {
      const ta = new Date(a?.worn_at).getTime() || 0;
      const tb = new Date(b?.worn_at).getTime() || 0;
      return tb - ta;
    });
  }, [selectedDate, byDate]);

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

  /* ── Month activity stats ──────────────────────────────────────────── */
  const monthStats = useMemo(() => {
    let count = 0;
    const prefix = `${viewYear}-${pad2(viewMonth + 1)}-`;
    for (const key of Object.keys(byDate)) {
      if (key.startsWith(prefix)) count += byDate[key].length;
    }
    const daysWithOutfits = Object.keys(byDate).filter((k) => k.startsWith(prefix)).length;
    return { count, daysWithOutfits };
  }, [byDate, viewYear, viewMonth]);

  if (loading) {
    return (
      <div className="tabContentFadeIn">
        <div className="calendarLoading">Loading outfit calendar...</div>
      </div>
    );
  }

  return (
    <div className="tabContentFadeIn">

      {/* ── Month navigation ─────────────────────────────────────────── */}
      <div className="calendarNav">
        <button className="calendarNavBtn" onClick={prevMonth} aria-label="Previous month">&lsaquo;</button>
        <button className="calendarNavTitle" onClick={goToday}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </button>
        <button className="calendarNavBtn" onClick={nextMonth} disabled={isCurrentMonth} aria-label="Next month">&rsaquo;</button>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────── */}
      <div className="calendarGrid">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="calendarDayHeader">{d}</div>
        ))}
        {weeks.flat().map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="calendarCell calendarCellEmpty" />;
          const key = toDateKey(viewYear, viewMonth, day);
          const entries = byDate[key] || [];
          const count = entries.length;
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const isFuture = key > todayKey;

          return (
            <button
              key={key}
              className={
                "calendarCell" +
                (isToday ? " calendarCellToday" : "") +
                (isSelected ? " calendarCellSelected" : "") +
                (count ? " calendarCellHasOutfit" : "") +
                (isFuture ? " calendarCellFuture" : "")
              }
              onClick={() => !isFuture && setSelectedDate(isSelected ? null : key)}
              disabled={isFuture}
            >
              <span className="calendarDayNum">{day}</span>
              {count > 0 && (
                <div className="calendarDots">
                  {Array.from({ length: Math.min(count, 3) }, (_, j) => (
                    <span key={j} className="calendarDot" />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Month activity summary ───────────────────────────────────── */}
      <div className="calendarMonthSummary">
        <span className="calendarMonthStat">{monthStats.count} outfit{monthStats.count !== 1 ? "s" : ""} logged</span>
        <span className="calendarMonthStatSep">/</span>
        <span className="calendarMonthStat">{monthStats.daysWithOutfits} day{monthStats.daysWithOutfits !== 1 ? "s" : ""} tracked</span>
      </div>

      {/* ── Selected day detail ──────────────────────────────────────── */}
      {selectedDate && (
        <section className="calendarDetailSection">
          <div className="calendarDetailTitle">{formatCardDate(selectedDate + "T12:00:00")}</div>
          {selectedEntries.length === 0 ? (
            <div className="calendarDetailEmpty">No outfits recorded this day.</div>
          ) : (
            <div className="calendarDetailList">
              {selectedEntries.map((entry, idx) => {
                const ids = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
                const items = ids.map((id) => wardrobeById.get(id?.toString?.())).filter(Boolean);
                const names = items.length ? items.map((it) => it.name || "Item").slice(0, 5) : ids.slice(0, 5).map((id) => `#${id}`);

                return (
                  <div key={entry?.history_id || idx} className="calendarOutfitCard">
                    <div className="calendarOutfitThumbs">
                      {ids.slice(0, 4).map((id) => {
                        const item = wardrobeById.get(id?.toString?.());
                        return item?.image_url ? (
                          <img key={id} className="calendarThumb" src={item.image_url} alt={item.name || ""} />
                        ) : (
                          <div key={id} className="calendarThumbPh" />
                        );
                      })}
                    </div>
                    <div className="calendarOutfitMeta">
                      <div className="calendarOutfitMetaTop">
                        {entry?.context?.occasion && (
                          <span className="calendarOccasion">{entry.context.occasion}</span>
                        )}
                        <span className={`historyBadge ${(labelFromSource(entry?.source) || "").toLowerCase()}`}>
                          {labelFromSource(entry?.source)}
                        </span>
                      </div>
                      <div className="calendarOutfitNames">{names.join("  /  ")}</div>
                      <button className="btn primary calendarWearAgain" onClick={() => handleWearAgain(entry)}>
                        Wear Again
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Pattern insights ─────────────────────────────────────────── */}
      <section className="card dashWide calendarInsightsCard">
        <div className="calendarInsightsTitle">Outfit Insights</div>

        {patterns.totalEntries === 0 ? (
          <div className="calendarInsightsEmpty">
            <div className="calendarInsightsEmptyIcon">📊</div>
            <div className="calendarInsightsEmptyText">Start tracking outfits to see patterns here.</div>
          </div>
        ) : (
          <>
            <div className="calendarInsightsGrid">
              <div className="calendarInsightTile">
                <div className="calendarInsightIcon">🔥</div>
                <div className="calendarInsightValue">{patterns.currentStreak}</div>
                <div className="calendarInsightLabel">Day Streak</div>
              </div>
              <div className="calendarInsightTile">
                <div className="calendarInsightIcon">🏆</div>
                <div className="calendarInsightValue">{patterns.longestStreak}</div>
                <div className="calendarInsightLabel">Best Streak</div>
              </div>
              <div className="calendarInsightTile">
                <div className="calendarInsightIcon">📅</div>
                <div className="calendarInsightValue">{patterns.trackedDays}</div>
                <div className="calendarInsightLabel">Days Tracked</div>
              </div>
              <div className="calendarInsightTile">
                <div className="calendarInsightIcon">🔁</div>
                <div className="calendarInsightValue">{patterns.repeatedOutfits.length}</div>
                <div className="calendarInsightLabel">Repeat Outfits</div>
              </div>
            </div>

            {patterns.mostActiveDay && (
              <div className="calendarInsightNote">
                Most active: <strong>{patterns.mostActiveDay.day}</strong> ({patterns.mostActiveDay.count} outfits)
                {patterns.leastActiveDay && patterns.leastActiveDay.count > 0 && (
                  <> / Quietest: <strong>{patterns.leastActiveDay.day}</strong> ({patterns.leastActiveDay.count})</>
                )}
              </div>
            )}

            {patterns.gaps.length > 0 && patterns.gaps[0].days >= 3 && (
              <div className="calendarInsightNote calendarInsightWarn">
                Longest gap: <strong>{patterns.gaps[0].days} days</strong> ({formatCardDate(patterns.gaps[0].from + "T12:00:00")} to {formatCardDate(patterns.gaps[0].to + "T12:00:00")})
              </div>
            )}

            {patterns.repeatedOutfits.length > 0 && (
              <div className="calendarRepeatSection">
                <div className="calendarRepeatTitle">Most Repeated</div>
                {patterns.repeatedOutfits.slice(0, 3).map((r) => {
                  const names = r.itemIds.map((id) => wardrobeById.get(id)?.name || `#${id}`).slice(0, 4);
                  return (
                    <div key={r.signature} className="calendarRepeatRow">
                      <span className="calendarRepeatCount">{r.count}x</span>
                      <span className="calendarRepeatNames">{names.join("  /  ")}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {patterns.orphanedItemCount > 0 && (
              <div className="calendarInsightNote calendarInsightWarn">
                {patterns.orphanedItemCount} item reference{patterns.orphanedItemCount !== 1 ? "s" : ""} in history no longer match your wardrobe.
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
