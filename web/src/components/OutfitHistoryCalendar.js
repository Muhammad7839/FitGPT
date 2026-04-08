import React, { useEffect, useMemo, useState } from "react";
import { formatCardDate, labelFromSource } from "../utils/helpers";

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toDateKey(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  if (!dateKey) return null;
  const parsed = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMonthHeading(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatWeekHeading(startDate) {
  const endDate = addDays(startDate, 6);
  const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("en-US", sameMonth
    ? { day: "numeric", year: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" }).format(endDate);
  return `${startLabel} - ${endLabel}`;
}

function formatDetailHeading(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatWeekdayLabel(date, short = false) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: short ? "short" : "long",
  }).format(date);
}

function entryItems(entry, wardrobeById) {
  const ids = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
  return ids
    .map((rawId) => wardrobeById.get((rawId ?? "").toString().trim()))
    .filter(Boolean);
}

function buildEntryPreview(entry, wardrobeById) {
  const items = entryItems(entry, wardrobeById);
  return {
    ...entry,
    previewItems: items.slice(0, 4),
    itemNames: items.map((item) => item?.name || "Item"),
    itemCount: items.length,
  };
}

function CalendarDayButton({
  date,
  selected,
  isToday,
  outOfMonth,
  entries,
  onSelect,
}) {
  const entryCount = entries.length;
  const previewItems = entries.flatMap((entry) => entry.previewItems).slice(0, 2);

  return (
    <button
      type="button"
      className={[
        "historyCalendarDay",
        selected ? "selected" : "",
        isToday ? "today" : "",
        outOfMonth ? "muted" : "",
        entryCount > 0 ? "filled" : "",
      ].filter(Boolean).join(" ")}
      onClick={() => onSelect(date)}
      aria-pressed={selected}
      aria-current={isToday ? "date" : undefined}
    >
      <span className="historyCalendarDayNumber">{date.getDate()}</span>

      {entryCount > 0 ? (
        <span className="historyCalendarPreviewStrip" aria-hidden="true">
          {previewItems.map((item, index) => (
            item?.image_url ? (
              <img
                key={`${item.id || item.name}-${index}`}
                className="historyCalendarPreviewThumb"
                src={item.image_url}
                alt=""
              />
            ) : (
              <span key={`${item?.name || "item"}-${index}`} className="historyCalendarPreviewPh" />
            )
          ))}
          <span className="historyCalendarCount">
            {entryCount > 1 ? `${entryCount} looks` : "1 look"}
          </span>
        </span>
      ) : (
        <span className="historyCalendarEmptyMark" aria-hidden="true" />
      )}
    </button>
  );
}

export default function OutfitHistoryCalendar({
  history,
  wardrobeById,
  onWearAgain = () => {},
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = toDateKey(today);
  const [calendarView, setCalendarView] = useState("month");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [displayDate, setDisplayDate] = useState(() => startOfMonth(new Date()));
  const [openEntry, setOpenEntry] = useState(null);

  const historyByDate = useMemo(() => {
    const grouped = new Map();
    const sorted = [...(Array.isArray(history) ? history : [])].sort((a, b) => {
      const da = new Date(a?.worn_at || 0).getTime();
      const db = new Date(b?.worn_at || 0).getTime();
      return db - da;
    });

    for (const entry of sorted) {
      const dateKey = toDateKey(entry?.worn_at);
      if (!dateKey) continue;
      const preview = buildEntryPreview(entry, wardrobeById);
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey).push(preview);
    }

    return grouped;
  }, [history, wardrobeById]);

  const allDateKeys = useMemo(() => [...historyByDate.keys()].sort((a, b) => b.localeCompare(a)), [historyByDate]);

  useEffect(() => {
    const fallbackKey = historyByDate.has(todayKey) ? todayKey : (allDateKeys[0] || todayKey);
    setSelectedDateKey((current) => {
      if (current && (historyByDate.has(current) || current === todayKey)) return current;
      return fallbackKey;
    });
    setDisplayDate((current) => {
      if (current instanceof Date && !Number.isNaN(current.getTime())) return current;
      const fallbackDate = parseDateKey(fallbackKey) || today;
      return startOfMonth(fallbackDate);
    });
  }, [allDateKeys, historyByDate, today, todayKey]);

  const selectedDate = parseDateKey(selectedDateKey) || parseDateKey(allDateKeys[0]) || today;
  const selectedEntries = historyByDate.get(selectedDateKey) || [];

  const monthCells = useMemo(() => {
    const firstOfMonth = startOfMonth(displayDate);
    const gridStart = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [displayDate]);

  const weekCells = useMemo(() => {
    const anchor = calendarView === "week" ? startOfWeek(selectedDate) : startOfWeek(displayDate);
    return Array.from({ length: 7 }, (_, index) => addDays(anchor, index));
  }, [calendarView, displayDate, selectedDate]);

  const heading = calendarView === "month"
    ? formatMonthHeading(displayDate)
    : formatWeekHeading(startOfWeek(selectedDate));

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date("2026-04-05T12:00:00"));
    return Array.from({ length: 7 }, (_, index) => formatWeekdayLabel(addDays(start, index), true));
  }, []);

  const visibleDays = calendarView === "month" ? monthCells : weekCells;

  const handleNavigate = (direction) => {
    if (calendarView === "month") {
      setDisplayDate((current) => addMonths(current, direction));
      return;
    }

    const nextSelected = addDays(selectedDate, direction * 7);
    setSelectedDateKey(toDateKey(nextSelected));
    setDisplayDate(startOfMonth(nextSelected));
  };

  const handleSelectDate = (date) => {
    const key = toDateKey(date);
    setSelectedDateKey(key);
    setDisplayDate(startOfMonth(date));
  };

  return (
    <section className="card dashWide historyCalendarCard" aria-labelledby="history-calendar-title">
      <div className="historyCalendarHeader">
        <div>
          <div className="historyCalendarEyebrow">Outfit Calendar</div>
          <h2 id="history-calendar-title" className="historyCalendarTitle">What you wore</h2>
          <div className="historyCalendarSub">
            Scan past looks by month or week, then open a day to see the full outfit breakdown.
          </div>
        </div>

        <div className="historyCalendarHeaderActions">
          <div className="historyCalendarViewToggle" role="tablist" aria-label="Calendar view">
            <button
              type="button"
              role="tab"
              aria-selected={calendarView === "month"}
              className={calendarView === "month" ? "active" : ""}
              onClick={() => setCalendarView("month")}
            >
              Month
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={calendarView === "week"}
              className={calendarView === "week" ? "active" : ""}
              onClick={() => setCalendarView("week")}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {!allDateKeys.length ? (
        <div className="historyCalendarEmpty">
          <div className="historyStatsEmptyIcon">&#x1F4C5;</div>
          <div className="historyStatsEmptyTitle">No outfits logged yet</div>
          <div className="historyStatsEmptySub">
            Once you wear or reuse an outfit, it will appear here on the day it was tracked.
          </div>
        </div>
      ) : (
        <>
          <div className="historyCalendarToolbar">
            <div className="historyCalendarNav">
              <button type="button" className="btn" onClick={() => handleNavigate(-1)}>
                Prev
              </button>
              <div className="historyCalendarHeading">{heading}</div>
              <button type="button" className="btn" onClick={() => handleNavigate(1)}>
                Next
              </button>
            </div>

            <button
              type="button"
              className="btn"
              onClick={() => {
                setSelectedDateKey(todayKey);
                setDisplayDate(startOfMonth(today));
              }}
            >
              Today
            </button>
          </div>

          <div className={"historyCalendarGridWrap" + (calendarView === "week" ? " week" : "")}>
            <div className="historyCalendarWeekdays" aria-hidden="true">
              {weekdayLabels.map((label) => (
                <div key={label} className="historyCalendarWeekday">{label}</div>
              ))}
            </div>

            <div className={"historyCalendarGrid" + (calendarView === "week" ? " week" : "")}>
              {visibleDays.map((date) => {
                const dateKey = toDateKey(date);
                return (
                  <CalendarDayButton
                    key={`${calendarView}-${dateKey}`}
                    date={date}
                    selected={selectedDateKey === dateKey}
                    isToday={dateKey === todayKey}
                    outOfMonth={calendarView === "month" && date.getMonth() !== displayDate.getMonth()}
                    entries={historyByDate.get(dateKey) || []}
                    onSelect={handleSelectDate}
                  />
                );
              })}
            </div>
          </div>

          <div className="historyCalendarDetails">
            <div className="historyCalendarDetailsHeader">
              <div>
                <div className="historyCalendarDetailsEyebrow">Selected date</div>
                <div className="historyCalendarDetailsTitle">{formatDetailHeading(selectedDate)}</div>
              </div>
              <div className="historyCalendarDetailsCount">
                {selectedEntries.length ? `${selectedEntries.length} outfit${selectedEntries.length === 1 ? "" : "s"}` : "No outfit logged"}
              </div>
            </div>

            {selectedEntries.length ? (
              <div className="historyCalendarEntryList">
                {selectedEntries.map((entry) => (
                  <article key={entry.history_id || `${entry.worn_at}-${entry.itemNames.join("|")}`} className="historyCalendarEntryCard">
                    <div className="historyCalendarEntryTop">
                      <div>
                        <div className="historyCalendarEntryTime">{formatCardDate(entry.worn_at)}</div>
                        <div className="historyCalendarEntryNames">
                          {entry.itemNames.slice(0, 4).join(" | ")}
                        </div>
                      </div>
                      <span className={`historyBadge ${(labelFromSource(entry?.source) || "").toLowerCase()}`}>
                        {labelFromSource(entry?.source)}
                      </span>
                    </div>

                    <div className="historyCalendarEntryPreview">
                      {entry.previewItems.map((item, index) => (
                        <div key={`${entry.history_id || entry.worn_at}-${item?.id || index}`} className="historyCalendarEntryThumb">
                          {item?.image_url ? (
                            <img className="historyCalendarEntryThumbImg" src={item.image_url} alt={item?.name || "Wardrobe item"} />
                          ) : (
                            <div className="historyCalendarEntryThumbPh" />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="historyActions">
                      <button type="button" className="btn primary" onClick={() => setOpenEntry(entry)}>
                        View Outfit
                      </button>
                      <button type="button" className="btn" onClick={() => onWearAgain(entry)}>
                        Wear Again
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="historyCalendarNoLooks">
                No outfit was tracked for this day. Pick another date to review what you wore.
              </div>
            )}
          </div>
        </>
      )}

      {openEntry ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="history-calendar-modal-title">
          <div className="modalCard historyCalendarModal">
            <div className="historyCalendarModalTop">
              <div>
                <div className="historyCalendarDetailsEyebrow">View Outfit</div>
                <div id="history-calendar-modal-title" className="modalTitle">
                  {formatDetailHeading(parseDateKey(toDateKey(openEntry.worn_at)) || selectedDate)}
                </div>
                <div className="modalSub">
                  {labelFromSource(openEntry?.source)} look with {openEntry.itemCount || openEntry.itemNames.length || 0} item{(openEntry.itemCount || openEntry.itemNames.length || 0) === 1 ? "" : "s"}.
                </div>
              </div>

              <button type="button" className="btn" onClick={() => setOpenEntry(null)}>
                Close
              </button>
            </div>

            <div className="historyCalendarModalGrid">
              {entryItems(openEntry, wardrobeById).map((item, index) => (
                <div key={`${openEntry.history_id || openEntry.worn_at}-${item?.id || index}`} className="historyCalendarModalItem">
                  {item?.image_url ? (
                    <img className="historyCalendarModalImg" src={item.image_url} alt={item?.name || "Wardrobe item"} />
                  ) : (
                    <div className="historyCalendarModalImg historyCalendarModalImgPh" />
                  )}
                  <div className="historyCalendarModalName">{item?.name || "Wardrobe item"}</div>
                  <div className="historyCalendarModalMeta">
                    {[item?.category, item?.color].filter(Boolean).join(" | ") || "Item"}
                  </div>
                </div>
              ))}
            </div>

            <div className="modalActions">
              <button type="button" className="btn" onClick={() => setOpenEntry(null)}>
                Close
              </button>
              <button type="button" className="btn primary" onClick={() => onWearAgain(openEntry)}>
                Wear Again
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
