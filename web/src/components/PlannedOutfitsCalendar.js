import React, { useEffect, useMemo, useState } from "react";
import { formatPlanDate } from "../utils/helpers";

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
  const date = dateInput instanceof Date ? dateInput : new Date(`${dateInput}T12:00:00`);
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

function CalendarDayButton({ date, selected, outOfMonth, isToday, plans, onSelect }) {
  const planCount = plans.length;

  return (
    <button
      type="button"
      className={[
        "plannedCalendarDay",
        selected ? "selected" : "",
        outOfMonth ? "muted" : "",
        isToday ? "today" : "",
        planCount ? "filled" : "",
      ].filter(Boolean).join(" ")}
      onClick={() => onSelect(date)}
      aria-pressed={selected}
      aria-current={isToday ? "date" : undefined}
    >
      <span className="plannedCalendarDayNumber">{date.getDate()}</span>
      {planCount ? (
        <span className="plannedCalendarCount">
          {planCount === 1 ? "1 look" : `${planCount} looks`}
        </span>
      ) : (
        <span className="plannedCalendarDot" aria-hidden="true" />
      )}
    </button>
  );
}

export default function PlannedOutfitsCalendar({
  plans,
  wardrobeById,
  onWearThis = () => {},
  onRemove = () => {},
  onAddToGoogleCalendar = () => {},
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = toDateKey(today);

  const plansByDate = useMemo(() => {
    const grouped = new Map();
    const sorted = [...(Array.isArray(plans) ? plans : [])].sort((a, b) => (a?.planned_date || "").localeCompare(b?.planned_date || ""));

    for (const plan of sorted) {
      const dateKey = (plan?.planned_date || "").toString().trim();
      if (!dateKey) continue;
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey).push(buildPlanPreview(plan, wardrobeById));
    }

    return grouped;
  }, [plans, wardrobeById]);

  const allDateKeys = useMemo(() => [...plansByDate.keys()].sort((a, b) => a.localeCompare(b)), [plansByDate]);
  const [selectedDateKey, setSelectedDateKey] = useState(allDateKeys[0] || todayKey);
  const [displayDate, setDisplayDate] = useState(() => startOfMonth(parseDateKey(allDateKeys[0]) || today));

  useEffect(() => {
    const fallback = allDateKeys[0] || todayKey;
    setSelectedDateKey((current) => (current && plansByDate.has(current) ? current : fallback));
    setDisplayDate((current) => {
      if (current instanceof Date && !Number.isNaN(current.getTime())) return current;
      return startOfMonth(parseDateKey(fallback) || today);
    });
  }, [allDateKeys, plansByDate, today, todayKey]);

  const selectedDate = parseDateKey(selectedDateKey) || parseDateKey(allDateKeys[0]) || today;
  const selectedPlans = plansByDate.get(selectedDateKey) || [];

  const monthCells = useMemo(() => {
    const firstOfMonth = startOfMonth(displayDate);
    const gridStart = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [displayDate]);

  return (
    <section className="card dashWide plannedCalendarCard" aria-labelledby="planned-calendar-title">
      <div className="plannedCalendarHeader">
        <div>
          <div className="plannedCalendarEyebrow">Planning Calendar</div>
          <h2 id="planned-calendar-title" className="plannedCalendarTitle">Upcoming outfit plans</h2>
          <div className="plannedCalendarSub">
            Planned looks live here so you can see what is coming up at a glance.
          </div>
        </div>
      </div>

      <div className="plannedCalendarToolbar">
        <div className="plannedCalendarNav">
          <button type="button" className="btn" onClick={() => setDisplayDate((current) => addMonths(current, -1))}>
            Prev
          </button>
          <div className="plannedCalendarHeading">{formatMonthHeading(displayDate)}</div>
          <button type="button" className="btn" onClick={() => setDisplayDate((current) => addMonths(current, 1))}>
            Next
          </button>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => {
            const target = parseDateKey(allDateKeys[0]) || today;
            setSelectedDateKey(toDateKey(target));
            setDisplayDate(startOfMonth(target));
          }}
        >
          Next Planned
        </button>
      </div>

      <div className="plannedCalendarWeekdays" aria-hidden="true">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="plannedCalendarWeekday">{label}</div>
        ))}
      </div>

      <div className="plannedCalendarGrid">
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
              onSelect={(nextDate) => {
                setSelectedDateKey(toDateKey(nextDate));
                setDisplayDate(startOfMonth(nextDate));
              }}
            />
          );
        })}
      </div>

      <div className="plannedCalendarDetails">
        <div className="plannedCalendarDetailsHeader">
          <div>
            <div className="plannedCalendarDetailsEyebrow">Selected date</div>
            <div className="plannedCalendarDetailsTitle">{formatDetailHeading(selectedDate)}</div>
          </div>
          <div className="plannedCalendarDetailsCount">
            {selectedPlans.length ? `${selectedPlans.length} planned` : "Nothing planned"}
          </div>
        </div>

        {selectedPlans.length ? (
          <div className="plannedCalendarEntryList">
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
                  <button className="btn" type="button" onClick={() => onRemove(plan?.planned_id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="plannedCalendarEmpty">
            No upcoming outfit is planned for this day. Pick another date or save a new plan from weather or dashboard suggestions.
          </div>
        )}
      </div>
    </section>
  );
}
