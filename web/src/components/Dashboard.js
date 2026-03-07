// web/src/components/Dashboard.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { savedOutfitsApi } from "../api/savedOutfitsApi";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import useWardrobe from "../hooks/useWardrobe";
import { fetchAIRecommendations } from "../api/recommendationsApi";
import { plannedOutfitsApi } from "../api/plannedOutfitsApi";
import ClothCard from "./ClothCard";
import MeshGradient from "./MeshGradient";
import ErrorBoundary from "./ErrorBoundary";
import UpcomingPlanCard from "./UpcomingPlanCard";
import { OPEN_ADD_ITEM_FLAG, REUSE_OUTFIT_KEY, EVT_PLANNED_OUTFITS_CHANGED } from "../utils/constants";
import { readRecSeed, writeRecSeed, readTimeOverride, writeTimeOverride, readWeatherOverride, setWeatherOverride } from "../utils/userStorage";
import { safeParse, formatToday, normalizeFitTag, setReuseOutfit, buildGoogleCalendarUrl } from "../utils/helpers";
import { getWeatherContext } from "../api/weatherApi";
import {
  titleCase, normalizeCategory, normalizeColorName, colorToCss,
  timeCategoryFromDate,
  generateThreeOutfits, idsSignature, makeRecentSets,
  buildExplanation, buildOutfitFromIds,
} from "../utils/recommendationEngine";

const DEFAULT_BODY_TYPE = "rectangle";

function readReuseOutfit() {
  const raw = sessionStorage.getItem(REUSE_OUTFIT_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!parsed || !Array.isArray(parsed.items)) return null;

  const ids = parsed.items.map((x) => (x ?? "").toString().trim()).filter(Boolean);
  const normalized = savedOutfitsApi.normalizeItems(ids);

  if (!normalized.length) return null;

  return {
    items: normalized,
    saved_outfit_id: (parsed.saved_outfit_id || "").toString(),
  };
}

function clearReuseOutfit() {
  sessionStorage.removeItem(REUSE_OUTFIT_KEY);
}

