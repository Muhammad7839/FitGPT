import React, { useEffect, useMemo, useState } from "react";
import { formatCardDate, formatPlanDate, labelFromSource } from "../utils/helpers";

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

function formatDetailHeading(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function historyItems(entry, wardrobeById) {
  const ids = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
  return ids
    .map((rawId) => wardrobeById.get((rawId ?? "").toString().trim()))
    .filter(Boolean);
}

function buildHistoryPreview(entry, wardrobeById) {
  const items = historyItems(entry, wardrobeById);
  return {
    ...entry,
    previewItems: items.slice(0, 4),
    itemNames: items.map((item) => item?.name || "Item"),
    itemCount: items.length,
  };
}

function buildPlanPreview(plan, wardrobeById) {
  const details = Array.isArray(plan?.item_details) ? plan.item_details : [];
  const previewItems = details.length
    ? details
    : (Array.isArray(plan?.item_ids) ? plan.item_ids : [])
        .map((id) => wardrobeById.get((id ?? "").toString().trim()))
        .filter(Boolean);

  return {
    ...plan,
    previewItems: previewItems.slice(0, 4),
  };
}

function CalendarDayButton({
  date,
  selected,
  outOfMonth,
  isToday,
  plans,
  historyEntries,
  onSelect,
}) {
  const planCount = plans.length;
  const historyCount = historyEntries.length;
  const previewItems = [
    ...plans.flatMap((plan) => plan?.previewItems || []),
    ...historyEntries.flatMap((entry) => entry?.previewItems || []),
  ].filter(Boolean).slice(0, 2);

  return (
    <button
      type="button"
      className={[
        "planningCalendarDay",
        selected ? "selected" : "",
        outOfMonth ? "muted" : "",
        isToday ? "today" : "",
        planCount || historyCount ? "filled" : "",
      ].filter(Boolean).join(" ")}
      onClick={() => onSelect(date)}
      aria-pressed={selected}
      aria-current={isToday ? "date" : undefined}
    >
      <span className="planningCalendarDayNumber">{date.getDate()}</span>

      {(planCount || historyCount) ? (
        <>
          {previewItems.length ? (
            <span className="planningCalendarDayPreview" aria-hidden="true">
              {previewItems.map((item, index) => (
                item?.image_url ? (
                  <img
                    key={`${toDateKey(date)}-${item?.id || index}`}
                    className="planningCalendarDayThumb"
                    src={item.image_url}
                    alt=""
                  />
                ) : (
                  <span
                    key={`${toDateKey(date)}-${item?.id || index}`}
                    className="planningCalendarDayThumb planningCalendarDayThumbPh"
                  />
                )
              ))}
            </span>
          ) : null}

          <span className="planningCalendarDayCounts">
            {planCount ? <span className="planningCalendarChip planned">{planCount} planned</span> : null}
            {historyCount ? <span className="planningCalendarChip worn">{historyCount} worn</span> : null}
          </span>
        </>
      ) : (
        <span className="planningCalendarDot" aria-hidden="true" />
      )}
    </button>
  );
}

export default function PlanningCalendar({
  plans,
  history,
  wardrobe,
  wardrobeById,
  onCreatePlan = async () => ({ created: false, message: "Could not save this plan." }),
  onWearThis = () => {},
  onRemovePlan = () => {},
  onAddToGoogleCalendar = () => {},
  onWearAgain = () => {},
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = toDateKey(today);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [displayDate, setDisplayDate] = useState(() => startOfMonth(today));
  const [openHistoryEntry, setOpenHistoryEntry] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planOccasion, setPlanOccasion] = useState("");
  const [planSelection, setPlanSelection] = useState([]);
  const [planSaving, setPlanSaving] = useState(false);
  const [planMessage, setPlanMessage] = useState("");

  const plansByDate = useMemo(() => {
    const grouped = new Map();

    for (const plan of Array.isArray(plans) ? plans : []) {
      const dateKey = (plan?.planned_date || "").toString().trim();
      if (!dateKey) continue;
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey).push(buildPlanPreview(plan, wardrobeById));
    }

    return grouped;
  }, [plans, wardrobeById]);

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
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey).push(buildHistoryPreview(entry, wardrobeById));
    }

    return grouped;
  }, [history, wardrobeById]);

  useEffect(() => {
    if (selectedDateKey && parseDateKey(selectedDateKey)) return;
    setSelectedDateKey(todayKey);
    setDisplayDate(startOfMonth(today));
  }, [selectedDateKey, today, todayKey]);

  useEffect(() => {
    if (!planMessage) return undefined;
    const timeoutId = window.setTimeout(() => setPlanMessage(""), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [planMessage]);

  const selectedDate = parseDateKey(selectedDateKey) || today;
  const selectedPlans = plansByDate.get(selectedDateKey) || [];
  const selectedHistory = historyByDate.get(selectedDateKey) || [];
  const selectedDateIsUpcoming = selectedDateKey >= todayKey;
  const wardrobeItems = Array.isArray(wardrobe) ? wardrobe.filter((item) => item && item.is_active !== false) : [];

  const monthCells = useMemo(() => {
    const firstOfMonth = startOfMonth(displayDate);
    const gridStart = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [displayDate]);

  const selectedSummary = [
    selectedPlans.length ? `${selectedPlans.length} planned` : "",
    selectedHistory.length ? `${selectedHistory.length} worn` : "",
  ].filter(Boolean).join(" | ");

  const openPlanModal = (date) => {
    const nextKey = toDateKey(date);
    setSelectedDateKey(nextKey);
    setDisplayDate(startOfMonth(date));
    setPlanOccasion("");
    setPlanSelection([]);
    setPlanMessage("");
    setPlanModalOpen(true);
  };

  const togglePlanItem = (itemId) => {
    const normalizedId = (itemId ?? "").toString().trim();
    if (!normalizedId) return;
    setPlanSelection((current) =>
      current.includes(normalizedId)
        ? current.filter((entry) => entry !== normalizedId)
        : [...current, normalizedId]
    );
  };

  const handleSavePlan = async () => {
    if (!planSelection.length) {
      setPlanMessage("Pick at least one outfit item to plan this day.");
      return;
    }

    setPlanSaving(true);
    try {
      const itemDetails = planSelection
        .map((itemId) => wardrobeById.get(itemId))
        .filter(Boolean)
        .map((item) => ({
          id: (item?.id ?? "").toString(),
          name: item?.name || "",
          category: item?.category || "",
          color: item?.color || "",
          image_url: item?.image_url || "",
        }));

      const result = await onCreatePlan({
        plannedDate: selectedDateKey,
        itemIds: planSelection,
        occasion: planOccasion.trim(),
        itemDetails,
      });

      setPlanMessage((result?.message || "").toString().trim() || "Outfit planned!");
      setPlanModalOpen(false);
      setPlanOccasion("");
      setPlanSelection([]);
    } catch {
      setPlanMessage("Could not save a plan for that day.");
    } finally {
      setPlanSaving(false);
    }
  };

  return (
    <section className="card dashWide planningCalendarCard" aria-labelledby="planning-calendar-title">
      <div className="planningCalendarHeader">
        <div>
          <div className="planningCalendarEyebrow">Planning Calendar</div>
          <h2 id="planning-calendar-title" className="planningCalendarTitle">Upcoming outfits and outfit history</h2>
          <div className="planningCalendarSub">
            One calendar for what is coming up and what you already wore.
          </div>
        </div>
      </div>

      <div className="planningCalendarToolbar">
        <div className="planningCalendarNav">
          <button type="button" className="btn" onClick={() => setDisplayDate((current) => addMonths(current, -1))}>
            Prev
          </button>
          <div className="planningCalendarHeading">{formatMonthHeading(displayDate)}</div>
          <button type="button" className="btn" onClick={() => setDisplayDate((current) => addMonths(current, 1))}>
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

      <div className="planningCalendarWeekdays" aria-hidden="true">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="planningCalendarWeekday">{label}</div>
        ))}
      </div>

      <div className="planningCalendarGrid">
        {monthCells.map((date) => {
          const dateKey = toDateKey(date);
          return (
            <CalendarDayButton
              key={dateKey}
              date={date}
              selected={selectedDateKey === dateKey}
              outOfMonth={date.getMonth() !== displayDate.getMonth()}
              isToday={dateKey === todayKey}
              plans={plansByDate.get(dateKey) || []}
              historyEntries={historyByDate.get(dateKey) || []}
              onSelect={openPlanModal}
            />
          );
        })}
      </div>

      <div className="planningCalendarDetails">
        <div className="planningCalendarDetailsHeader">
          <div>
            <div className="planningCalendarDetailsEyebrow">Selected date</div>
            <div className="planningCalendarDetailsTitle">{formatDetailHeading(selectedDate)}</div>
          </div>
          <div className="planningCalendarDetailsHeaderActions">
            <div className="planningCalendarDetailsCount">
              {selectedSummary || "Nothing planned or worn"}
            </div>
            <button type="button" className="btn planningCalendarAddBtn" onClick={() => openPlanModal(selectedDate)}>
              Add outfit plan
            </button>
          </div>
        </div>

        {planMessage ? <div className="noteBox" style={{ marginTop: 12 }}>{planMessage}</div> : null}

        <div className="planningCalendarColumns">
          <div className="planningCalendarColumn">
            <div className="planningCalendarSectionTitle">
              {selectedDateIsUpcoming ? "Upcoming outfits" : "Planned outfits"}
            </div>

            {selectedPlans.length ? (
              <div className="planningCalendarEntryList">
                {selectedPlans.map((plan) => (
                  <article key={plan?.planned_id || `${plan?.planned_date}-${plan?.outfit_signature || ""}`} className="plannedCalendarEntryCard">
                    <div className="plannedCalendarEntryTop">
                      <div>
                        <div className="plannedCalendarEntryDate">{formatPlanDate(plan?.planned_date)}</div>
                        {plan?.occasion ? <div className="plannedCalendarEntryOccasion">{plan.occasion}</div> : null}
                      </div>
                      <span className="historyBadge planned">Planned</span>
                    </div>

                    <div className="savedOutfitItems" style={{ marginTop: 10 }}>
                      {plan.previewItems.map((item, index) => (
                        <div key={`${plan?.planned_id || plan?.planned_date}-${item?.id || index}`} className="savedOutfitItemChip">
                          {item?.image_url ? (
                            <img className="savedOutfitItemImg" src={item.image_url} alt={item?.name || "Item"} />
                          ) : (
                            <div className="savedOutfitItemPh" />
                          )}
                          <span className="savedOutfitItemName">{item?.name || "Item"}</span>
                        </div>
                      ))}
                    </div>

                    <div className="historyActions" style={{ marginTop: 10 }}>
                      <button className="btn primary" type="button" onClick={() => onWearThis(plan)}>
                        Wear This
                      </button>
                      <button className="btn" type="button" onClick={() => onAddToGoogleCalendar(plan)}>
                        Add to Google Calendar
                      </button>
                      <button className="btn" type="button" onClick={() => onRemovePlan(plan?.planned_id)}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="plannedCalendarEmpty">
                {selectedDateIsUpcoming
                  ? "No upcoming outfit is planned for this day yet."
                  : "No saved plan is attached to this date yet."}
              </div>
            )}
          </div>

          <div className="planningCalendarColumn">
            <div className="planningCalendarSectionTitle">What you wore already</div>

            {selectedHistory.length ? (
              <div className="planningCalendarEntryList">
                {selectedHistory.map((entry) => (
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
                      <button type="button" className="btn primary" onClick={() => setOpenHistoryEntry(entry)}>
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
              <div className="plannedCalendarEmpty">
                Nothing was tracked on this day yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {openHistoryEntry ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="planning-calendar-modal-title">
          <div className="modalCard historyCalendarModal">
            <div className="historyCalendarModalTop">
              <div>
                <div className="historyCalendarDetailsEyebrow">View Outfit</div>
                <div id="planning-calendar-modal-title" className="modalTitle">
                  {formatDetailHeading(parseDateKey(toDateKey(openHistoryEntry.worn_at)) || selectedDate)}
                </div>
                <div className="modalSub">
                  {labelFromSource(openHistoryEntry?.source)} look with {openHistoryEntry.itemCount || openHistoryEntry.itemNames.length || 0} item{(openHistoryEntry.itemCount || openHistoryEntry.itemNames.length || 0) === 1 ? "" : "s"}.
                </div>
              </div>

              <button type="button" className="btn" onClick={() => setOpenHistoryEntry(null)}>
                Close
              </button>
            </div>

            <div className="historyCalendarModalGrid">
              {historyItems(openHistoryEntry, wardrobeById).map((item, index) => (
                <div key={`${openHistoryEntry.history_id || openHistoryEntry.worn_at}-${item?.id || index}`} className="historyCalendarModalItem">
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
              <button type="button" className="btn" onClick={() => setOpenHistoryEntry(null)}>
                Close
              </button>
              <button type="button" className="btn primary" onClick={() => onWearAgain(openHistoryEntry)}>
                Wear Again
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {planModalOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="planning-calendar-add-title">
          <div className="modalCard planningCalendarModal">
            <div className="historyCalendarModalTop">
              <div>
                <div className="historyCalendarDetailsEyebrow">Add outfit plan</div>
                <div id="planning-calendar-add-title" className="modalTitle">
                  {formatDetailHeading(selectedDate)}
                </div>
                <div className="modalSub">
                  Pick the wardrobe pieces you want to save for this day.
                </div>
              </div>

              <button type="button" className="btn" onClick={() => setPlanModalOpen(false)}>
                Close
              </button>
            </div>

            <label className="wardrobeLabel">
              Occasion
              <input
                className="wardrobeInput"
                type="text"
                value={planOccasion}
                onChange={(event) => setPlanOccasion(event.target.value)}
                placeholder="Class, work, dinner, travel..."
              />
            </label>

            <div className="planningCalendarModalLabel">Choose outfit items</div>
            <div className="planningCalendarItemGrid">
              {wardrobeItems.map((item) => {
                const itemId = (item?.id ?? "").toString().trim();
                const selected = planSelection.includes(itemId);
                return (
                  <button
                    key={itemId}
                    type="button"
                    className={`planningCalendarItemCard${selected ? " selected" : ""}`}
                    onClick={() => togglePlanItem(itemId)}
                    aria-pressed={selected}
                  >
                    {item?.image_url ? (
                      <img className="planningCalendarItemImg" src={item.image_url} alt={item?.name || "Wardrobe item"} />
                    ) : (
                      <div className="planningCalendarItemImg planningCalendarItemImgPh" />
                    )}
                    <div className="planningCalendarItemName">{item?.name || "Wardrobe item"}</div>
                    <div className="planningCalendarItemMeta">
                      {[item?.category, item?.color].filter(Boolean).join(" | ") || "Item"}
                    </div>
                  </button>
                );
              })}
            </div>

            {!wardrobeItems.length ? (
              <div className="plannedCalendarEmpty" style={{ marginTop: 12 }}>
                Add wardrobe items first so you can plan an outfit from the calendar.
              </div>
            ) : null}

            <div className="modalActions">
              <button type="button" className="btn" onClick={() => setPlanModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={handleSavePlan} disabled={planSaving || !wardrobeItems.length}>
                {planSaving ? "Saving..." : "Save plan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
