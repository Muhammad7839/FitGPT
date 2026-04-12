import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWeatherForecast } from "../api/weatherApi";
import { plannedOutfitsApi } from "../api/plannedOutfitsApi";
import { buildFallbackPlanningSuggestion, buildForecastSuggestions } from "../utils/forecastPlanner";

const DEFAULT_BODY_TYPE = "rectangle";

function shortDayLabel(date, index) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return `Day ${index + 1}`;
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsed);
}

function shortMonthDay(date) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date || "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

function longDate(date) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date || "";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(parsed);
}

function degreeLabel(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)}°` : "--";
}

function outfitItemDetails(outfit) {
  return (Array.isArray(outfit) ? outfit : []).map((item) => ({
    id: (item?.id ?? "").toString(),
    name: item?.name || "",
    category: item?.category || "",
    color: item?.color || "",
    image_url: item?.image_url || "",
  }));
}

export default function UpcomingWeatherPlanner({
  wardrobe,
  user,
  isGuestMode,
  answers,
}) {
  const navigate = useNavigate();
  const [forecast, setForecast] = useState({ status: "loading", source: "auto", days: [], message: "" });
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [planningDate, setPlanningDate] = useState("");

  useEffect(() => {
    let alive = true;

    setForecast({ status: "loading", source: "auto", days: [], message: "" });

    getWeatherForecast(6)
      .then((result) => {
        if (!alive) return;
        setForecast(result);
      })
      .catch(() => {
        if (!alive) return;
        setForecast({
          status: "fallback",
          source: "fallback",
          days: [],
          message: "Weather data is unavailable, showing general recommendations.",
        });
      });

    return () => {
      alive = false;
    };
  }, [refreshToken]);

  const hasWardrobe = Array.isArray(wardrobe) && wardrobe.length > 0;
  const bodyTypeId = answers?.bodyType || DEFAULT_BODY_TYPE;
  const occasion = Array.isArray(answers?.dressFor) && answers.dressFor.length ? answers.dressFor[0] : "";

  const suggestions = useMemo(() => {
    if (!hasWardrobe || forecast.status !== "ok") return [];
    return buildForecastSuggestions({
      wardrobe,
      forecastDays: forecast.days,
      seedNumber: refreshToken || Date.now(),
      bodyTypeId,
      answers,
    });
  }, [answers, bodyTypeId, forecast.days, forecast.status, hasWardrobe, refreshToken, wardrobe]);

  const fallbackSuggestion = useMemo(() => {
    if (!hasWardrobe) return null;
    return buildFallbackPlanningSuggestion({
      wardrobe,
      seedNumber: refreshToken || Date.now(),
      bodyTypeId,
      answers,
    });
  }, [answers, bodyTypeId, hasWardrobe, refreshToken, wardrobe]);

  useEffect(() => {
    if (!suggestions.length) {
      setSelectedDate("");
      return;
    }

    const hasExisting = suggestions.some((entry) => entry.date === selectedDate);
    if (hasExisting) return;

    const defaultIndex = suggestions.length > 1 ? 1 : 0;
    setSelectedDate(suggestions[defaultIndex]?.date || suggestions[0]?.date || "");
  }, [selectedDate, suggestions]);

  useEffect(() => {
    if (!actionMsg) return undefined;
    const timeoutId = window.setTimeout(() => setActionMsg(""), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [actionMsg]);

  const selectedSuggestion = useMemo(() => {
    if (!suggestions.length) return null;
    return suggestions.find((entry) => entry.date === selectedDate) || suggestions[0] || null;
  }, [selectedDate, suggestions]);

  const selectedOutfit = Array.isArray(selectedSuggestion?.outfit) ? selectedSuggestion.outfit : [];

  async function handlePlanSuggestion(suggestion) {
    if (!suggestion?.outfit?.length) return;

    if (isGuestMode) {
      navigate("/login");
      return;
    }

    setPlanningDate(suggestion.date);
    try {
      const result = await plannedOutfitsApi.planOutfit(
        {
          item_ids: suggestion.outfit.map((item) => item?.id).filter(Boolean),
          item_details: outfitItemDetails(suggestion.outfit),
          planned_date: suggestion.date,
          occasion,
          notes: `Based on upcoming weather: ${suggestion.title}.`,
          source: "forecast-planner",
        },
        user
      );

      setActionMsg((result?.message || "").toString().trim() || "Outfit planned!");
    } catch {
      setActionMsg("Could not save this weather-based plan.");
    } finally {
      setPlanningDate("");
    }
  }

  return (
    <section className="card dashWide forecastPlannerCard" aria-labelledby="forecast-planner-title">
      <div className="forecastPlannerHeader">
        <div>
          <div className="forecastPlannerEyebrow">Based on upcoming weather...</div>
          <h2 id="forecast-planner-title" className="forecastPlannerTitle">Plan ahead this week</h2>
          <div className="forecastPlannerSub">
            Outfit suggestions use temperature and precipitation first, with wind and overall conditions as extra refinement.
          </div>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => setRefreshToken((token) => token + 1)}
          disabled={forecast.status === "loading"}
        >
          {forecast.status === "loading" ? "Loading..." : "Refresh forecast"}
        </button>
      </div>

      {actionMsg ? <div className="noteBox" style={{ marginTop: 12 }}>{actionMsg}</div> : null}

      {!hasWardrobe ? (
        <div className="forecastPlannerEmpty">
          <div className="dashStrong">Add a few wardrobe items to unlock forecast-based planning</div>
          <div className="dashSubText" style={{ marginTop: 6 }}>
            FitGPT prioritizes pieces you already own, then falls back to balanced combinations when your wardrobe is still growing.
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn primary" onClick={() => navigate("/wardrobe")}>
              Open Wardrobe
            </button>
          </div>
        </div>
      ) : null}

      {hasWardrobe && forecast.status === "loading" ? (
        <div className="forecastPlannerLoading" aria-live="polite">
          <div className="forecastPlannerLoadingLine" />
          <div className="forecastPlannerLoadingLine short" />
          <div className="forecastPlannerLoadingLine" />
        </div>
      ) : null}

      {hasWardrobe && forecast.status === "ok" && selectedSuggestion ? (
        <>
          <div className="forecastPlannerHint">
            Browse the next few days, then open the day you want to dress for.
          </div>

          <div className="forecastPlannerDays" role="tablist" aria-label="Upcoming weather days">
            {suggestions.map((suggestion, index) => {
              const selected = suggestion.date === selectedSuggestion.date;
              const tabId = `forecast-day-tab-${suggestion.date}`;
              const panelId = `forecast-day-panel-${suggestion.date}`;
              return (
                <button
                  key={suggestion.date}
                  type="button"
                  role="tab"
                  id={tabId}
                  aria-controls={panelId}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={"forecastDayBtn" + (selected ? " active" : "")}
                  onClick={() => setSelectedDate(suggestion.date)}
                >
                  <span className="forecastDayTop">
                    <span className="forecastDayLabel">{shortDayLabel(suggestion.date, index)}</span>
                    <span className="forecastDayIcon" aria-hidden="true">{suggestion.icon}</span>
                  </span>
                  <span className="forecastDayDate">{shortMonthDay(suggestion.date)}</span>
                  <span className="forecastDayTemps">
                    {degreeLabel(suggestion.tempHighF)}
                    <span className="forecastDayLow">
                      {Number.isFinite(suggestion.tempLowF) ? degreeLabel(suggestion.tempLowF) : ""}
                    </span>
                  </span>
                  <span className="forecastDayMeta">
                    {Number.isFinite(suggestion.precipitationChance) ? `${Math.round(suggestion.precipitationChance)}% rain` : suggestion.title}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id={`forecast-day-panel-${selectedSuggestion.date}`}
            className="forecastPlannerPanel"
            role="tabpanel"
            aria-labelledby={`forecast-day-tab-${selectedSuggestion.date}`}
            aria-label={`Outfit suggestion for ${longDate(selectedSuggestion.date)}`}
          >
            <div className="forecastPlannerWeather">
              <div className="forecastPlannerWeatherHero">
                <span className="forecastPlannerWeatherIcon" aria-hidden="true">{selectedSuggestion.icon}</span>
                <div>
                  <div className="forecastPlannerWeatherTitle">{selectedSuggestion.title}</div>
                  <div className="forecastPlannerWeatherDate">{longDate(selectedSuggestion.date)}</div>
                </div>
              </div>

              <div className="forecastPlannerMetrics">
                <div className="forecastPlannerMetric">
                  <span className="forecastPlannerMetricLabel">Temperature</span>
                  <strong>
                    {Number.isFinite(selectedSuggestion.tempHighF) && Number.isFinite(selectedSuggestion.tempLowF)
                      ? `${degreeLabel(selectedSuggestion.tempHighF)} / ${degreeLabel(selectedSuggestion.tempLowF)}`
                      : "Forecast pending"}
                  </strong>
                </div>
                <div className="forecastPlannerMetric">
                  <span className="forecastPlannerMetricLabel">Precipitation</span>
                  <strong>
                    {Number.isFinite(selectedSuggestion.precipitationChance)
                      ? `${Math.round(selectedSuggestion.precipitationChance)}%`
                      : "Low signal"}
                  </strong>
                </div>
                <div className="forecastPlannerMetric">
                  <span className="forecastPlannerMetricLabel">Wind</span>
                  <strong>
                    {Number.isFinite(selectedSuggestion.windMph)
                      ? `${Math.round(selectedSuggestion.windMph)} mph`
                      : "Calm"}
                  </strong>
                </div>
              </div>

              <div className="forecastPlannerReason">{selectedSuggestion.note}</div>
            </div>

            <div className="forecastPlannerOutfit">
              <div className="forecastPlannerOutfitTop">
                <div>
                  <div className="forecastPlannerOutfitTitle">Suggested outfit</div>
                  <div className="forecastPlannerOutfitSub">{selectedSuggestion.summary || "Built from your wardrobe for the selected day."}</div>
                </div>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => handlePlanSuggestion(selectedSuggestion)}
                  disabled={planningDate === selectedSuggestion.date}
                >
                  {isGuestMode
                    ? "Sign in to save"
                    : planningDate === selectedSuggestion.date
                      ? "Saving..."
                      : "Plan this look"}
                </button>
              </div>

              {selectedOutfit.length > 0 ? (
                <div className="savedOutfitItems forecastPlannerItems">
                  {selectedOutfit.map((item, index) => (
                    <div key={`${selectedSuggestion.date}_${item?.id || index}`} className="savedOutfitItemChip forecastPlannerItemChip">
                      {item?.image_url ? (
                        <img className="savedOutfitItemImg forecastPlannerItemImg" src={item.image_url} alt={item?.name || "Wardrobe item"} />
                      ) : (
                        <div className="savedOutfitItemPh forecastPlannerItemPh" />
                      )}
                      <div className="forecastPlannerItemText">
                        <span className="savedOutfitItemName">{item?.name || "Wardrobe item"}</span>
                        <span className="forecastPlannerItemMeta">{item?.category || "Item"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="forecastPlannerNoOutfit" role="status" aria-live="polite">
                  Your wardrobe does not have a complete weather-ready look for this day yet. Add a few more core pieces and FitGPT will tighten the suggestion.
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {hasWardrobe && forecast.status === "ok" && !selectedSuggestion ? (
        <div className="forecastPlannerEmpty">
          <div className="dashStrong">Forecast loaded, but there is not enough outfit coverage yet</div>
          <div className="dashSubText" style={{ marginTop: 6 }}>
            Add a few more complete outfit pieces so FitGPT can build weather-specific combinations for upcoming days.
          </div>
        </div>
      ) : null}

      {hasWardrobe && forecast.status === "fallback" && fallbackSuggestion ? (
        <>
          <div className="forecastPlannerFallbackMsg">{forecast.message}</div>
          <div className="forecastPlannerFallbackCard">
            <div className="forecastPlannerOutfitTop">
              <div>
                <div className="forecastPlannerOutfitTitle">{fallbackSuggestion.title}</div>
                <div className="forecastPlannerOutfitSub">{fallbackSuggestion.summary}</div>
              </div>
              <button
                type="button"
                className="btn primary"
                onClick={() => handlePlanSuggestion({ ...fallbackSuggestion, date: new Date().toISOString().slice(0, 10) })}
              >
                {isGuestMode ? "Sign in to save" : "Plan this look"}
              </button>
            </div>

            <div className="forecastPlannerReason">{fallbackSuggestion.note}</div>

            <div className="savedOutfitItems forecastPlannerItems">
              {fallbackSuggestion.outfit.map((item, index) => (
                <div key={`fallback_${item?.id || index}`} className="savedOutfitItemChip forecastPlannerItemChip">
                  {item?.image_url ? (
                    <img className="savedOutfitItemImg forecastPlannerItemImg" src={item.image_url} alt={item?.name || "Wardrobe item"} />
                  ) : (
                    <div className="savedOutfitItemPh forecastPlannerItemPh" />
                  )}
                  <div className="forecastPlannerItemText">
                    <span className="savedOutfitItemName">{item?.name || "Wardrobe item"}</span>
                    <span className="forecastPlannerItemMeta">{item?.category || "Item"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