export default function Dashboard({ answers, onResetOnboarding = () => {} }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const wardrobe = useWardrobe(user);
  const [recSeed, setRecSeed] = useState(() => readRecSeed());

  const [saveMsg, setSaveMsg] = useState("");
  const [savingSig, setSavingSig] = useState("");
  const [savedSigs, setSavedSigs] = useState(() => new Set());

  const [recentExactSigs, setRecentExactSigs] = useState(() => new Set());
  const [recentItemCounts, setRecentItemCounts] = useState(() => new Map());

  const [weatherLoading, setWeatherLoading] = useState(() => !readWeatherOverride());
  const [weatherMsg, setWeatherMsg] = useState("");
  const [weatherTempF, setWeatherTempF] = useState(null);
  const [weatherCategory, setWeatherCategory] = useState(() => readWeatherOverride() || "mild");
  const [dotCount, setDotCount] = useState(1);
  const [showWeatherPicker, setShowWeatherPicker] = useState(false);

  const [timeCategory, setTimeCategory] = useState(() => readTimeOverride() || timeCategoryFromDate(new Date()));
  const [showTimePicker, setShowTimePicker] = useState(false);

  // AI recommendation state
  const [aiOutfits, setAiOutfits] = useState(null);
  const [aiExplanations, setAiExplanations] = useState([]);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSource, setAiSource] = useState("local");
  const [aiRefreshToken, setAiRefreshToken] = useState(0);
  const [aiHasResolved, setAiHasResolved] = useState(false);

  const [upcomingPlan, setUpcomingPlan] = useState(null);


  // Persist recSeed so recommendations survive navigation
  useEffect(() => {
    writeRecSeed(recSeed);
  }, [recSeed]);

  useEffect(() => {
    let alive = true;

    async function loadUpcomingPlan() {
      try {
        const res = await plannedOutfitsApi.listPlanned(user);
        const list = Array.isArray(res?.planned_outfits) ? res.planned_outfits : [];

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const limit = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const upcoming = list
          .filter((p) => {
            const d = (p?.planned_date || "").toString();
            return d >= todayStr && d <= limit;
          })
          .sort((a, b) => (a?.planned_date || "").localeCompare(b?.planned_date || ""));

        if (alive) setUpcomingPlan(upcoming.length > 0 ? upcoming[0] : null);
      } catch {
        if (alive) setUpcomingPlan(null);
      }
    }

    loadUpcomingPlan();

    const onPlannedChange = () => loadUpcomingPlan();
    window.addEventListener(EVT_PLANNED_OUTFITS_CHANGED, onPlannedChange);

    return () => {
      alive = false;
      window.removeEventListener(EVT_PLANNED_OUTFITS_CHANGED, onPlannedChange);
    };
  }, [user]);

  useEffect(() => {
    let alive = true;

    async function loadSavedSigs() {
      if (!user) {
        if (alive) setSavedSigs(new Set());
        return;
      }

      try {
        const res = await savedOutfitsApi.listSaved(user);
        const list = Array.isArray(res?.saved_outfits) ? res.saved_outfits : [];

        const sigs = new Set(list.map((o) => (o?.outfit_signature || "").toString().trim()).filter(Boolean));

        if (alive) setSavedSigs(sigs);
      } catch {
        if (alive) setSavedSigs(new Set());
      }
    }

    loadSavedSigs();

    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    let alive = true;

    async function loadRecentHistory() {
      try {
        const res = await outfitHistoryApi.listHistory(user);
        const list = Array.isArray(res?.history) ? res.history : [];

        const sorted = [...list].sort((a, b) => {
          const da = (a?.worn_at || "").toString();
          const db = (b?.worn_at || "").toString();
          return db.localeCompare(da);
        });

        const recentSets = makeRecentSets(sorted);

        if (!alive) return;
        setRecentExactSigs(recentSets.sigs);
        setRecentItemCounts(recentSets.itemCounts);
      } catch {
        if (!alive) return;
        setRecentExactSigs(new Set());
        setRecentItemCounts(new Map());
      }
    }

    loadRecentHistory();

    return () => {
      alive = false;
    };
  }, [user]);

  const loadWeather = async () => {
    const override = readWeatherOverride();
    if (override) {
      setWeatherCategory(override);
      setWeatherMsg("");
      setWeatherLoading(false);
      return;
    }

    setWeatherLoading(true);
    setWeatherMsg("");

    const w = await getWeatherContext();
    setWeatherTempF(w.tempF);
    setWeatherCategory(w.category);
    setWeatherMsg(w.message || "");
    setWeatherLoading(false);
  };

  const loadTime = () => {
    const override = readTimeOverride();
    if (override) {
      setTimeCategory(override);
      return;
    }

    const detected = timeCategoryFromDate(new Date());
    setTimeCategory(detected || "work hours");
  };

  useEffect(() => {
    loadWeather();
    loadTime();

    const onFocus = () => {
      loadWeather();
      loadTime();
    };
    window.addEventListener("focus", onFocus);

    const weatherIntervalId = window.setInterval(() => loadWeather(), 10 * 60 * 1000);
    const timeIntervalId = window.setInterval(() => loadTime(), 60 * 1000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(weatherIntervalId);
      window.clearInterval(timeIntervalId);
    };

  }, []);

  // Dot animation for "Detecting Weather" text
  useEffect(() => {
    if (!weatherLoading) return;
    const id = window.setInterval(() => setDotCount((c) => (c % 3) + 1), 400);
    return () => window.clearInterval(id);
  }, [weatherLoading]);

  // Fetch AI recommendations in background (debounced to avoid re-fires on mount)
  useEffect(() => {
    let alive = true;

    const timerId = setTimeout(() => {
      async function fetchAI() {
        const active = (Array.isArray(wardrobe) ? wardrobe : []).filter(
          (x) => x && x.is_active !== false
        );
        if (active.length < 2) {
          if (alive) {
            setAiOutfits(null);
            setAiSource("local");
            setAiLoading(false);
            setAiHasResolved(true);
          }
          return;
        }

        setAiLoading(true);

        try {
          const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
          const style = Array.isArray(answers?.style) ? answers.style : [];

          const context = {
            weather_category: weatherCategory || "mild",
            time_category: timeCategory || "work hours",
            body_type: answers?.bodyType || DEFAULT_BODY_TYPE,
            occasion: dressFor.length ? dressFor[0] : "daily",
            style_preferences: style,
          };

          const res = await fetchAIRecommendations(active, context);

          if (!alive) return;

          if (res?.source === "ai" && Array.isArray(res.outfits) && res.outfits.length > 0) {
            const byId = new Map(active.map((x) => [(x?.id ?? "").toString(), x]));

            const resolved = res.outfits.map((o) => {
              const ids = Array.isArray(o?.item_ids) ? o.item_ids : [];
              return ids
                .map((id) => {
                  const found = byId.get(id.toString());
                  if (!found) return null;
                  return {
                    id: found.id ?? id,
                    name: found.name || "Wardrobe item",
                    category: normalizeCategory(found.category),
                    color: titleCase(normalizeColorName(found.color || "")),
                    fit_tag: normalizeFitTag(found.fit_tag || found.fitTag || found.fit),
                    image_url: found.image_url || "",
                  };
                })
                .filter(Boolean);
            }).filter((outfit) => outfit.length >= 2);

            if (resolved.length > 0) {
              setAiOutfits(resolved.slice(0, 3));
              setAiExplanations(res.outfits.slice(0, 3).map((o) => o?.explanation || ""));
              setAiSource("ai");
            } else {
              setAiOutfits(null);
              setAiSource("local");
            }
          } else {
            setAiOutfits(null);
            setAiSource("local");
          }
        } catch {
          if (alive) {
            setAiOutfits(null);
            setAiSource("local");
          }
        } finally {
          if (alive) {
            setAiLoading(false);
            setAiHasResolved(true);
          }
        }
      }

      fetchAI();
    }, 150);

    return () => {
      alive = false;
      clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardrobe, weatherCategory, timeCategory, answers, aiRefreshToken]);

  const bodyTypeId = answers?.bodyType ? answers.bodyType : DEFAULT_BODY_TYPE;

  const generatedOutfits = useMemo(
    () =>
      generateThreeOutfits(
        wardrobe,
        recSeed,
        bodyTypeId,
        recentExactSigs,
        recentItemCounts,
        weatherCategory,
        timeCategory,
        answers,
        savedSigs
      ),
    [wardrobe, recSeed, bodyTypeId, recentExactSigs, recentItemCounts, weatherCategory, timeCategory, answers, savedSigs]
  );

  const reused = useMemo(() => readReuseOutfit(), []);

  // Pair outfits with their AI explanations, filtering out saved outfits
  const { outfits, pairedExplanations } = useMemo(() => {
    let raw;
    let rawExplanations;

    if (reused) {
      const reusedOutfit = buildOutfitFromIds(reused.items, wardrobe);
      const rest = generatedOutfits.slice(0, 2);
      raw = [reusedOutfit, ...rest].slice(0, 3);
      rawExplanations = raw.map(() => "");
    } else if (aiOutfits && aiOutfits.length > 0) {
      // Pair AI outfits with explanations before filtering
      const paired = aiOutfits.map((outfit, i) => ({ outfit, explanation: aiExplanations[i] || "" }));
      // Filter out saved AI outfits
      const filtered = paired.filter(({ outfit }) => {
        const sig = idsSignature((outfit || []).map((x) => x?.id));
        return !sig || !savedSigs.has(sig);
      });
      // Pad with local outfits (already exclude saved via generateThreeOutfits)
      let localIdx = 0;
      while (filtered.length < 3 && localIdx < generatedOutfits.length) {
        filtered.push({ outfit: generatedOutfits[localIdx++], explanation: "" });
      }
      const sliced = filtered.slice(0, 3);
      raw = sliced.map((p) => p.outfit);
      rawExplanations = sliced.map((p) => p.explanation);
    } else {
      raw = generatedOutfits;
      rawExplanations = generatedOutfits.map(() => "");
    }

    return { outfits: raw, pairedExplanations: rawExplanations };
  }, [generatedOutfits, reused, wardrobe, aiOutfits, aiExplanations, savedSigs]);

  const [selectedIdx, setSelectedIdx] = useState(null);

  // Clamp selectedIdx when outfits shrink (e.g. after saving removes an option)
  useEffect(() => {
    if (selectedIdx != null && selectedIdx >= outfits.length && outfits.length > 0) {
      setSelectedIdx(0);
    }
  }, [outfits.length, selectedIdx]);

  const explanationText = useMemo(() => {
    if (selectedIdx == null) return "";
    if (aiSource === "ai" && !reused && pairedExplanations[selectedIdx]) {
      return pairedExplanations[selectedIdx];
    }

    const activeOutfit = outfits[selectedIdx] || outfits[0] || [];
    const text = buildExplanation({ answers, outfit: activeOutfit, weatherCategory, timeCategory });
    const cleaned = (text || "").toString().trim();
    return cleaned || "Pick a style and an occasion in onboarding to get a personalized explanation.";
  }, [answers, outfits, selectedIdx, aiSource, pairedExplanations, reused, weatherCategory, timeCategory]);

  const chipText = useMemo(() => {
    const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
    return dressFor.length ? titleCase(dressFor[0]) : "Daily";
  }, [answers]);

  const canRefresh = true;

  const handleRefreshRecommendation = () => {
    clearReuseOutfit();
    setSelectedIdx(0);
    // New seed for local fallback (only used if AI fails)
    setRecSeed((prev) => prev + Math.floor(Math.random() * 100000) + 1);
    // Keep current AI outfits visible while new ones load —
    // only clear source/explanations so the word animation replays
    setAiExplanations([]);
    setAiRefreshToken((prev) => prev + 1);
  };


  const goAddItem = () => {
    sessionStorage.setItem(OPEN_ADD_ITEM_FLAG, "1");
    navigate("/wardrobe");
  };

  const openPlanModal = () => {
    const idx = selectedIdx ?? 0;
    const outfit = outfits[idx] || outfits[0] || [];
    if (!outfit.length) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    const date = `${yyyy}-${mm}-${dd}`;

    const itemNames = outfit.map((x) => x?.name).filter(Boolean);
    const calUrl = buildGoogleCalendarUrl({ date, occasion: "", itemNames });
    window.open(calUrl, "_blank", "noopener");

    // Also save locally so it shows in the app
    const itemIds = outfit.map((x) => x?.id).filter(Boolean);
    const itemDetails = outfit.map((x) => ({
      id: (x?.id ?? "").toString(),
      name: x?.name || "",
      category: x?.category || "",
      color: x?.color || "",
      image_url: x?.image_url || "",
    }));

    plannedOutfitsApi.planOutfit({
      item_ids: itemIds,
      item_details: itemDetails,
      planned_date: date,
      occasion: "",
      source: "planner",
    }, user).catch(() => {});

    setSaveMsg("Opening Google Calendar...");
    window.setTimeout(() => setSaveMsg(""), 2500);
  };

  const handleWearPlanNow = () => {
    if (!upcomingPlan) return;
    const itemIds = Array.isArray(upcomingPlan.item_ids) ? upcomingPlan.item_ids : [];
    if (!itemIds.length) return;
    setReuseOutfit(itemIds, upcomingPlan.planned_id);
    window.location.reload();
  };

  function outfitSignature(outfit) {
    const ids = savedOutfitsApi.normalizeItems((outfit || []).map((x) => x?.id));
    return ids.join("|");
  }



  const onTiltMove = useCallback((e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const tiltX = -y * 8;
    const tiltY = x * 8;
    el.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
  }, []);

  const onTiltLeave = useCallback((e) => {
    e.currentTarget.style.transform = "";
  }, []);

  async function handleSaveOutfit(outfit) {
    const itemIds = (outfit || []).map((x) => x?.id).filter(Boolean);
    const normalized = savedOutfitsApi.normalizeItems(itemIds);
    const sig = normalized.join("|");

    if (!sig) {
      setSaveMsg("Nothing to save yet.");
      window.setTimeout(() => setSaveMsg(""), 2500);
      return;
    }

    if (savedSigs.has(sig)) {
      setSavingSig(sig);
      try {
        await savedOutfitsApi.unsaveOutfit(sig, user);
        await outfitHistoryApi.removeBySignature(sig, user);
        setSavedSigs((prev) => {
          const next = new Set(prev);
          next.delete(sig);
          return next;
        });
        setSaveMsg("Removed from saved outfits.");
        window.setTimeout(() => setSaveMsg(""), 2500);
      } catch (e) {
        setSaveMsg(e?.message || "Could not unsave outfit.");
        window.setTimeout(() => setSaveMsg(""), 2500);
      } finally {
        setSavingSig("");
      }
      return;
    }

    setSavingSig(sig);

    try {
      const itemDetails = (outfit || []).map((x) => ({
        id: (x?.id ?? "").toString(),
        name: x?.name || "",
        category: x?.category || "",
        color: x?.color || "",
        image_url: x?.image_url || "",
      }));

      const res = await savedOutfitsApi.saveOutfit({
        items: normalized,
        item_details: itemDetails,
        source: "recommended",
        context: {
          occasion: chipText,
          temperature_category: weatherCategory,
          temperature_f: weatherTempF,
          time_of_day: timeCategory,
        },
      }, user);

      const created = res?.created === true;
      const msg = (res?.message || "").toString().trim();

      setSavedSigs((prev) => {
        const next = new Set(prev);
        next.add(sig);
        return next;
      });

      if (msg) setSaveMsg(msg);
      else setSaveMsg(created ? "Saved! Refreshing recommendations..." : "This outfit is already in your saved outfits.");

      window.setTimeout(() => setSaveMsg(""), 2500);

      // Refresh AI recommendations to backfill the saved slot
      setAiExplanations([]);
      setAiRefreshToken((prev) => prev + 1);
    } catch (e) {
      setSaveMsg(e?.message || "Could not save outfit.");
      window.setTimeout(() => setSaveMsg(""), 2500);
    } finally {
      setSavingSig("");
    }
  }

  const timeLine = useMemo(() => {
    const t = (timeCategory || "").toString().trim();
    return t ? titleCase(t) : "Work Hours";
  }, [timeCategory]);

  const applyWeatherOverride = (next) => {
    const v = (next || "").toString().trim().toLowerCase();
    if (!v) {
      setWeatherOverride(null);
      setShowWeatherPicker(false);
      loadWeather();
      return;
    }
    setWeatherOverride(v);
    setWeatherCategory(v);
    setShowWeatherPicker(false);
    setWeatherMsg("");
  };

  const applyTimeOverride = (next) => {
    const v = (next || "").toString().trim().toLowerCase();
    if (!v) {
      writeTimeOverride("");
      setShowTimePicker(false);
      loadTime();
      return;
    }
    writeTimeOverride(v);
    setTimeCategory(v);
    setShowTimePicker(false);
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="dashHeroBar">
        <div className="dashHeroLeft">
          <div className="dashHeroDate">{formatToday()}</div>
          <div className="dashQuickRow">
            <button type="button" className="dashQuickBtn" onClick={goAddItem}>+ Add Item</button>
            <button type="button" className="dashQuickBtn" onClick={openPlanModal}>{"\u2606"} Plan Outfit</button>
            <button type="button" className="dashQuickBtn" onClick={() => navigate("/history")}>{"\u29D6"} History</button>
          </div>
        </div>
        <div className="dashHeroRight">
        </div>
      </div>

      <section className="card dashWide dashWeatherCard">
        <div className="dashWeatherHud">
          <div className="dashWeatherMain">
            <span className="dashWeatherEmoji">
              {weatherLoading ? "\u26C5" :
               weatherCategory === "cold" ? "\u2744\uFE0F" :
               weatherCategory === "cool" ? "\uD83C\uDF2C\uFE0F" :
               weatherCategory === "warm" ? "\u2600\uFE0F" :
               weatherCategory === "hot" ? "\uD83D\uDD25" : "\u26C5"}
            </span>
            <div className="dashWeatherInfo">
              <div className="dashWeatherTemp">
                {weatherLoading
                  ? `Detecting Weather${".".repeat(dotCount)}`
                  : weatherTempF != null && Number.isFinite(Number(weatherTempF))
                    ? `${weatherTempF}\u00B0F`
                    : titleCase(weatherCategory)}
              </div>
              <div className="dashWeatherLabel">
                {weatherLoading
                  ? ""
                  : weatherTempF != null && Number.isFinite(Number(weatherTempF))
                    ? titleCase(weatherCategory)
                    : "Today's Weather"}
              </div>
            </div>
          </div>

          <div className="dashWeatherChips">
            <button
              type="button"
              className={"dashContextChip" + (showWeatherPicker ? " active" : "")}
              onClick={() => { setShowWeatherPicker((p) => !p); setShowTimePicker(false); }}
            >
              <span className="dashContextChipIcon">{"\u2601\uFE0F"}</span>
              <span>{weatherLoading ? `Detecting${".".repeat(dotCount)}` : titleCase(weatherCategory)}</span>
            </button>

            <button
              type="button"
              className={"dashContextChip" + (showTimePicker ? " active" : "")}
              onClick={() => { setShowTimePicker((p) => !p); setShowWeatherPicker(false); }}
            >
              <span className="dashContextChipIcon">{"\uD83D\uDD52"}</span>
              <span>{timeLine}</span>
            </button>
          </div>
        </div>

        {weatherMsg && !weatherLoading ? (
          <div className="dashWeatherStatus">{weatherMsg}</div>
        ) : null}

        {showWeatherPicker ? (
          <div className="dashContextPicker">
            {["", "cold", "cool", "mild", "warm", "hot"].map((val) => {
              const current = readWeatherOverride() || "";
              const isActive = val === current;

              const label = val ? titleCase(val) : "Live Weather";
              return (
                <button
                  key={val}
                  type="button"
                  className={"dashContextPickerBtn" + (isActive ? " active" : "")}
                  onClick={() => applyWeatherOverride(val)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        {showTimePicker ? (
          <div className="dashContextPicker">
            {["", "morning", "work hours", "evening", "night"].map((val) => {
              const current = readTimeOverride() || "";
              const isActive = val === current;
              const label = val ? titleCase(val) : "System Time";
              return (
                <button
                  key={val}
                  type="button"
                  className={"dashContextPickerBtn" + (isActive ? " active" : "")}
                  onClick={() => applyTimeOverride(val)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <UpcomingPlanCard plan={upcomingPlan} wardrobe={wardrobe} onWearNow={handleWearPlanNow} />

      <section className="card dashWide dashRecCard">
        <div className="dashRecHeader">
          <ErrorBoundary fallback={null}><MeshGradient className="dashRecHeaderGradient" /></ErrorBoundary>
          <div className="dashRecHeaderLeft">
            <div className="dashRecTitle">Today’s Recommendation</div>
            {reused ? (
              <div className="dashMuted" style={{ fontSize: 12, marginTop: 4 }}>
                Reused from saved outfits
              </div>
            ) : null}
          </div>
          <div className="dashChip">{chipText}</div>
          {outfits.length > 0 && (
            <div className="dashRecActions">
              <button type="button" className="btn primary dashRecActionBtn" onClick={handleRefreshRecommendation} disabled={!canRefresh}>
                Refresh
              </button>
              <button type="button" className="btn dashRecActionBtn" onClick={() => {
                const outfit = outfits[selectedIdx ?? 0] || outfits[0] || [];
                if (!outfit.length) return;
                const lines = outfit.map((item) => `${item.name}${item.color ? ` (${item.color})` : ""}`);
                const text = `My FitGPT Outfit:\n${lines.join("\n")}`;
                navigator.clipboard.writeText(text).then(() => {
                  setSaveMsg("Outfit copied to clipboard!");
                  window.setTimeout(() => setSaveMsg(""), 2500);
                }).catch(() => {
                  setSaveMsg("Could not copy to clipboard.");
                  window.setTimeout(() => setSaveMsg(""), 2500);
                });
              }}>
                Share
              </button>
            </div>
          )}
        </div>

        <div key={recSeed} className="dashOutfitsAnimWrap">
          {!aiHasResolved ? (
            <div className="dashAiLoading" style={{ padding: "32px 0", textAlign: "center" }}>
              Generating your outfits...
            </div>
          ) : outfits.length === 0 ? (
            <div className="dashEmptyWardrobe">
              <div className="dashEmptyIcon">&#x1F455;</div>
              <div className="dashEmptyTitle">Your wardrobe is empty</div>
              <div className="dashEmptySub">Add some clothing items to get personalized outfit recommendations.</div>
              <button className="btn primary" type="button" onClick={() => navigate("/wardrobe")}>
                Add to Wardrobe
              </button>
            </div>
          ) : outfits.map((outfit, idx) => {
            const sig = outfitSignature(outfit);
            const isSaved = savedSigs.has(sig);
            const disabled = !sig || savingSig === sig;
            const label = isSaved ? "Unsave" : savingSig === sig ? "Saving..." : "Save";

            return (
              <div
                key={`opt_${idx}`}
                className={"dashOutfitOption" + (idx === selectedIdx ? " dashOutfitSelected" : "")}
                style={{ animationDelay: `${idx * 120}ms`, marginTop: idx === 0 ? 0 : 18, cursor: "pointer" }}
                onClick={() => setSelectedIdx(idx)}
              >
                <div className="optionLabel">
                  <span className="optionLabelNum">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="optionLabelSlash">{"//"}</span>
                  <span className="optionLabelText">OPTION</span>
                </div>

                <div className="dashOutfitGridFigma">
                  {outfit.map((item, itemIdx) => (
                    <div key={item.id} className="dashSquareTile dashTileReveal" style={{ animationDelay: `${itemIdx * 90 + idx * 140}ms` }} onPointerMove={onTiltMove} onPointerLeave={onTiltLeave}>
                      {idx === selectedIdx ? (
                        <ErrorBoundary fallback={item.image_url ? <img className="dashSquareImg" src={item.image_url} alt={item.name} /> : <div className="dashSquareImg" aria-hidden="true" />}><ClothCard imageUrl={item.image_url} className="dashSquareImg" /></ErrorBoundary>
                      ) : item.image_url ? (
                        <img className="dashSquareImg" src={item.image_url} alt={item.name} />
                      ) : (
                        <div className="dashSquareImg" aria-hidden="true" />
                      )}
                      <div className="dashSquareNameRow">
                        <span
                          className="dashColorDot"
                          style={{ background: colorToCss(item.color) }}
                          title={item.color}
                        />
                        <span className="dashSquareName">{item.name}</span>
                      </div>
                    </div>
                  ))}

                  <div className="dashSaveBtnCell">
                    <button
                      type="button"
                      className={"styledSaveBtn" + (isSaved ? " saved" : "")}
                      onClick={() => handleSaveOutfit(outfit)}
                      disabled={disabled}
                    >
                      <span className="styledSaveBtnIcon">{isSaved ? "\u2713" : "\u2661"}</span>
                      <span className="styledSaveBtnText">{label}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>



        {saveMsg ? (
          <div className="noteBox" style={{ marginTop: 12 }}>
            {saveMsg}
          </div>
        ) : null}
      </section>


      {selectedIdx != null && ReactDOM.createPortal(
        <div className="dashWhyFloat" aria-live="polite">
          <div className="dashInfoTitle">
            Why Option {String(selectedIdx + 1).padStart(2, "0")}?
            {aiSource === "ai" && !reused ? <span className="dashAiBadge">AI Powered Suggestion</span> : null}
          </div>
          {aiLoading ? (
            <div className="dashAiLoading">Thinking...</div>
          ) : (
            <div className="dashSubText" style={{ lineHeight: 1.45 }}>
              <span key={`${selectedIdx}-${aiRefreshToken}-${recSeed}`} className="dashAiReveal">
                {explanationText.split(" ").map((word, i) => (
                  <React.Fragment key={i}>
                    <span className="dashAiWord" style={{ animationDelay: `${i * 40}ms` }}>
                      {word}
                    </span>{" "}
                  </React.Fragment>
                ))}
              </span>
            </div>
          )}
        </div>,
        document.body
      )}

    </div>
  );

}