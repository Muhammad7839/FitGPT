import React, { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { loadWardrobe } from "../utils/userStorage";
import { generatePackingList } from "../utils/recommendationEngine";
import GuestModeNotice from "./GuestModeNotice";

const WEATHER_OPTIONS = [
  { value: "cold", label: "Cold (< 40 F)" },
  { value: "cool", label: "Cool (40-55 F)" },
  { value: "mild", label: "Mild (55-70 F)" },
  { value: "warm", label: "Warm (70-85 F)" },
  { value: "hot",  label: "Hot (> 85 F)" },
];

const PRECIP_OPTIONS = [
  { value: "clear", label: "Clear" },
  { value: "rain",  label: "Rain" },
  { value: "snow",  label: "Snow" },
  { value: "storm", label: "Storm" },
];

const OCCASION_OPTIONS = [
  { value: "",         label: "Any" },
  { value: "casual",   label: "Casual" },
  { value: "work",     label: "Work" },
  { value: "formal",   label: "Formal" },
  { value: "athletic", label: "Athletic" },
  { value: "social",   label: "Social" },
];

const CATEGORY_ICONS = {
  Tops: "👕", Bottoms: "👖", Outerwear: "🧥", Shoes: "👟",
  Accessories: "🎒", "One-Piece": "👗",
};

const CATEGORY_ORDER = ["Outerwear", "Tops", "Bottoms", "One-Piece", "Shoes", "Accessories"];

export default function PackingList() {
  const { user } = useAuth();
  const wardrobe = useMemo(() => loadWardrobe(user), [user]);

  const [days, setDays] = useState(5);
  const [weather, setWeather] = useState("mild");
  const [precip, setPrecip] = useState("clear");
  const [occasion, setOccasion] = useState("");
  const [checked, setChecked] = useState(new Set());
  const [generated, setGenerated] = useState(false);

  const packingList = useMemo(() => {
    if (!generated) return null;
    return generatePackingList(wardrobe, {
      days,
      weatherCategory: weather,
      precipCategory: precip,
      occasion,
    });
  }, [generated, wardrobe, days, weather, precip, occasion]);

  const handleGenerate = () => {
    setChecked(new Set());
    setGenerated(true);
  };

  const handleReset = () => {
    setGenerated(false);
    setChecked(new Set());
  };

  const toggleCheck = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkAll = () => {
    if (!packingList) return;
    const allIds = new Set();
    for (const items of Object.values(packingList.categories)) {
      for (const item of items) allIds.add(item.id);
    }
    setChecked(allIds);
  };

  const visibleCategories = packingList
    ? CATEGORY_ORDER.filter((cat) => packingList.categories[cat]?.length)
    : [];

  const checkedCount = checked.size;
  const totalCount = packingList?.totalItems || 0;

  if (!user) {
    return (
      <div className="onboarding onboardingPage">
        <div className="packingTopBar">
          <div className="packingTitle">Packing List</div>
          <div className="packingSub">Sign in to generate trip packing lists</div>
        </div>
        <GuestModeNotice compact />
      </div>
    );
  }

  return (
    <div className="onboarding onboardingPage">
      <div className="packingTopBar">
        <div>
          <div className="packingTitle">Packing List</div>
          <div className="packingSub">Plan what to pack based on your wardrobe and trip weather</div>
        </div>
      </div>

      {/* ── Trip configuration ──────────────────────────────────────── */}
      <section className="card dashWide packingConfigCard">
        <div className="packingConfigTitle">Trip Details</div>
        <div className="packingConfigGrid">
          <label className="packingField">
            <span className="packingFieldLabel">Trip Length</span>
            <div className="packingDaysRow">
              <input
                type="range"
                min={1}
                max={21}
                value={days}
                onChange={(e) => { setDays(Number(e.target.value)); setGenerated(false); }}
                className="packingRange"
              />
              <span className="packingDaysValue">{days} day{days !== 1 ? "s" : ""}</span>
            </div>
          </label>
          <label className="packingField">
            <span className="packingFieldLabel">Weather</span>
            <select
              className="packingSelect"
              value={weather}
              onChange={(e) => { setWeather(e.target.value); setGenerated(false); }}
            >
              {WEATHER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="packingField">
            <span className="packingFieldLabel">Conditions</span>
            <select
              className="packingSelect"
              value={precip}
              onChange={(e) => { setPrecip(e.target.value); setGenerated(false); }}
            >
              {PRECIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="packingField">
            <span className="packingFieldLabel">Occasion</span>
            <select
              className="packingSelect"
              value={occasion}
              onChange={(e) => { setOccasion(e.target.value); setGenerated(false); }}
            >
              {OCCASION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <button className="btn primary packingGenerateBtn" onClick={handleGenerate}>
          {generated ? "Regenerate List" : "Generate Packing List"}
        </button>
      </section>

      {/* ── Generated list ──────────────────────────────────────────── */}
      {packingList && (
        <>
          {/* Summary bar */}
          <div className="packingSummaryBar">
            <span className="packingSummaryText">
              {checkedCount}/{totalCount} packed
            </span>
            <div className="packingSummaryProgress">
              <div
                className="packingSummaryFill"
                style={{ width: `${totalCount ? (checkedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
            <div className="packingSummaryActions">
              {checkedCount < totalCount && (
                <button className="btn packingSummaryBtn" onClick={checkAll}>Check All</button>
              )}
              <button className="btn packingSummaryBtn" onClick={handleReset}>Reset</button>
            </div>
          </div>

          {totalCount === 0 ? (
            <div className="packingEmpty">
              <div className="packingEmptyIcon">🧳</div>
              <div className="packingEmptyText">
                Your wardrobe doesn't have enough items for this trip configuration.
                Try adding more items to your wardrobe.
              </div>
            </div>
          ) : (
            <div className="packingCategories">
              {visibleCategories.map((cat) => {
                const items = packingList.categories[cat];
                const catChecked = items.filter((i) => checked.has(i.id)).length;
                return (
                  <section key={cat} className="packingCategorySection">
                    <div className="packingCategoryHeader">
                      <span className="packingCategoryIcon">{CATEGORY_ICONS[cat] || "📦"}</span>
                      <span className="packingCategoryName">{cat}</span>
                      <span className="packingCategoryCount">{catChecked}/{items.length}</span>
                    </div>
                    <div className="packingItemList">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          className={`packingItemRow${checked.has(item.id) ? " packingItemChecked" : ""}`}
                          onClick={() => toggleCheck(item.id)}
                        >
                          <span className="packingCheckbox">{checked.has(item.id) ? "✓" : ""}</span>
                          {item.image_url ? (
                            <img className="packingItemThumb" src={item.image_url} alt="" />
                          ) : (
                            <div className="packingItemThumbPh" />
                          )}
                          <div className="packingItemInfo">
                            <div className="packingItemName">{item.name}</div>
                            <div className="packingItemMeta">
                              {item.color}{item.clothing_type ? ` / ${item.clothing_type}` : ""}
                              {item.layer_type ? ` / ${item.layer_type} layer` : ""}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {/* Trip summary */}
          <div className="packingTripNote">
            {days}-day trip / {weather} weather
            {precip !== "clear" ? ` / ${precip}` : ""}
            {occasion ? ` / ${occasion}` : ""}
            {" "}— {totalCount} item{totalCount !== 1 ? "s" : ""} recommended
          </div>
        </>
      )}
    </div>
  );
}
