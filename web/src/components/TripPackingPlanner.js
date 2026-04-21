import React, { useEffect, useMemo, useRef, useState } from "react";
import { getDestinationWeatherForecast } from "../api/weatherApi";
import { tripPackingApi } from "../api/tripPackingApi";
import {
  TRIP_ACTIVITY_SUGGESTIONS,
  TRIP_LUGGAGE_OPTIONS,
  buildTripDateRange,
  createCustomPackingItem,
  generateTripPackingPlan,
  tripDurationDays,
} from "../utils/tripPacking";
import { EVT_TRIP_PACKING_CHANGED } from "../utils/constants";

const TRIP_CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function parseDateKey(dateKey) {
  if (!dateKey) return null;
  const parsed = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthHeading(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateButtonLabel(dateKey) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return "Pick a date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatDateMeta(dateKey) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return "Open calendar";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(parsed);
}

function formatCalendarAriaLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTripDates(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Dates pending";

  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const endFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${format.format(start)} - ${endFormat.format(end)}`;
}

function formatTripDay(date) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return { label: "Day", sublabel: date || "" };
  return {
    label: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsed),
    sublabel: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed),
  };
}

function normalizeTripActivityLabel(value) {
  return (value || "")
    .toString()
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      return (code >= 0 && code <= 31) || code === 127 ? " " : char;
    })
    .join("")
    .replace(/\b(?=[A-Z0-9]{4,}\b)(?=.*\d)[A-Z0-9]+\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatCalendarTile(date) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { month: "--", day: "--", weekday: "Select" };
  }

  return {
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(parsed),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(parsed),
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsed),
  };
}

function tempRangeLabel(summary) {
  const high = Number(summary?.highestTempF);
  const low = Number(summary?.lowestTempF);
  if (Number.isFinite(high) && Number.isFinite(low)) return `${Math.round(high)}\u00B0 / ${Math.round(low)}\u00B0`;
  return "General packing";
}

function tripPurposeLabel(tripPurpose) {
  const value = (tripPurpose || "").toString().trim();
  return value || "Flexible travel";
}

function BagIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="tripBagFill" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#f5c18d" />
          <stop offset="100%" stopColor="#c34f42" />
        </linearGradient>
      </defs>
      <path d="M19 22h26c6.6 0 12 5.4 12 12v11c0 5-4 9-9 9H16c-5 0-9-4-9-9V34c0-6.6 5.4-12 12-12Z" fill="url(#tripBagFill)" opacity="0.92" />
      <path d="M22 24c0-6.1 4.9-11 11-11h-2c6.1 0 11 4.9 11 11" fill="none" stroke="rgba(39,20,20,0.75)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M16 31h32" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="22" cy="42" r="2.2" fill="rgba(39,20,20,0.45)" />
      <circle cx="42" cy="42" r="2.2" fill="rgba(39,20,20,0.45)" />
    </svg>
  );
}

function SuitcaseIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="tripSuitcaseFill" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#8dbcf8" />
          <stop offset="100%" stopColor="#3f68d1" />
        </linearGradient>
      </defs>
      <rect x="17" y="16" width="30" height="39" rx="8" fill="url(#tripSuitcaseFill)" opacity="0.95" />
      <path d="M26 17v-4.5c0-2.5 2-4.5 4.5-4.5h3c2.5 0 4.5 2 4.5 4.5V17" fill="none" stroke="rgba(27,35,65,0.76)" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 22v26" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23 25h18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="25" cy="56" r="2.2" fill="rgba(27,35,65,0.58)" />
      <circle cx="39" cy="56" r="2.2" fill="rgba(27,35,65,0.58)" />
    </svg>
  );
}

function PlaneIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 36.5 54 31l-8.2 8.2 2.6 8.8-6.8-4.7-8.8 9.1-1.8-10.5-11.7-5.4 12.9-1.8 6-15.4 4.7 12.2Z" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="12" y="16" width="40" height="36" rx="10" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <path d="M20 10v12M44 10v12M12 26h40" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="24" cy="34" r="2.6" fill="currentColor" />
      <circle cx="32" cy="34" r="2.6" fill="currentColor" />
      <circle cx="40" cy="34" r="2.6" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon({ className = "", direction = "left" }) {
  const rotation = direction === "right" ? "rotate(180 32 32)" : "";
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <g transform={rotation}>
        <path d="M38 16 22 32l16 16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function LuggageVisual({ mode, className = "", accent = "dark" }) {
  return (
    <div className={`tripLuggageVisual ${className} ${accent === "light" ? "light" : ""}`} aria-hidden="true">
      {(mode === "carry-on" || mode === "combo") ? <BagIcon className="tripLuggageSvg bag" /> : null}
      {(mode === "checked" || mode === "combo") ? <SuitcaseIcon className="tripLuggageSvg suitcase" /> : null}
      {mode === "combo" ? <PlaneIcon className="tripLuggageSvg plane" /> : null}
    </div>
  );
}

function CalendarScene({ kind, active }) {
  return (
    <div className={`tripBuilderCalendarScene ${kind} ${active ? "active" : "idle"}`} aria-hidden="true">
      <PlaneIcon className="tripBuilderCalendarPlane" />
      <div className="tripBuilderCalendarSceneLine" />
      <div className="tripBuilderCalendarSceneDot start" />
      <div className="tripBuilderCalendarSceneDot end" />
      <div className="tripBuilderCalendarSceneLuggage">
        {kind === "depart" ? <BagIcon className="tripBuilderCalendarBag" /> : <SuitcaseIcon className="tripBuilderCalendarSuitcase" />}
      </div>
    </div>
  );
}

function TripDatePickerField({
  label,
  value,
  onChange,
  placeholder = "Pick a date",
  minDate = "",
  isOpen = false,
  onToggle = () => {},
  onClose = () => {},
}) {
  const fieldRef = useRef(null);
  const selectedDate = useMemo(() => parseDateKey(value), [value]);
  const minDateValue = useMemo(() => parseDateKey(minDate), [minDate]);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [displayDate, setDisplayDate] = useState(() =>
    startOfMonth(selectedDate || minDateValue || today)
  );

  useEffect(() => {
    if (!isOpen) return;
    setDisplayDate(startOfMonth(selectedDate || minDateValue || today));
  }, [isOpen, minDateValue, selectedDate, today]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (fieldRef.current && !fieldRef.current.contains(event.target)) onClose();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const monthCells = useMemo(() => {
    const firstOfMonth = startOfMonth(displayDate);
    const gridStart = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [displayDate]);

  return (
    <div className="tripField tripDateField" ref={fieldRef}>
      <span className="tripFieldLabel">{label}</span>
      <button
        type="button"
        className={"tripDateTrigger" + (value ? " filled" : "") + (isOpen ? " active" : "")}
        onClick={() => onToggle()}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`${label}: ${value ? formatDateButtonLabel(value) : placeholder}`}
      >
        <span className="tripDateTriggerCopy">
          <span className="tripDateTriggerValue">{value ? formatDateButtonLabel(value) : placeholder}</span>
          <span className="tripDateTriggerMeta">{formatDateMeta(value)}</span>
        </span>
        <span className="tripDateTriggerIconWrap" aria-hidden="true">
          <CalendarIcon className="tripDateTriggerIcon" />
        </span>
      </button>

      {isOpen ? (
        <div className="tripDatePopover" role="dialog" aria-label={`${label} calendar`}>
          <div className="tripDatePopoverGlow tripDatePopoverGlowOne" aria-hidden="true" />
          <div className="tripDatePopoverGlow tripDatePopoverGlowTwo" aria-hidden="true" />

          <div className="tripDatePopoverHeader">
            <div>
              <div className="tripDatePopoverEyebrow">{label}</div>
              <div className="tripDatePopoverTitle">{formatMonthHeading(displayDate)}</div>
            </div>

            <div className="tripDatePopoverNav">
              <button
                type="button"
                className="tripDateNavBtn"
                onClick={() => setDisplayDate((current) => addMonths(current, -1))}
                aria-label={`Show previous month for ${label.toLowerCase()}`}
              >
                <ChevronIcon className="tripDateNavIcon" direction="left" />
              </button>
              <button
                type="button"
                className="tripDateNavBtn"
                onClick={() => setDisplayDate((current) => addMonths(current, 1))}
                aria-label={`Show next month for ${label.toLowerCase()}`}
              >
                <ChevronIcon className="tripDateNavIcon" direction="right" />
              </button>
            </div>
          </div>

          <div className="tripDateWeekdays" aria-hidden="true">
            {TRIP_CALENDAR_WEEKDAYS.map((weekday) => (
              <span key={weekday} className="tripDateWeekday">{weekday}</span>
            ))}
          </div>

          <div className="tripDateGrid">
            {monthCells.map((day) => {
              const dayKey = toDateKey(day);
              const sameMonth = day.getMonth() === displayDate.getMonth();
              const isSelected = !!value && dayKey === value;
              const isToday = dayKey === todayKey;
              const isDisabled = !!minDateValue && startOfDay(day) < startOfDay(minDateValue);

              return (
                <button
                  key={`${label}-${dayKey}`}
                  type="button"
                  className={[
                    "tripDateDay",
                    sameMonth ? "" : "muted",
                    isSelected ? "selected" : "",
                    isToday ? "today" : "",
                    isDisabled ? "disabled" : "",
                  ].filter(Boolean).join(" ")}
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(dayKey);
                    onClose();
                  }}
                  aria-label={formatCalendarAriaLabel(day)}
                  aria-pressed={isSelected}
                >
                  <span className="tripDateDayNumber">{day.getDate()}</span>
                </button>
              );
            })}
          </div>

          <div className="tripDatePopoverFooter">
            <button type="button" className="tripDateFooterBtn subtle" onClick={() => onChange("")}>
              Clear
            </button>
            <button
              type="button"
              className="tripDateFooterBtn"
              onClick={() => {
                if (minDateValue && today < startOfDay(minDateValue)) {
                  onChange(toDateKey(minDateValue));
                } else {
                  onChange(todayKey);
                }
                onClose();
              }}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function groupIcon(groupKey) {
  if (groupKey === "tops") return "\u25A1";
  if (groupKey === "bottoms") return "\u25A4";
  if (groupKey === "outerwear") return "\u25A7";
  if (groupKey === "shoes") return "\u25E7";
  if (groupKey === "accessories") return "\u25C7";
  if (groupKey === "essentials") return "\u25CE";
  return "\u2736";
}

function weatherHeadline(trip) {
  if (trip?.forecast?.status === "ok") return trip?.summary?.weatherLabel || "Weather-aware packing";
  return "Weather fallback active";
}

function sumItemQuantities(items, predicate = () => true) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => {
    if (!predicate(item)) return sum;
    return sum + (Number(item?.quantity) || 0);
  }, 0);
}

function TripDayStrip({ trip }) {
  const forecastDays = Array.isArray(trip?.forecast?.days) ? trip.forecast.days : [];
  const dateRange = Array.isArray(trip?.summary?.tripDates)
    ? trip.summary.tripDates
    : buildTripDateRange(trip?.start_date, trip?.end_date);
  const fallbackDays = dateRange.map((date) => ({ date, icon: "\u2022", condition: "General" }));
  const days = forecastDays.length ? forecastDays : fallbackDays;

  return (
    <div className="tripPlannerDays" aria-label="Trip days">
      {days.map((day, index) => {
        const labels = formatTripDay(day.date);
        return (
          <div key={`${trip?.trip_id || trip?.destination}-${day.date}-${index}`} className="tripPlannerDayCard">
            <div className="tripPlannerDayTop">
              <span className="tripPlannerDayLabel">{labels.label}</span>
              <span className="tripPlannerDayIcon" aria-hidden="true">{day?.icon || "\u2022"}</span>
            </div>
            <div className="tripPlannerDayDate">{labels.sublabel}</div>
            <div className="tripPlannerDayMeta">
              {Number.isFinite(Number(day?.tempHighF))
                ? `${Math.round(Number(day.tempHighF))}\u00B0`
                : day?.condition || "General"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TripOutfitPlan({ trip }) {
  const outfitPlan = Array.isArray(trip?.outfit_plan) ? trip.outfit_plan : [];

  if (!outfitPlan.length) {
    return (
      <div className="tripPlannerFallbackNote">
        Outfit ideas are not ready yet for this trip. Refresh the packing list to regenerate weather-aware looks.
      </div>
    );
  }

  return (
    <section className="tripOutfitPlanSection" aria-labelledby="trip-outfit-plan-title">
      <div className="tripOutfitPlanHeader">
        <div>
          <div className="tripPlannerEyebrow">Travel outfit plan</div>
          <div id="trip-outfit-plan-title" className="tripOutfitPlanTitle">Daily outfit ideas</div>
          <div className="tripOutfitPlanSub">
            These looks use the destination forecast first, then match it to what you already own.
          </div>
        </div>
      </div>

      <div className="tripOutfitPlanGrid">
        {outfitPlan.map((entry, index) => {
          const labels = formatTripDay(entry?.date);
          const outfit = Array.isArray(entry?.outfit) ? entry.outfit : [];

          return (
            <article key={`${trip?.trip_id || trip?.destination}-${entry?.date || index}`} className="tripOutfitCard">
              <div className="tripOutfitCardTop">
                <div>
                  <div className="tripOutfitCardDay">{labels.label}</div>
                  <div className="tripOutfitCardDate">{labels.sublabel}</div>
                </div>
                <div className="tripOutfitCardMeta">
                  <span>{entry?.title || "Travel outfit"}</span>
                </div>
              </div>

              <div className="tripOutfitCardSummary">{entry?.summary || "Built around your trip."}</div>

              {outfit.length ? (
                <div className="tripOutfitItems">
                  {outfit.map((item) => (
                    <div key={`${entry?.date}-${item?.id || item?.name}`} className="tripOutfitItemChip">
                      {item?.image_url ? (
                        <img className="tripOutfitItemImg" src={item.image_url} alt={item?.name || "Trip outfit item"} />
                      ) : (
                        <div className="tripOutfitItemPh" aria-hidden="true" />
                      )}
                      <div className="tripOutfitItemCopy">
                        <div className="tripOutfitItemName">{item?.name || "Item"}</div>
                        <div className="tripOutfitItemMeta">{item?.category || "Wardrobe item"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tripPlannerFallbackNote" style={{ marginTop: 10 }}>
                  Add more wardrobe items to generate a fuller travel outfit for this day.
                </div>
              )}

              <div className="tripOutfitCardNote">{entry?.note || "A balanced option for the day."}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TripBuilderPreview({ destination, startDate, endDate, tripPurpose, luggageMode }) {
  const duration = tripDurationDays(startDate, endDate);
  const start = formatCalendarTile(startDate);
  const end = formatCalendarTile(endDate);
  const hasStart = !!startDate;
  const hasEnd = !!endDate;

  return (
    <div className="tripBuilderPreview" aria-live="polite">
      <div className="tripBuilderPreviewTop">
        <div>
          <div className="tripBuilderPreviewEyebrow">Trip snapshot</div>
          <div className="tripBuilderPreviewDestination">{destination.trim() || "Your destination"}</div>
          <div className="tripBuilderPreviewSub">
            {duration ? `${duration} day${duration === 1 ? "" : "s"} planned` : "Pick your travel dates"}
          </div>
        </div>

        <div className="tripBuilderPreviewBadge">
          <LuggageVisual mode={luggageMode} className="tripBuilderBadgeVisual" accent="light" />
          <span>{TRIP_LUGGAGE_OPTIONS.find((option) => option.key === luggageMode)?.label || "Carry on"}</span>
        </div>
      </div>

      <div className="tripBuilderCalendarRow">
        <div className="tripBuilderCalendarCard">
          <CalendarScene kind="depart" active={hasStart} />
          <div className="tripBuilderCalendarMonth">{start.month}</div>
          <div className="tripBuilderCalendarDay">{start.day}</div>
          <div className="tripBuilderCalendarWeekday">{start.weekday}</div>
          <div className="tripBuilderCalendarLabel">Depart</div>
        </div>

        <div className="tripBuilderCalendarConnector" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="tripBuilderCalendarCard">
          <CalendarScene kind="return" active={hasEnd} />
          <div className="tripBuilderCalendarMonth">{end.month}</div>
          <div className="tripBuilderCalendarDay">{end.day}</div>
          <div className="tripBuilderCalendarWeekday">{end.weekday}</div>
          <div className="tripBuilderCalendarLabel">Return</div>
        </div>
      </div>

      <div className="tripBuilderPreviewFooter">
        <span className="tripBuilderPreviewPill">Destination + dates are required</span>
        <span className="tripBuilderPreviewPill">{tripPurposeLabel(tripPurpose)}</span>
      </div>
    </div>
  );
}

function TripGenerationState({ destination, startDate, endDate }) {
  return (
    <div className="tripPlannerGenerating" role="status" aria-live="polite">
      <div className="tripPlannerGeneratingFlight" aria-hidden="true">
        <span className="tripPlannerGeneratingPlane">\u2708</span>
      </div>
      <div className="tripPlannerGeneratingTitle">Building your packing list</div>
      <div className="tripPlannerGeneratingSub">
        {destination
          ? `Checking ${destination} from ${formatTripDates(startDate, endDate)} and matching it to your wardrobe.`
          : "Checking the forecast and matching it to your wardrobe."}
      </div>
      <div className="tripPlannerGeneratingBar" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

function ConfirmActionModal({ title, message, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="trip-confirm-title">
      <div className="modalCard tripConfirmModal">
        <div className="modalTitle" id="trip-confirm-title">{title}</div>
        <div className="modalSub">{message}</div>
        <div className="modalActions">
          <button type="button" className="btn" onClick={onCancel}>
            No
          </button>
          <button type="button" className="btn primary" onClick={onConfirm}>
            {confirmLabel || "Yes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TripPackingPlanner({ wardrobe, user, answers }) {
  const [trips, setTrips] = useState([]);
  const [archivedTrips, setArchivedTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderStep, setBuilderStep] = useState(1);
  const [showTripHistory, setShowTripHistory] = useState(false);
  const [editingTripId, setEditingTripId] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tripPurpose, setTripPurpose] = useState("");
  const [luggageMode, setLuggageMode] = useState("carry-on");
  const [activities, setActivities] = useState([]);
  const [activityDraft, setActivityDraft] = useState("");
  const [openDateField, setOpenDateField] = useState("");
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tripMsg, setTripMsg] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [activeAddGroup, setActiveAddGroup] = useState("");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemQty, setCustomItemQty] = useState("1");

  const refreshTrips = async () => {
    setLoadingTrips(true);
    try {
      const result = await tripPackingApi.listTrips(user);
      const list = Array.isArray(result?.trips) ? result.trips : [];
      const archived = Array.isArray(result?.archivedTrips) ? result.archivedTrips : [];
      setTrips(list);
      setArchivedTrips(archived);
      setSelectedTripId((current) => {
        if (current && list.some((trip) => trip.trip_id === current)) return current;
        return "";
      });
    } catch {
      setTrips([]);
      setArchivedTrips([]);
      setSelectedTripId("");
    } finally {
      setLoadingTrips(false);
    }
  };

  useEffect(() => {
    refreshTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const onChanged = () => refreshTrips();
    window.addEventListener(EVT_TRIP_PACKING_CHANGED, onChanged);
    return () => window.removeEventListener(EVT_TRIP_PACKING_CHANGED, onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!tripMsg) return undefined;
    const timerId = window.setTimeout(() => setTripMsg(""), 2800);
    return () => window.clearTimeout(timerId);
  }, [tripMsg]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.trip_id === selectedTripId) || null,
    [selectedTripId, trips]
  );

  const hasRequiredTripInputs = !!destination.trim() && !!startDate && !!endDate;

  const totalPackedCount = useMemo(() => {
    const groups = Array.isArray(selectedTrip?.packing_groups) ? selectedTrip.packing_groups : [];
    return groups.reduce(
      (sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + (item?.packed ? Number(item.quantity) || 0 : 0), 0),
      0
    );
  }, [selectedTrip]);

  const selectedTripStats = useMemo(() => {
    const groups = Array.isArray(selectedTrip?.packing_groups) ? selectedTrip.packing_groups : [];
    const totalItems = groups.reduce((sum, group) => sum + sumItemQuantities(group.items), 0);
    const packedItems = groups.reduce((sum, group) => sum + sumItemQuantities(group.items, (item) => item?.packed), 0);
    const ownedItems = groups.reduce((sum, group) => sum + sumItemQuantities(group.items, (item) => item?.owned), 0);
    const suggestedItems = Math.max(0, totalItems - ownedItems);
    const packedPercent = totalItems ? Math.min(100, Math.round((packedItems / totalItems) * 100)) : 0;

    return {
      totalItems,
      packedItems,
      ownedItems,
      suggestedItems,
      packedPercent,
      groupCount: groups.length,
    };
  }, [selectedTrip]);

  const draftDuration = useMemo(() => tripDurationDays(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (tripDurationDays(startDate, endDate)) return;
    setEndDate(startDate);
  }, [endDate, startDate]);

  const openCreate = () => {
    setEditingTripId("");
    setDestination("");
    setStartDate("");
    setEndDate("");
    setTripPurpose("");
    setLuggageMode("carry-on");
    setActivities([]);
    setActivityDraft("");
    setOpenDateField("");
    setBuilderStep(1);
    setShowBuilder(true);
  };

  const toggleTripDetails = (tripId) => {
    setSelectedTripId((current) => (current === tripId ? "" : tripId));
  };

  const openEdit = (trip) => {
    if (!trip) return;
    setEditingTripId(trip.trip_id || "");
    setDestination(trip.destination || "");
    setStartDate(trip.start_date || "");
    setEndDate(trip.end_date || "");
    setTripPurpose(trip.trip_purpose || "");
    setLuggageMode(trip.luggage_mode || "carry-on");
    setActivities(Array.isArray(trip.activities) ? trip.activities : []);
    setActivityDraft("");
    setOpenDateField("");
    setBuilderStep(2);
    setShowBuilder(true);
  };

  const closeBuilder = () => {
    setShowBuilder(false);
    setOpenDateField("");
    setBuilderStep(1);
  };

  const saveTripLocally = async (tripId, patch) => {
    if (!tripId) return;
    await tripPackingApi.updateTrip(tripId, patch, user);
    await refreshTrips();
  };

  const addActivity = (value) => {
    const next = normalizeTripActivityLabel(value);
    if (!next) return;
    setActivities((current) => (current.includes(next) ? current : [...current, next]));
    setActivityDraft("");
  };

  const removeActivity = (value) => {
    setActivities((current) => current.filter((entry) => entry !== value));
  };

  const handleGenerateTrip = async (overrideValues = null) => {
    const values = overrideValues || {
      destination,
      startDate,
      endDate,
      tripPurpose,
      luggageMode,
      activities,
      editingTripId,
    };

    if (!values.destination.trim() || !values.startDate || !values.endDate) {
      setTripMsg("Add a destination and trip dates first.");
      return;
    }

    const duration = tripDurationDays(values.startDate, values.endDate);
    if (!duration) {
      setTripMsg("Choose a valid start and end date.");
      return;
    }

    setGenerating(true);
    setTripMsg("");

    try {
      const forecast = await getDestinationWeatherForecast({
        destination: values.destination,
        startDate: values.startDate,
        endDate: values.endDate,
      });

      const plan = generateTripPackingPlan({
        wardrobe,
        destination: values.destination,
        destinationLabel: forecast?.location?.label || values.destination,
        startDate: values.startDate,
        endDate: values.endDate,
        luggageMode: values.luggageMode,
        tripPurpose: values.tripPurpose,
        activities: values.activities,
        forecast,
        answers,
      });

      const payload = {
        destination: values.destination,
        destination_label: forecast?.location?.label || values.destination,
        start_date: values.startDate,
        end_date: values.endDate,
        trip_purpose: values.tripPurpose,
        luggage_mode: values.luggageMode,
        activities: values.activities,
        packing_groups: plan.packing_groups,
        outfit_plan: plan.outfit_plan,
        forecast,
        summary: plan.summary,
      };

      if (values.editingTripId) {
        await tripPackingApi.updateTrip(values.editingTripId, payload, user);
        setTripMsg("Trip updated.");
        setSelectedTripId(values.editingTripId);
      } else {
        const result = await tripPackingApi.createTrip(payload, user);
        setSelectedTripId(result?.trip?.trip_id || "");
        setTripMsg("Your packing list is ready.");
      }

      closeBuilder();
      setEditingTripId("");
      await refreshTrips();
    } catch {
      setTripMsg("Could not generate the trip right now.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveTrip = async (tripId) => {
    await tripPackingApi.removeTrip(tripId, user);
    setSelectedTripId((current) => (current === tripId ? "" : current));
    setTripMsg("Trip moved to trip history.");
    await refreshTrips();
  };

  const updateTripGroups = async (groupKey, updater) => {
    if (!selectedTrip) return;
    const groups = (Array.isArray(selectedTrip.packing_groups) ? selectedTrip.packing_groups : []).map((group) => {
      if (group.key !== groupKey) return group;
      const nextItems = updater(Array.isArray(group.items) ? group.items : []);
      const totalQuantity = nextItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return {
        ...group,
        items: nextItems,
        totalQuantity,
      };
    });

    await saveTripLocally(selectedTrip.trip_id, { packing_groups: groups });
  };

  const handleQuantityChange = async (groupKey, itemId, delta) => {
    await updateTripGroups(groupKey, (items) =>
      items.map((item) =>
        item.item_id !== itemId
          ? item
          : { ...item, quantity: Math.max(1, (Number(item.quantity) || 1) + delta) }
      )
    );
  };

  const handleTogglePacked = async (groupKey, itemId) => {
    await updateTripGroups(groupKey, (items) =>
      items.map((item) =>
        item.item_id !== itemId
          ? item
          : { ...item, packed: !item.packed }
      )
    );
  };

  const handleRemoveItem = async (groupKey, itemId) => {
    await updateTripGroups(groupKey, (items) => items.filter((item) => item.item_id !== itemId));
  };

  const requestConfirm = (next) => setConfirmState(next);

  const handleConfirmAction = async () => {
    if (!confirmState) return;

    if (confirmState.type === "trip") {
      await handleRemoveTrip(confirmState.tripId);
    }

    if (confirmState.type === "activity") {
      removeActivity(confirmState.activity);
    }

    if (confirmState.type === "item") {
      await handleRemoveItem(confirmState.groupKey, confirmState.itemId);
    }

    setConfirmState(null);
  };

  const handleRestoreTrip = async (tripId) => {
    await tripPackingApi.restoreTrip(tripId, user);
    setSelectedTripId(tripId);
    setTripMsg("Trip restored to your active plans.");
    await refreshTrips();
  };

  const handleAddCustomItem = async (groupKey, groupLabel) => {
    const name = customItemName.trim();
    if (!selectedTrip || !name) return;

    const customItem = createCustomPackingItem({
      name,
      category: groupLabel,
      quantity: Number(customItemQty) || 1,
    });

    await updateTripGroups(groupKey, (items) => [...items, customItem]);
    setCustomItemName("");
    setCustomItemQty("1");
    setActiveAddGroup("");
  };

  return (
    <section className="tripPlannerSection">
      <div className={"tripPlannerHero card dashWide" + (!showBuilder && !selectedTrip ? " tripPlannerHeroExpanded" : "")}>
        <div className="tripPlannerHeroShell">
          <div className="tripPlannerHeroCopy">
            <div className="tripPlannerEyebrow">Trip Packing</div>
            <h2 className="tripPlannerTitle">Pack for the trip you are excited to take</h2>
            <div className="tripPlannerSub">
              Create a destination-based packing list that feels clear, weather-aware, and fun to plan around your real wardrobe.
            </div>

            <div className="tripPlannerHeroMeta">
              <span className="tripPlannerHeroPill">Weather-led suggestions</span>
              <span className="tripPlannerHeroPill">Wardrobe-first picks</span>
              <span className="tripPlannerHeroPill">Fully editable list</span>
            </div>

            <div className="tripPlannerHeroActions">
              <button type="button" className="btn primary" onClick={openCreate}>
                Add trip
              </button>
              {selectedTrip ? (
                <button type="button" className="btn" onClick={() => openEdit(selectedTrip)}>
                  Edit selected trip
                </button>
              ) : null}
            </div>
          </div>

          <div className="tripPlannerHeroArt" aria-hidden="true">
            <div className="tripPlannerGlow tripPlannerGlowOne" />
            <div className="tripPlannerGlow tripPlannerGlowTwo" />
            <div className="tripPlannerRoute">
              <span />
              <span />
              <span />
            </div>
            <PlaneIcon className="tripPlannerStudioPlane tripPlannerHeroPlane" />
            <div className="tripPlannerHeroLuggageStack">
              <LuggageVisual mode="combo" accent="light" />
            </div>
            <div className="tripPlannerTag">Your packing list</div>
          </div>
        </div>

        {!showBuilder && !selectedTrip && loadingTrips ? (
          <div className="tripPlannerGenerating tripPlannerHeroLoading" role="status" aria-live="polite">
            <div className="tripPlannerGeneratingTitle">Pulling your trips together</div>
            <div className="tripPlannerGeneratingSub">
              Loading your saved destinations and packing lists.
            </div>
            <div className="tripPlannerGeneratingBar tripPlannerLoadingBar" aria-hidden="true">
              <span />
            </div>
          </div>
        ) : null}
      </div>

      {tripMsg ? <div className="noteBox" style={{ marginTop: 12 }}>{tripMsg}</div> : null}

      {showBuilder ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="trip-builder-title">
          <div className="modalCard tripBuilderModalCard">
        <section className="tripPlannerBuilder tripBuilderModalPanel">
          <div className="tripBuilderTop">
            <div>
              <div className="tripPlannerEyebrow">{editingTripId ? "Update your trip" : "Your next trip"}</div>
              <div id="trip-builder-title" className="tripBuilderTitle">
                {builderStep === 1 ? "Start with your destination and dates" : "Add the details that shape the trip"}
              </div>
              <div className="tripBuilderSub">
                {builderStep === 1
                  ? "The first step should feel quick. Once the basics are set, we will bring up the rest of the planning details."
                  : "These extras help FitGPT tailor the packing list, but you can keep them flexible."}
              </div>
            </div>

            <button type="button" className="btn" onClick={closeBuilder}>
              Close
            </button>
          </div>

          <div className="tripBuilderStepRow" aria-live="polite">
            <div className={"tripBuilderStepPill" + (builderStep === 1 ? " active" : " complete")}>
              <span className="tripBuilderStepNumber">1</span>
              <span>Trip basics</span>
            </div>
            <div className={"tripBuilderStepDivider" + (builderStep === 2 ? " active" : "")} />
            <div className={"tripBuilderStepPill" + (builderStep === 2 ? " active" : "")}>
              <span className="tripBuilderStepNumber">2</span>
              <span>Trip details</span>
            </div>
          </div>

          {builderStep === 1 ? (
            <>
          <div className="tripBuilderShowcase tripBuilderShowcaseBasics">
            <TripBuilderPreview
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              tripPurpose={tripPurpose}
              luggageMode={luggageMode}
            />

            <div className="tripBuilderInfoCard">
              <div className="tripBuilderInfoTitle">Step one keeps it simple</div>
              <div className="tripBuilderInfoList">
                <div className="tripBuilderInfoItem">
                  <span className="tripBuilderInfoDot" />
                  <span>Pick where you are going</span>
                </div>
                <div className="tripBuilderInfoItem">
                  <span className="tripBuilderInfoDot" />
                  <span>Choose departure and return dates</span>
                </div>
                <div className="tripBuilderInfoItem">
                  <span className="tripBuilderInfoDot" />
                  <span>Then continue to the fun details</span>
                </div>
              </div>
              <div className="tripBuilderInfoFooter">
                {draftDuration ? `${draftDuration} day${draftDuration === 1 ? "" : "s"} planned` : "Trip length will appear here"}
              </div>
            </div>
          </div>

          <div className="tripBuilderSection tripBuilderSectionPrimary">
            <div className="tripBuilderSectionHeader">
              <div>
                <div className="tripBuilderSectionEyebrow">Step 1 of 2</div>
                <div className="tripBuilderSectionTitle">Destination and travel dates</div>
                <div className="tripBuilderSectionSub">
                  Needed to calculate trip length and weather.
                </div>
              </div>
              <div className={"tripBuilderStatusPill" + (hasRequiredTripInputs ? " ready" : "")}>
                {hasRequiredTripInputs ? "Ready to generate" : "Destination + dates needed"}
              </div>
            </div>

            <div className="tripBuilderGrid tripBuilderGridRequired">
              <label className="tripField tripFieldWide">
                <span className="tripFieldLabel">Destination</span>
                <input
                  className="tripFieldInput"
                  type="text"
                  placeholder="City, region, or destination"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  required
                />
              </label>

              <div className="tripField">
                <TripDatePickerField
                  label="Start date"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Pick your start date"
                  isOpen={openDateField === "start"}
                  onToggle={() => setOpenDateField((current) => (current === "start" ? "" : "start"))}
                  onClose={() => setOpenDateField("")}
                />
              </div>

              <div className="tripField">
                <TripDatePickerField
                  label="End date"
                  value={endDate}
                  minDate={startDate}
                  onChange={setEndDate}
                  placeholder="Pick your end date"
                  isOpen={openDateField === "end"}
                  onToggle={() => setOpenDateField((current) => (current === "end" ? "" : "end"))}
                  onClose={() => setOpenDateField("")}
                />
              </div>
            </div>

            <div className="tripBuilderMiniSummary" aria-live="polite">
              <span className="tripBuilderMiniPill">
                {draftDuration ? `${draftDuration} day${draftDuration === 1 ? "" : "s"} total` : "Trip length will appear here"}
              </span>
              <span className="tripBuilderMiniPill">
                {destination.trim() ? destination.trim() : "Destination pending"}
              </span>
            </div>
          </div>
            </>
          ) : (
            <>
          <div className="tripBuilderShowcase">
            <TripBuilderPreview
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              tripPurpose={tripPurpose}
              luggageMode={luggageMode}
            />

            <div className="tripBuilderInfoCard">
              <div className="tripBuilderInfoTitle">This list uses</div>
              <div className="tripBuilderInfoList">
                <div className="tripBuilderInfoItem">
                  <span className="tripBuilderInfoDot" />
                  <span>Weather for your exact dates</span>
                </div>
                <div className="tripBuilderInfoItem">
                  <span className="tripBuilderInfoDot" />
                  <span>Your wardrobe first</span>
                </div>
                <div className="tripBuilderInfoItem">
                  <span className="tripBuilderInfoDot" />
                  <span>Trip-length quantities</span>
                </div>
              </div>
              <div className="tripBuilderInfoFooter">
                {draftDuration ? `${draftDuration} day${draftDuration === 1 ? "" : "s"} planned` : "Add dates to preview length"}
              </div>
            </div>
          </div>

          <div className="tripBuilderSection">
            <div className="tripBuilderSectionHeader">
              <div>
                <div className="tripBuilderSectionEyebrow">Step 2 of 2</div>
                <div className="tripBuilderSectionTitle">Shape the vibe of the trip</div>
                <div className="tripBuilderSectionSub">
                  Add a quick note if you want the list to feel more polished, active, or relaxed.
                </div>
              </div>
              <div className="tripBuilderStatusPill optional">Optional</div>
            </div>

            <div className="tripBuilderGrid">
              <label className="tripField tripFieldWide">
                <span className="tripFieldLabel">Trip vibe</span>
                <input
                  className="tripFieldInput"
                  type="text"
                  placeholder="Beach, business, wedding..."
                  value={tripPurpose}
                  onChange={(event) => setTripPurpose(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="tripBuilderSection">
            <div className="tripBuilderSectionHeader">
              <div>
                <div className="tripBuilderSectionTitle">Pick your bag</div>
                <div className="tripBuilderSectionSub">
                  This keeps the packing quantities realistic.
                </div>
              </div>
              <div className="tripBuilderStatusPill optional">Optional</div>
            </div>
            <div className="tripLuggageGrid">
              {TRIP_LUGGAGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={"tripLuggageCard" + (luggageMode === option.key ? " active" : "")}
                  onClick={() => setLuggageMode(option.key)}
                >
                  <LuggageVisual mode={option.key} className="tripLuggageIcon" accent="light" />
                  <span className="tripLuggageLabel">{option.label}</span>
                  <span className="tripLuggageCopy">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tripBuilderSection">
            <div className="tripBuilderSectionHeader">
              <div>
                <div className="tripBuilderSectionTitle">Activities</div>
                <div className="tripBuilderSectionSub">
                  Optional. Pick any that match this trip.
                </div>
              </div>
              <div className="tripBuilderStatusPill optional">Optional</div>
            </div>

            <div className="tripActivitySuggestions">
              {TRIP_ACTIVITY_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={"tripActivityChip" + (activities.includes(suggestion) ? " active" : "")}
                  onClick={() => (activities.includes(suggestion)
                    ? requestConfirm({
                        type: "activity",
                        activity: suggestion,
                        title: "Remove this activity?",
                        message: `Do you want to remove ${suggestion} from this trip plan?`,
                        confirmLabel: "Yes, remove it",
                      })
                    : addActivity(suggestion))}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="tripActivityInputRow">
              <input
                className="tripFieldInput"
                type="text"
                placeholder="Add a custom activity"
                value={activityDraft}
                onChange={(event) => setActivityDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addActivity(activityDraft);
                  }
                }}
              />
              <button type="button" className="btn" onClick={() => addActivity(activityDraft)}>
                Add
              </button>
            </div>

              {activities.length ? (
                <div className="tripActivityList">
                {activities.map((activity) => (
                  <button
                    key={activity}
                    type="button"
                    className="tripActivityToken"
                    onClick={() => requestConfirm({
                      type: "activity",
                      activity,
                      title: "Remove this activity?",
                      message: `Do you want to remove ${activity} from this trip plan?`,
                      confirmLabel: "Yes, remove it",
                    })}
                  >
                    {normalizeTripActivityLabel(activity)}
                    <span aria-hidden="true"> \u00D7</span>
                  </button>
                ))}
              </div>
              ) : null}
          </div>
            </>
          )}

          {generating ? (
            <TripGenerationState
              destination={destination}
              startDate={startDate}
              endDate={endDate}
            />
          ) : null}

          <div className="tripBuilderActions">
            {builderStep === 1 ? (
              <>
                <button type="button" className="btn" onClick={closeBuilder}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setBuilderStep(2)}
                  disabled={!hasRequiredTripInputs}
                >
                  Continue to trip details
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn" onClick={() => setBuilderStep(1)}>
                  Back
                </button>
                <button type="button" className="btn primary" onClick={() => handleGenerateTrip()} disabled={generating}>
                  {generating ? "Generating..." : editingTripId ? "Update packing list" : "Generate packing list"}
                </button>
              </>
            )}
          </div>
        </section>
          </div>
        </div>
      ) : null}

      {trips.length > 0 ? (
        <div className="tripPlannerShelf">
          {trips.map((trip) => (
            <button
              key={trip.trip_id}
              type="button"
              className={"tripPlannerCard" + (selectedTrip?.trip_id === trip.trip_id ? " active" : "")}
              onClick={() => toggleTripDetails(trip.trip_id)}
              aria-expanded={selectedTrip?.trip_id === trip.trip_id}
            >
              <div className="tripPlannerCardStamp">Trip</div>
              <div className="tripPlannerCardTop">
                <div className="tripPlannerCardDestination">{trip.destination_label || trip.destination}</div>
                <div className="tripPlannerCardDuration">
                  {trip.summary?.durationDays || tripDurationDays(trip.start_date, trip.end_date)} days
                </div>
              </div>
              <div className="tripPlannerCardDates">{formatTripDates(trip.start_date, trip.end_date)}</div>
              <div className="tripPlannerCardMeta">
                <span>{trip.summary?.weatherLabel || "General packing"}</span>
                <span>{trip.summary?.totalItemCount || 0} items</span>
              </div>
              <div className="tripPlannerCardAction">
                {selectedTrip?.trip_id === trip.trip_id ? "Hide details" : "Open trip details"}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {archivedTrips.length > 0 ? (
        <section className="tripPlannerHistorySection">
          <div className="tripPlannerHistoryHeader">
            <div>
              <div className="tripPlannerEyebrow">Trip history</div>
              <div className="tripPlannerHistoryTitle">Saved trip history</div>
            </div>
            <button type="button" className="btn" onClick={() => setShowTripHistory((current) => !current)}>
              {showTripHistory ? "Hide trip history" : "See trip history"}
            </button>
          </div>

          {showTripHistory ? (
            <div className="tripPlannerHistoryList">
              {archivedTrips.map((trip) => (
                <article key={trip.trip_id} className="tripPlannerHistoryCard">
                  <div>
                    <div className="tripPlannerHistoryDestination">{trip.destination_label || trip.destination}</div>
                    <div className="tripPlannerHistoryDates">{formatTripDates(trip.start_date, trip.end_date)}</div>
                  </div>
                  <button type="button" className="btn" onClick={() => handleRestoreTrip(trip.trip_id)}>
                    Restore trip
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedTrip ? (
        <section className="card dashWide tripPlannerDetail">
          <div className="tripPlannerDetailTopline">
            <div className="tripPlannerEyebrow">Your packing list</div>
            <div className="tripPlannerDetailToplineMeta">
              {selectedTripStats.groupCount} categories
            </div>
          </div>

          <div className="tripPlannerDetailHero">
            <div>
              <div className="tripPlannerEyebrow">Suggested items for your trip</div>
              <div className="tripPlannerDetailTitle">{selectedTrip.destination_label || selectedTrip.destination}</div>
              <div className="tripPlannerDetailSub">
                Based on your destination and trip length: {formatTripDates(selectedTrip.start_date, selectedTrip.end_date)}
              </div>
              <div className="tripPlannerDetailIntro">
                FitGPT prioritizes clothes you already own first, then fills any gaps with practical suggestions so the list stays usable.
              </div>
            </div>
          </div>

          <div className="tripPlannerSummaryGrid">
            <div className="tripPlannerSummaryCard">
              <div className="tripPlannerSummaryLabel">Trip length</div>
              <div className="tripPlannerSummaryValue">
                {selectedTrip.summary?.durationDays || tripDurationDays(selectedTrip.start_date, selectedTrip.end_date)} days
              </div>
              <div className="tripPlannerSummaryMeta">Based on your chosen departure and return dates.</div>
            </div>
            <div className="tripPlannerSummaryCard">
              <div className="tripPlannerSummaryLabel">Expected weather</div>
              <div className="tripPlannerSummaryValue">{tempRangeLabel(selectedTrip.summary)}</div>
              <div className="tripPlannerSummaryMeta">{weatherHeadline(selectedTrip)}</div>
            </div>
            <div className="tripPlannerSummaryCard">
              <div className="tripPlannerSummaryLabel">Wardrobe-first mix</div>
              <div className="tripPlannerSummaryValue">{selectedTripStats.ownedItems} owned picks</div>
              <div className="tripPlannerSummaryMeta">{selectedTripStats.suggestedItems} suggested fillers</div>
            </div>
            <div className="tripPlannerSummaryCard">
              <div className="tripPlannerSummaryLabel">Packed so far</div>
              <div className="tripPlannerSummaryValue">{totalPackedCount} of {selectedTripStats.totalItems}</div>
              <div className="tripPlannerSummaryMeta">{selectedTripStats.packedPercent}% checked off</div>
            </div>
            <div className="tripPlannerSummaryCard">
              <div className="tripPlannerSummaryLabel">Bag setup</div>
              <div className="tripPlannerSummaryValue">
                {TRIP_LUGGAGE_OPTIONS.find((option) => option.key === selectedTrip.luggage_mode)?.label || "Carry on"}
              </div>
              <div className="tripPlannerSummaryMeta">Use this to keep quantities practical.</div>
            </div>
          </div>

          <div className="tripPlannerPackedProgress" aria-hidden="true">
            <span style={{ width: `${selectedTripStats.packedPercent}%` }} />
          </div>

          {selectedTrip.forecast?.status !== "ok" && selectedTrip.forecast?.message ? (
            <div className="tripPlannerFallbackNote">{selectedTrip.forecast.message}</div>
          ) : null}

          {Array.isArray(selectedTrip.activities) && selectedTrip.activities.length ? (
            <div className="tripPlannerActivityRow">
              {selectedTrip.activities.map((activity) => (
                <span key={activity} className="tripPlannerActivityPill">{normalizeTripActivityLabel(activity)}</span>
              ))}
            </div>
          ) : null}

          <TripDayStrip trip={selectedTrip} />

          <TripOutfitPlan trip={selectedTrip} />

          <div className="tripPlannerActions">
            <button type="button" className="btn" onClick={() => openEdit(selectedTrip)}>
              Edit trip
            </button>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await handleGenerateTrip({
                  destination: selectedTrip.destination || "",
                  startDate: selectedTrip.start_date || "",
                  endDate: selectedTrip.end_date || "",
                  tripPurpose: selectedTrip.trip_purpose || "",
                  luggageMode: selectedTrip.luggage_mode || "carry-on",
                  activities: Array.isArray(selectedTrip.activities) ? selectedTrip.activities : [],
                  editingTripId: selectedTrip.trip_id,
                });
              }}
            >
              Refresh packing list
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => requestConfirm({
                type: "trip",
                tripId: selectedTrip.trip_id,
                title: "Remove this trip from your packing plans?",
                message: "This trip will move to your trip history so you can restore it later if you need it again.",
                confirmLabel: "Yes, remove trip",
              })}
            >
              Remove trip
            </button>
          </div>

          <div className="tripPackingGroups">
            {(Array.isArray(selectedTrip.packing_groups) ? selectedTrip.packing_groups : []).length ? (
              (Array.isArray(selectedTrip.packing_groups) ? selectedTrip.packing_groups : []).map((group) => (
              <section key={group.key} className="tripPackingGroup">
                <div className="tripPackingGroupTop">
                  <div className="tripPackingGroupHeading">
                    <div className="tripPackingGroupIcon" aria-hidden="true">{groupIcon(group.key)}</div>
                    <div>
                      <div className="tripPackingGroupTitle">{group.label}</div>
                      <div className="tripPackingGroupSub">{group.summary}</div>
                    </div>
                  </div>
                  <div className="tripPackingGroupMeta">
                    <div className="tripPackingGroupQty">{group.totalQuantity} total</div>
                    <div className="tripPackingGroupSourceRow">
                      <span className="tripPackingGroupSourcePill owned">
                        {sumItemQuantities(group.items, (item) => item?.owned)} wardrobe
                      </span>
                      <span className="tripPackingGroupSourcePill">
                        {sumItemQuantities(group.items, (item) => !item?.owned)} suggested
                      </span>
                    </div>
                  </div>
                </div>

                <div className="tripPackingItemList">
                  {(Array.isArray(group.items) ? group.items : []).map((item) => (
                    <div key={item.item_id} className={"tripPackingItem" + (item.packed ? " packed" : "")}>
                      <button
                        type="button"
                        className={"tripPackingCheck" + (item.packed ? " active" : "")}
                        onClick={() => handleTogglePacked(group.key, item.item_id)}
                        aria-pressed={item.packed}
                        aria-label={item.packed ? `Mark ${item.name} as unpacked` : `Mark ${item.name} as packed`}
                      >
                        {item.packed ? "\u2713" : ""}
                      </button>

                      {item.image_url ? (
                        <img className="tripPackingItemImg" src={item.image_url} alt={item.name || "Packing item"} />
                      ) : (
                        <div className="tripPackingItemPh" aria-hidden="true" />
                      )}

                      <div className="tripPackingItemCopy">
                        <div className="tripPackingItemTitleRow">
                          <div className="tripPackingItemName">{item.name}</div>
                          <span className={"tripPackingSourcePill" + (item.owned ? " owned" : "")}>
                            {item.owned ? "From your wardrobe" : "Suggested"}
                          </span>
                        </div>
                        <div className="tripPackingItemMeta">
                          {item.note || (item.owned ? "From your wardrobe" : "Suggested item")}
                        </div>
                        <div className="tripPackingItemCategory">
                          {item.category || group.label}
                        </div>
                      </div>

                      <div className="tripPackingItemControls">
                        <div className="tripPackingQtyCluster">
                          <div className="tripPackingQtyBadge">Qty {item.quantity}</div>
                          <div className="tripPackingQtyEditor">
                            <button type="button" className="tripPackingQtyBtn" onClick={() => handleQuantityChange(group.key, item.item_id, -1)}>-</button>
                            <span className="tripPackingQtyValue">{item.quantity}</span>
                            <button type="button" className="tripPackingQtyBtn" onClick={() => handleQuantityChange(group.key, item.item_id, 1)}>+</button>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="tripPackingRemoveBtn"
                          onClick={() => requestConfirm({
                            type: "item",
                            groupKey: group.key,
                            itemId: item.item_id,
                            title: "Remove this packing item?",
                            message: `Do you want to remove ${item.name || "this item"} from the trip packing list?`,
                            confirmLabel: "Yes, remove item",
                          })}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {activeAddGroup === group.key ? (
                  <div className="tripPackingAddRow">
                    <input
                      className="tripFieldInput"
                      type="text"
                      placeholder={`Add to ${group.label}`}
                      value={customItemName}
                      onChange={(event) => setCustomItemName(event.target.value)}
                    />
                    <input
                      className="tripFieldInput tripPackingQtyInput"
                      type="number"
                      min="1"
                      value={customItemQty}
                      onChange={(event) => setCustomItemQty(event.target.value)}
                    />
                    <button type="button" className="btn primary" onClick={() => handleAddCustomItem(group.key, group.label)}>
                      Add item
                    </button>
                    <button type="button" className="btn" onClick={() => setActiveAddGroup("")}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" className="tripPackingAddBtn" onClick={() => setActiveAddGroup(group.key)}>
                    + Add item
                  </button>
                )}
              </section>
              ))
            ) : (
              <div className="tripPlannerFallbackNote">
                No packing items are showing yet. Refresh the packing list to regenerate practical suggestions for this trip.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {confirmState ? (
        <ConfirmActionModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onCancel={() => setConfirmState(null)}
          onConfirm={handleConfirmAction}
        />
      ) : null}
    </section>
  );
}
