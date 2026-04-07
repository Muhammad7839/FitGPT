import React, { useEffect, useMemo, useState } from "react";
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
import { OPEN_ADD_ITEM_FLAG, REUSE_OUTFIT_KEY } from "../utils/constants";
import { readRecSeed, writeRecSeed, readTimeOverride, writeTimeOverride, readWeatherOverride, setWeatherOverride, loadRejectedOutfits, saveRejectedOutfit, loadRecommendationFeedback, saveRecommendationFeedback } from "../utils/userStorage";
import { safeParse, formatToday, normalizeFitTag, normalizeItems, buildGoogleCalendarUrl, onTiltMove, onTiltLeave, tomorrowDateStr } from "../utils/helpers";
import { getWeatherContext } from "../api/weatherApi";
import {
  titleCase, normalizeCategory, normalizeColorName, colorToCss,
  timeCategoryFromDate,
  generateThreeOutfits, idsSignature, makeRecentSets,
  buildExplanation, buildOutfitFromIds, scoreOutfitForDisplay,
  analyzeOutfitColors, colorInfo, buildFeedbackProfile,
} from "../utils/recommendationEngine";

const DEFAULT_BODY_TYPE = "rectangle";
const OCCASION_OPTIONS = ["", "casual", "work", "formal", "athletic", "social", "lounge"];
const STYLE_OPTIONS = ["", "casual", "formal", "smart casual", "relaxed", "lounge", "activewear", "social", "work"];
const RECENT_RECOMMENDATION_SIGS_KEY = "fitgpt_recent_recommendation_sigs_v1";

function recommendationSignature(outfit) {
  return idsSignature((Array.isArray(outfit) ? outfit : []).map((item) => item?.id));
}

function clothCardKey(outfit, item, refreshToken, recSeed) {
  const outfitSig = recommendationSignature(outfit);
  const itemId = (item?.id ?? "").toString();
  const image = (item?.image_url || "").toString();
  return `${outfitSig}|${itemId}|${image}|${refreshToken}|${recSeed}`;
}

function readRecentRecommendationSigs() {
  const raw = sessionStorage.getItem(RECENT_RECOMMENDATION_SIGS_KEY);
  const parsed = raw ? safeParse(raw) : [];
  return Array.isArray(parsed)
    ? parsed.map((value) => (value || "").toString().trim()).filter(Boolean)
    : [];
}

function writeRecentRecommendationSigs(signatures) {
  const next = [...new Set((Array.isArray(signatures) ? signatures : []).map((value) => (value || "").toString().trim()).filter(Boolean))].slice(-12);
  sessionStorage.setItem(RECENT_RECOMMENDATION_SIGS_KEY, JSON.stringify(next));
  return next;
}

function readReuseOutfit() {
  const raw = sessionStorage.getItem(REUSE_OUTFIT_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!parsed || !Array.isArray(parsed.items)) return null;

  const ids = parsed.items.map((x) => (x ?? "").toString().trim()).filter(Boolean);
  const normalized = normalizeItems(ids);

  if (!normalized.length) return null;

  return {
    items: normalized,
    saved_outfit_id: (parsed.saved_outfit_id || "").toString(),
  };
}

function clearReuseOutfit() {
  sessionStorage.removeItem(REUSE_OUTFIT_KEY);
}



function summarizeExplanation(text) {
  const cleaned = (text || "").toString().trim();
  if (!cleaned) return "";
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, 2).join(" ");
}

function outfitRoleLabel(item) {
  const category = normalizeCategory(item?.category);
  const layer = (item?.layer_type || "").toString().trim().toLowerCase();
  if (item?.is_one_piece) return "One-piece";
  if (layer === "base") return "Base layer";
  if (layer === "mid") return "Mid layer";
  if (category === "Outerwear" || layer === "outer") return "Outer layer";
  if (category === "Tops") return "Top";
  if (category === "Bottoms") return "Bottom";
  if (category === "Shoes") return "Shoes";
  if (category === "Accessories") return "Accessory";
  return category || "Item";
}

function buildColorReason(outfit) {
  const items = Array.isArray(outfit) ? outfit : [];
  if (!items.length) return "The color choices stay simple, which makes the outfit easier to wear and style.";

  const analysis = analyzeOutfitColors(items);
  const { isBalanced, relationships, uniqueColors } = analysis;
  const names = uniqueColors.slice(0, 4).map(titleCase);

  if (!relationships.length) {
    if (names.length === 1) return `${names[0]} acts like the anchor color, which keeps the outfit cohesive.`;
    return "The color choices stay simple, which makes the outfit easier to wear and style.";
  }

  const featured = relationships.find((r) => r.type === "complementary")
    || relationships.find((r) => r.type === "analogous")
    || relationships.find((r) => r.type === "triadic")
    || relationships.find((r) => r.type === "neutral-anchor")
    || relationships.find((r) => r.type === "neutral-pair")
    || relationships[0];

  const a = titleCase(featured.nameA);
  const b = titleCase(featured.nameB);

  if (featured.type === "complementary") {
    return `${a} and ${b} are complementary colors — they sit across the color wheel, which creates a bold but intentional contrast that makes both colors pop.`;
  }
  if (featured.type === "analogous") {
    return `${a} and ${b} are analogous — close neighbors on the color wheel. This creates a smooth tonal flow that feels cohesive without being monotone.`;
  }
  if (featured.type === "triadic") {
    return `${a} and ${b} create a triadic contrast — spread across the wheel with enough distance to feel vibrant, but still coordinated.`;
  }
  if (featured.type === "neutral-anchor") {
    const aInfo = colorInfo(featured.nameA);
    const neutralName = aInfo.neutral ? a : b;
    const chromaticName = aInfo.neutral ? b : a;
    if (isBalanced) return `${neutralName} anchors the palette while ${chromaticName} provides the visual interest — this neutral-plus-accent balance is one of the most reliable ways to build a cohesive outfit.`;
    return `${chromaticName} draws the eye while ${neutralName} keeps the rest of the outfit grounded, so nothing competes for attention.`;
  }
  if (featured.type === "neutral-pair") {
    return `The palette stays in neutral territory with ${names.join(" and ")}, which keeps the outfit versatile and lets texture and silhouette define the look instead of color.`;
  }
  if (featured.type === "monochrome") {
    return `Staying in the ${a} family creates a monochrome effect — the tonal consistency makes the outfit feel streamlined and intentional.`;
  }
  if (featured.type === "clash") {
    return `${a} and ${b} are an unexpected combination — the tension between them adds personality, and the rest of the outfit keeps it from feeling random.`;
  }

  if (names.length >= 3) return `The palette stays interesting by balancing ${names.slice(0, 3).join(", ")} without letting any one piece overpower the outfit.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} create a clear visual relationship, which helps the outfit feel intentional instead of random.`;
  return "The color choices stay simple, which makes the outfit easier to wear and style.";
}

function buildComfortReason(outfit, answers, weatherCategory) {
  const comfort = Array.isArray(answers?.comfort) ? answers.comfort : [];
  const fitTags = (Array.isArray(outfit) ? outfit : []).map((item) => normalizeFitTag(item?.fit_tag || item?.fitTag || item?.fit));
  const hasLayering = (Array.isArray(outfit) ? outfit : []).filter((item) => item?.layer_type).length >= 2;

  if (comfort.includes("Layered") && hasLayering) return "This matches your comfort preference for layering, so it should feel practical without looking bulky.";
  if (comfort.includes("Relaxed") && fitTags.some((fit) => fit === "relaxed" || fit === "oversized")) return "The outfit leans relaxed, which should feel easier to wear through the day.";
  if (comfort.includes("Fitted") && fitTags.some((fit) => fit === "tailored" || fit === "slim" || fit === "athletic")) return "There is some structure here, so the outfit still feels polished while staying close to your fitted preference.";
  if (comfort.includes("Stretchy")) return "The recommendation avoids overcomplicating the outfit, which usually helps comfort stay consistent through movement and daily wear.";
  if (weatherCategory === "cold" || weatherCategory === "cool") return "The extra warmth is doing comfort work here too, so the outfit should feel more wearable in cooler weather.";
  return "The outfit keeps the structure straightforward, which makes it easier to wear comfortably for a full day.";
}

function buildLogicReason(outfit, answers, weatherCategory, timeCategory) {
  const items = Array.isArray(outfit) ? outfit : [];
  const categories = items.map((item) => normalizeCategory(item?.category));
  const hasTop = categories.includes("Tops");
  const hasBottom = categories.includes("Bottoms");
  const hasShoes = categories.includes("Shoes");
  const hasOuterwear = categories.includes("Outerwear") || items.some((item) => item?.layer_type === "outer");
  const occasion = Array.isArray(answers?.dressFor) && answers.dressFor.length ? answers.dressFor[0] : "";
  const style = Array.isArray(answers?.style) && answers.style.length ? answers.style[0] : "";

  const structure = hasTop && hasBottom && hasShoes
    ? "It follows a complete outfit structure with a clear top, bottom, and shoe choice"
    : "It uses the best available structure from your wardrobe";

  const context = [style, occasion].filter(Boolean).join(" / ");
  const weatherText = weatherCategory ? `for ${weatherCategory} weather` : "for the current conditions";
  const timeText = timeCategory ? `around ${timeCategory}` : "for the moment";

  if (hasOuterwear && (weatherCategory === "cold" || weatherCategory === "cool")) {
    return `${structure}, and the outer layer makes the recommendation feel more realistic ${weatherText}.`;
  }
  if (context) {
    return `${structure}, and it stays pointed toward your ${context} preference ${timeText}.`;
  }
  return `${structure}, which is why the recommendation feels wearable instead of experimental.`;
}

function buildGuidanceReason(outfit, answers) {
  const style = Array.isArray(answers?.style) && answers.style.length ? answers.style[0] : "daily";
  const itemNames = (Array.isArray(outfit) ? outfit : []).map((item) => item?.name).filter(Boolean);
  const leadItems = itemNames.slice(0, 2).join(" + ");
  if (leadItems) return `If you are unsure how to wear this, start with ${leadItems} and let the rest of the outfit stay simple.`;
  return `When you want a safer ${style} outfit, keeping the silhouette clean and the palette focused is a reliable styling move.`;
}

function buildComfortSummary(outfit, answers, weatherCategory) {
  const comfort = Array.isArray(answers?.comfort) ? answers.comfort : [];
  const fitTags = (Array.isArray(outfit) ? outfit : []).map((item) => normalizeFitTag(item?.fit_tag || item?.fitTag || item?.fit));
  const pieces = Array.isArray(outfit) ? outfit : [];
  const hasLayering = pieces.filter((item) => item?.layer_type).length >= 2;

  if (comfort.includes("Layered") && hasLayering) {
    return {
      badge: "Comfort: Layered match",
      note: "Matches your layered comfort preference.",
    };
  }

  if (comfort.includes("Relaxed") && fitTags.some((fit) => fit === "relaxed" || fit === "oversized")) {
    return {
      badge: "Comfort: Relaxed fit",
      note: "Leans easier and less structured through the day.",
    };
  }

  if (comfort.includes("Fitted") && fitTags.some((fit) => fit === "tailored" || fit === "slim" || fit === "athletic")) {
    return {
      badge: "Comfort: Structured fit",
      note: "Keeps a closer, more polished shape like you asked for.",
    };
  }

  if (comfort.includes("Stretchy")) {
    return {
      badge: "Comfort: Easy movement",
      note: "The outfit stays simple and movement-friendly.",
    };
  }

  if (weatherCategory === "cold" || weatherCategory === "cool") {
    return {
      badge: "Comfort: Weather support",
      note: "Extra warmth should make this easier to wear today.",
    };
  }

  return {
    badge: comfort.length ? "Comfort: Balanced" : "Comfort: Everyday",
    note: comfort.length ? "Keeps the outfit easy to wear without overcomplicating it." : "A simple option that should feel comfortable for everyday wear.",
  };
}

function getWeatherGlyph(category, isLoading, precipCondition) {
  if (isLoading) return "⌛";
  if (precipCondition === "snow") return "🌨️";
  if (precipCondition === "storm") return "⛈️";
  if (precipCondition === "rain") return "🌧️";
  if (category === "cold") return "😮‍💨";
  if (category === "cool") return "🧥";
  if (category === "warm") return "☀️";
  if (category === "hot") return "🥵";
  return "🙂";
}

function buildWeatherPresentation({ category, tempF, loading, source, message, precipCondition }) {
  const tempNumber = Number(tempF);
  const hasTemp = Number.isFinite(tempNumber);
  const tempC = hasTemp ? Math.round(((tempNumber - 32) * 5) / 9) : null;

  if (loading) {
    return {
      glyph: getWeatherGlyph(category, true, precipCondition),
      headline: "Detecting weather",
      subline: "Getting your local conditions now.",
      status: "Checking local weather",
      detail: "",
    };
  }

  const categoryLabel = titleCase(category || "mild");
  const tempLabel = hasTemp ? `${Math.round(tempNumber)} F / ${tempC} C` : categoryLabel;

  if (source === "override") {
    return {
      glyph: getWeatherGlyph(category, false, precipCondition),
      headline: tempLabel,
      subline: `${categoryLabel} weather selected manually`,
      status: "Manual weather override",
      detail: "Recommendations are using the weather you picked.",
    };
  }

  if (source === "fallback") {
    return {
      glyph: getWeatherGlyph(category, false, precipCondition),
      headline: "Weather unavailable",
      subline: "Using balanced recommendations for now",
      status: "Fallback mode",
      detail: message || "We could not read live weather, so FitGPT is using a safe default.",
    };
  }

  const precipLabel = { rain: "Rain", snow: "Snow", storm: "Storm" }[precipCondition] || "";
  const conditionSuffix = precipLabel ? ` / ${precipLabel}` : "";

  return {
    glyph: getWeatherGlyph(category, false, precipCondition),
    headline: tempLabel,
    subline: `Live weather: ${categoryLabel}${conditionSuffix}`,
    status: "Live weather active",
    detail: hasTemp
      ? precipLabel
        ? `Recommendations are adjusted for ${precipLabel.toLowerCase()} conditions.`
        : "Recommendations are using your current local temperature."
      : "",
  };
}

export default function Dashboard({ answers, onResetOnboarding = () => {} }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuestMode = !user;

  const wardrobe = useWardrobe(user);
  const [recSeed, setRecSeed] = useState(() => readRecSeed());

  const [saveMsg, setSaveMsg] = useState("");
  const [savingSig, setSavingSig] = useState("");
  const [savedSigs, setSavedSigs] = useState(() => new Set());
  const [recentRecommendationSigs, setRecentRecommendationSigs] = useState(() => new Set(readRecentRecommendationSigs()));

  const [recentExactSigs, setRecentExactSigs] = useState(() => new Set());
  const [recentItemCounts, setRecentItemCounts] = useState(() => new Map());

  const [weatherLoading, setWeatherLoading] = useState(() => !readWeatherOverride());
  const [weatherSource, setWeatherSource] = useState(() => (readWeatherOverride() ? "override" : "auto"));
  const [weatherMsg, setWeatherMsg] = useState("");
  const [weatherTempF, setWeatherTempF] = useState(null);
  const [weatherCategory, setWeatherCategory] = useState(() => readWeatherOverride() || "mild");
  const [precipCondition, setPrecipCondition] = useState("clear");
  const [dotCount, setDotCount] = useState(1);
  const [showWeatherPicker, setShowWeatherPicker] = useState(false);

  const [timeCategory, setTimeCategory] = useState(() => readTimeOverride() || timeCategoryFromDate(new Date()));
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [showOccasionPicker, setShowOccasionPicker] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showWhyDetails, setShowWhyDetails] = useState(false);
  const [showRefineControls, setShowRefineControls] = useState(false);

  const [rejectedOutfits] = useState(() => loadRejectedOutfits(user));
  const [feedbackProfile, setFeedbackProfile] = useState(() => buildFeedbackProfile(loadRecommendationFeedback(user)));

  const [aiOutfits, setAiOutfits] = useState(null);
  const [aiExplanations, setAiExplanations] = useState([]);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSource, setAiSource] = useState("local");
  const [aiRefreshToken, setAiRefreshToken] = useState(0);
  const [aiHasResolved, setAiHasResolved] = useState(false);


  useEffect(() => {
    writeRecSeed(recSeed);
  }, [recSeed]);

  useEffect(() => {
    let alive = true;

    async function loadSavedSigs() {
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
      setWeatherSource("override");
      setWeatherTempF(null);
      setWeatherCategory(override);
      setPrecipCondition("clear");
      setWeatherMsg("");
      setWeatherLoading(false);
      return;
    }

    setWeatherLoading(true);
    setWeatherSource("auto");
    setWeatherMsg("");

    const w = await getWeatherContext();
    setWeatherTempF(w.tempF);
    setWeatherCategory(w.category);
    setPrecipCondition(w.precipCondition || "clear");
    setWeatherSource(w.source || "auto");
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

  useEffect(() => {
    if (!weatherLoading) return;
    const id = window.setInterval(() => setDotCount((c) => (c % 3) + 1), 400);
    return () => window.clearInterval(id);
  }, [weatherLoading]);

  const effectiveAnswers = useMemo(() => {
    const next = { ...(answers || {}) };
    if (selectedOccasion) next.dressFor = [selectedOccasion];
    if (selectedStyle) next.style = [selectedStyle];
    return next;
  }, [answers, selectedOccasion, selectedStyle]);

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
          const dressFor = Array.isArray(effectiveAnswers?.dressFor) ? effectiveAnswers.dressFor : [];
          const style = Array.isArray(effectiveAnswers?.style) ? effectiveAnswers.style : [];

          const context = {
            weather_category: weatherCategory || "mild",
            time_category: timeCategory || "work hours",
            body_type: effectiveAnswers?.bodyType || DEFAULT_BODY_TYPE,
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
                    ...found,
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
  }, [wardrobe, weatherCategory, timeCategory, effectiveAnswers, aiRefreshToken]);

  const bodyTypeId = effectiveAnswers?.bodyType ? effectiveAnswers.bodyType : DEFAULT_BODY_TYPE;

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
        effectiveAnswers,
        savedSigs,
        rejectedOutfits,
        undefined,
        undefined,
        precipCondition,
        feedbackProfile
      ),
    [wardrobe, recSeed, bodyTypeId, recentExactSigs, recentItemCounts, weatherCategory, precipCondition, timeCategory, effectiveAnswers, savedSigs, rejectedOutfits, feedbackProfile]
  );

  const reused = useMemo(() => readReuseOutfit(), []);

  const { outfits, pairedExplanations } = useMemo(() => {
    let raw;
    let rawExplanations;

    if (reused) {
      const reusedOutfit = buildOutfitFromIds(reused.items, wardrobe);
      const rest = generatedOutfits.slice(0, 2);
      raw = [reusedOutfit, ...rest].slice(0, 3);
      rawExplanations = raw.map(() => "");
    } else if (aiOutfits && aiOutfits.length > 0) {
      const paired = aiOutfits.map((outfit, i) => ({ outfit, explanation: aiExplanations[i] || "" }));
      const filtered = paired.filter(({ outfit }) => {
        const sig = idsSignature((outfit || []).map((x) => x?.id));
        return !sig || !savedSigs.has(sig);
      });
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

    if (reused) {
      return { outfits: raw, pairedExplanations: rawExplanations };
    }

    const ranked = raw
      .map((outfit, idx) => ({
        outfit,
        explanation: rawExplanations[idx] || "",
        signature: recommendationSignature(outfit),
        score: scoreOutfitForDisplay(outfit, {
          weatherCategory,
          precipCategory: precipCondition,
          timeCategory,
          answers: effectiveAnswers,
          bodyTypeId,
          feedbackProfile,
        }),
      }))
      .sort((a, b) => {
        const aSeen = a.signature && recentRecommendationSigs.has(a.signature) ? 1 : 0;
        const bSeen = b.signature && recentRecommendationSigs.has(b.signature) ? 1 : 0;
        return (aSeen - bSeen) || (b.score - a.score);
      });

    return {
      outfits: ranked.map((entry) => entry.outfit),
      pairedExplanations: ranked.map((entry) => entry.explanation),
    };
  }, [
    generatedOutfits,
    reused,
    wardrobe,
    aiOutfits,
    aiExplanations,
    savedSigs,
    weatherCategory,
    precipCondition,
    timeCategory,
    effectiveAnswers,
    bodyTypeId,
    recentRecommendationSigs,
    feedbackProfile,
  ]);

  const [selectedIdx, setSelectedIdx] = useState(null);

  useEffect(() => {
    if (selectedIdx != null && selectedIdx >= outfits.length) {
      setSelectedIdx(null);
    setShowWhyDetails(false);
    }
  }, [outfits.length, selectedIdx]);

  const explanationText = useMemo(() => {
    if (selectedIdx == null) return "";
    if (aiSource === "ai" && !reused && pairedExplanations[selectedIdx]) {
      return pairedExplanations[selectedIdx];
    }

    const activeOutfit = outfits[selectedIdx] || outfits[0] || [];
    const text = buildExplanation({ answers: effectiveAnswers, outfit: activeOutfit, weatherCategory, precipCategory: precipCondition, timeCategory });
    const cleaned = (text || "").toString().trim();
    return cleaned || "Pick a style and an occasion in onboarding to get a personalized explanation.";
  }, [effectiveAnswers, outfits, selectedIdx, aiSource, pairedExplanations, reused, weatherCategory, precipCondition, timeCategory]);

  const explanationDetails = useMemo(() => {
    const activeOutfit = outfits[selectedIdx ?? 0] || outfits[0] || [];
    if (!activeOutfit.length) return [];

    return [
      { title: "Color Reasoning", body: buildColorReason(activeOutfit) },
      { title: "Comfort Check", body: buildComfortReason(activeOutfit, effectiveAnswers, weatherCategory) },
      { title: "Why This Works", body: buildLogicReason(activeOutfit, effectiveAnswers, weatherCategory, timeCategory) },
      { title: "Style Guidance", body: buildGuidanceReason(activeOutfit, effectiveAnswers) },
    ];
  }, [outfits, selectedIdx, effectiveAnswers, weatherCategory, timeCategory]);

  const explanationSummaryText = useMemo(() => {
    return summarizeExplanation(explanationText);
  }, [explanationText]);

  const chipText = useMemo(() => {
    const dressFor = Array.isArray(effectiveAnswers?.dressFor) ? effectiveAnswers.dressFor : [];
    return dressFor.length ? titleCase(dressFor[0]) : "Daily";
  }, [effectiveAnswers]);

  const outfitSummaries = useMemo(() => {
    return outfits.map((outfit, idx) => {
      const score = scoreOutfitForDisplay(outfit, {
        weatherCategory,
        precipCategory: precipCondition,
        timeCategory,
        answers: effectiveAnswers,
        bodyTypeId,
        feedbackProfile,
      });

      const rankLabel = idx === 0 ? "Top Match" : idx === 1 ? "Strong Pick" : "Fresh Option";
      const confidenceLabel = score >= 88 ? "Excellent" : score >= 76 ? "Strong" : score >= 64 ? "Good" : "Flexible";
      const pieces = Array.isArray(outfit) ? outfit : [];
      const hasOnePiece = pieces.some((item) => item?.is_one_piece);
      const layerCount = pieces.filter((item) => item?.layer_type).length;
      const accessoryCount = pieces.filter((item) => (item?.category || "") === "Accessories").length;
      const setIds = pieces.map((item) => (item?.set_id || "").toString().trim().toLowerCase()).filter(Boolean);
      const hasSet = setIds.some((setId) => pieces.filter((item) => ((item?.set_id || "").toString().trim().toLowerCase() === setId)).length >= 2);
      const comfortSummary = buildComfortSummary(outfit, effectiveAnswers, weatherCategory);
      const explanation = aiSource === "ai" && !reused && pairedExplanations[idx]
        ? pairedExplanations[idx]
        : buildExplanation({ answers: effectiveAnswers, outfit, weatherCategory, precipCategory: precipCondition, timeCategory });
      const explanationPreview = summarizeExplanation(explanation) || buildColorReason(outfit);

      const traits = [];
      if (hasOnePiece) traits.push("One-piece");
      if (layerCount >= 2) traits.push("Layered");
      if (hasSet) traits.push("Matched set");
      if (accessoryCount > 0) traits.push(accessoryCount === 1 ? "1 accessory" : `${accessoryCount} accessories`);
      if (!traits.length) traits.push("Balanced basics");

      return { score, rankLabel, confidenceLabel, traits, comfortSummary, explanationPreview };
    });
  }, [outfits, weatherCategory, precipCondition, timeCategory, effectiveAnswers, bodyTypeId, aiSource, reused, pairedExplanations, feedbackProfile]);

  const canRefresh = true;

  const rememberCurrentRecommendations = () => {
    const current = outfits.map((outfit) => recommendationSignature(outfit)).filter(Boolean);
    if (!current.length) return;
    setRecentRecommendationSigs((prev) => new Set(writeRecentRecommendationSigs([...prev, ...current])));
  };

  const handleRefreshRecommendation = () => {
    rememberCurrentRecommendations();
    clearReuseOutfit();
    setSelectedIdx(0);
    setRecSeed((prev) => prev + Math.floor(Math.random() * 100000) + 1);
    setAiExplanations([]);
    setAiRefreshToken((prev) => prev + 1);
  };


  const goAddItem = () => {
    sessionStorage.setItem(OPEN_ADD_ITEM_FLAG, "1");
    navigate("/wardrobe");
  };

  const openPlanModal = () => {
    if (isGuestMode) {
      setSaveMsg("Sign in to save outfit plans.");
      window.setTimeout(() => setSaveMsg(""), 2500);
      return;
    }

    const idx = selectedIdx ?? 0;
    const outfit = outfits[idx] || outfits[0] || [];
    if (!outfit.length) return;

    const date = tomorrowDateStr();

    const itemNames = outfit.map((x) => x?.name).filter(Boolean);
    const calUrl = buildGoogleCalendarUrl({ date, occasion: "", itemNames });
    window.open(calUrl, "_blank", "noopener");

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



  function outfitSignature(outfit) {
    return recommendationSignature(outfit);
  }



  async function handleSaveOutfit(outfit) {
    if (isGuestMode) {
      setSaveMsg("Sign in to save outfits.");
      window.setTimeout(() => setSaveMsg(""), 2500);
      return;
    }

    const itemIds = (outfit || []).map((x) => x?.id).filter(Boolean);
    const normalized = normalizeItems(itemIds);
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
      rememberCurrentRecommendations();
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

      if (created) {
        outfitHistoryApi.recordWorn({
          item_ids: normalized,
          source: "recommendation",
          context: {
            occasion: chipText,
            temperature_category: weatherCategory,
            temperature_f: weatherTempF,
            time_of_day: timeCategory,
          },
        }, user).catch(() => {});
      }

      if (msg) setSaveMsg(msg);
      else setSaveMsg(created ? "Saved! Refreshing recommendations..." : "This outfit is already in your saved outfits.");

      window.setTimeout(() => setSaveMsg(""), 2500);

      setAiExplanations([]);
      setAiRefreshToken((prev) => prev + 1);
    } catch (e) {
      setSaveMsg(e?.message || "Could not save outfit.");
      window.setTimeout(() => setSaveMsg(""), 2500);
    } finally {
      setSavingSig("");
    }
  }

  function handleFeedback(outfit, type) {
    saveRecommendationFeedback(outfit, type, user);
    if (type === "dislike") {
      saveRejectedOutfit(outfit, user);
    }
    setFeedbackProfile(buildFeedbackProfile(loadRecommendationFeedback(user)));
    setSaveMsg(type === "like" ? "Got it — more like this!" : "Noted — fewer like this.");
    window.setTimeout(() => setSaveMsg(""), 2000);
  }

  const timeLine = useMemo(() => {
    const t = (timeCategory || "").toString().trim();
    return t ? titleCase(t) : "Work Hours";
  }, [timeCategory]);

  const weatherPresentation = useMemo(() => {
    return buildWeatherPresentation({
      category: weatherCategory,
      tempF: weatherTempF,
      loading: weatherLoading,
      source: weatherSource,
      message: weatherMsg,
      precipCondition,
    });
  }, [weatherCategory, weatherTempF, weatherLoading, weatherSource, weatherMsg, precipCondition]);

  const applyWeatherOverride = (next) => {
    const v = (next || "").toString().trim().toLowerCase();
    if (!v) {
      setWeatherOverride(null);
      setShowWeatherPicker(false);
      loadWeather();
      return;
    }
    setWeatherOverride(v);
    setWeatherSource("override");
    setWeatherTempF(null);
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
            {!isGuestMode ? (
              <>
                <button type="button" className="dashQuickBtn" onClick={openPlanModal}>{"\u2606"} Plan Outfit</button>
                <button type="button" className="dashQuickBtn" onClick={() => navigate("/history")}>{"\u29D6"} History</button>
              </>
            ) : null}
          </div>
        </div>
        <div className="dashHeroRight">
        </div>
      </div>

      <section className="card dashWide dashWeatherCard">
        <div className="dashWeatherHud">
          <div className="dashWeatherMain">
            <span className="dashWeatherEmoji">
              {weatherPresentation.glyph}
            </span>
            <div className="dashWeatherInfo">
              <div className="dashWeatherTemp">
                {weatherLoading ? `Detecting Weather${".".repeat(dotCount)}` : weatherPresentation.headline}
              </div>
              <div className="dashWeatherLabel">
                {weatherLoading ? "" : weatherPresentation.subline}
              </div>
            </div>
          </div>

          <div className="dashRefineSummary">
            <div className="dashRefinePills">
              <span className="dashMiniPill">{weatherLoading ? `Detecting${".".repeat(dotCount)}` : weatherPresentation.status}</span>
              <span className="dashMiniPill">{timeLine}</span>
              {selectedOccasion ? <span className="dashMiniPill">{titleCase(selectedOccasion)}</span> : null}
              {selectedStyle ? <span className="dashMiniPill">{titleCase(selectedStyle)}</span> : null}
            </div>
            <button
              type="button"
              className={showRefineControls ? "dashRefineToggle active" : "dashRefineToggle"}
              onClick={() => setShowRefineControls((prev) => !prev)}
              aria-expanded={showRefineControls}
            >
              {showRefineControls ? "Hide refine controls" : "Refine outfit"}
            </button>
          </div>
        </div>

        {!weatherLoading && weatherPresentation.detail ? (
          <div className={"dashWeatherStatus" + (weatherSource === "fallback" ? " fallback" : "")}>{weatherPresentation.detail}</div>
        ) : null}

        {isGuestMode ? (
          <div className="noteBox" style={{ marginTop: 12 }}>
            Guest mode lets you upload items and generate recommendations for this session. Sign in to save outfits, plans, history, and profile details.
          </div>
        ) : null}

        {showRefineControls ? (
          <>
            <div className="dashWeatherChips">
              <button
                type="button"
                className={"dashContextChip" + (showWeatherPicker ? " active" : "")}
                onClick={() => { setShowWeatherPicker((p) => !p); setShowTimePicker(false); setShowOccasionPicker(false); setShowStylePicker(false); }}
              >
                <span className="dashContextChipIcon">{getWeatherGlyph(weatherCategory, weatherLoading)}</span>
                <span>{weatherLoading ? `Detecting${".".repeat(dotCount)}` : weatherPresentation.status}</span>
              </button>

              <button
                type="button"
                className={"dashContextChip" + (showTimePicker ? " active" : "")}
                onClick={() => { setShowTimePicker((p) => !p); setShowWeatherPicker(false); setShowOccasionPicker(false); setShowStylePicker(false); }}
              >
                <span className="dashContextChipIcon">{"\u25F7"}</span>
                <span>{timeLine}</span>
              </button>
            </div>

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

            <div className="dashPreferenceRow">
              <button
                type="button"
                className={"dashContextChip" + (showOccasionPicker ? " active" : "")}
                onClick={() => { setShowOccasionPicker((p) => !p); setShowStylePicker(false); setShowWeatherPicker(false); setShowTimePicker(false); }}
              >
                <span className="dashContextChipIcon">{String.fromCharCode(9672)}</span>
                <span>{selectedOccasion ? titleCase(selectedOccasion) : "Occasion"}</span>
              </button>

              <button
                type="button"
                className={"dashContextChip" + (showStylePicker ? " active" : "")}
                onClick={() => { setShowStylePicker((p) => !p); setShowOccasionPicker(false); setShowWeatherPicker(false); setShowTimePicker(false); }}
              >
                <span className="dashContextChipIcon">{String.fromCharCode(10022)}</span>
                <span>{selectedStyle ? titleCase(selectedStyle) : "Style"}</span>
              </button>
            </div>

            {showOccasionPicker ? (
              <div className="dashContextPicker">
                {OCCASION_OPTIONS.map((val) => {
                  const isActive = val === selectedOccasion;
                  const label = val ? titleCase(val) : "From Onboarding";
                  return (
                    <button
                      key={val || "default"}
                      type="button"
                      className={"dashContextPickerBtn" + (isActive ? " active" : "")}
                      onClick={() => { setSelectedOccasion(val); setShowOccasionPicker(false); }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {showStylePicker ? (
              <div className="dashContextPicker">
                {STYLE_OPTIONS.map((val) => {
                  const isActive = val === selectedStyle;
                  const label = val ? titleCase(val) : "From Onboarding";
                  return (
                    <button
                      key={val || "default"}
                      type="button"
                      className={"dashContextPickerBtn" + (isActive ? " active" : "")}
                      onClick={() => { setSelectedStyle(val); setShowStylePicker(false); }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="card dashWide dashRecCard">
        <div className="dashRecHeader">
          <ErrorBoundary fallback={null}><MeshGradient className="dashRecHeaderGradient" /></ErrorBoundary>
          <div className="dashRecHeaderLeft">
            <div className="dashRecTitle">Today's Recommendation</div>
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
              <div className="dashEmptyTitle">Your wardrobe is ready for its first look</div>
              <div className="dashEmptySub">Add a few tops, bottoms, or shoes and FitGPT will start building outfit recommendations for you.</div>
              <div className="dashEmptyActions">
                <button className="btn primary" type="button" onClick={() => navigate("/wardrobe")}>
                  Add clothing items
                </button>
                <button className="btn" type="button" onClick={() => navigate("/wardrobe")}>
                  Open wardrobe
                </button>
              </div>
            </div>
          ) : outfits.map((outfit, idx) => {
            const sig = outfitSignature(outfit);
            const isSaved = savedSigs.has(sig);
            const disabled = !sig || savingSig === sig;
            const label = isGuestMode ? "Sign in to save" : isSaved ? "Unsave" : savingSig === sig ? "Saving..." : "Save";
            const summary = outfitSummaries[idx] || { score: 0, rankLabel: "Option", confidenceLabel: "Flexible", traits: [] };

            return (
              <div
                key={`opt_${idx}`}
                className={"dashOutfitOption" + (idx === selectedIdx ? " dashOutfitSelected" : "")}
                style={{ animationDelay: `${idx * 120}ms`, marginTop: idx === 0 ? 0 : 18, cursor: "pointer" }}
                onClick={() => { setSelectedIdx(idx); setShowWhyDetails(false); }}
              >
                <div className="dashOptionTopRow">
                  <div className="optionLabel">
                    <span className="optionLabelNum">{String(idx + 1).padStart(2, "0")}</span>
                    <span className="optionLabelSlash">{"//"}</span>
                    <span className="optionLabelText">OPTION</span>
                  </div>

                  <div className="dashOptionMeta">
                    <div className="dashOptionScore">
                      <span className="dashOptionScoreValue">{summary.score}</span>
                      <span className="dashOptionScoreLabel">match</span>
                    </div>

                    <div className="dashOptionRankGroup">
                      <span className="dashOptionRank">{summary.rankLabel}</span>
                      <span className="dashOptionConfidence">{summary.confidenceLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="dashOptionTraits">
                  {summary.traits.map((trait) => (
                    <span key={`${idx}-${trait}`} className="dashOptionTrait">{trait}</span>
                  ))}
                </div>

                {summary.comfortSummary ? (
                  <div className="dashComfortStrip">
                    <span className="dashComfortBadge">{summary.comfortSummary.badge}</span>
                    <span className="dashComfortText">{summary.comfortSummary.note}</span>
                  </div>
                ) : null}

                <div className="dashOutfitGridFigma">
                  {outfit.map((item, itemIdx) => (
                    <div
                      key={item.id}
                      className={"dashSquareTile dashTileReveal" + (normalizeCategory(item?.category) === "Accessories" ? " accessory" : "")}
                      style={{ animationDelay: `${itemIdx * 90 + idx * 140}ms` }}
                      onPointerMove={onTiltMove}
                      onPointerLeave={onTiltLeave}
                    >
                      <div className="dashSquareRole">{outfitRoleLabel(item)}</div>
                      {idx === selectedIdx ? (
                        <ErrorBoundary fallback={item.image_url ? <img className="dashSquareImg" src={item.image_url} alt={item.name} /> : <div className="dashSquareImg" aria-hidden="true" />}><ClothCard key={clothCardKey(outfit, item, aiRefreshToken, recSeed)} imageUrl={item.image_url} className="dashSquareImg" /></ErrorBoundary>
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
                    <div className="dashFeedbackBtns">
                      <button type="button" className="dashFeedbackBtn dashFeedbackLike" onClick={() => handleFeedback(outfit, "like")} title="More like this">&#x25B2;</button>
                      <button type="button" className="dashFeedbackBtn dashFeedbackDislike" onClick={() => handleFeedback(outfit, "dislike")} title="Less like this">&#x25BC;</button>
                    </div>
                  </div>
                </div>

                <div className="dashOptionReason">
                  <div className="dashOptionReasonHead">
                    <div className="dashOptionReasonLabel">Why this works</div>
                    <div className="dashOptionReasonHint">Quick summary</div>
                  </div>
                  <div className="dashOptionReasonText">{summary.explanationPreview}</div>
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
          <div className="dashWhyHeader">
            <div className="dashWhyHeaderCopy">
              <div className="dashWhyEyebrow">Selected outfit breakdown</div>
              <div className="dashInfoTitle">
                Option {String(selectedIdx + 1).padStart(2, "0")} breakdown
                {aiSource === "ai" && !reused ? <span className="dashAiBadge">AI Powered Suggestion</span> : null}
              </div>
              <div className="dashWhyIntro">
                Start with the short explanation below, then open the full breakdown for color, comfort, and styling details.
              </div>
            </div>
            <div className="dashWhyActions">
              <button type="button" className="dashWhyToggle" onClick={() => setShowWhyDetails((prev) => !prev)}>
                {showWhyDetails ? "Hide full breakdown" : "Show full breakdown"}
                <span className={showWhyDetails ? "dashWhyToggleIcon open" : "dashWhyToggleIcon"}>v</span>
              </button>
              <button type="button" className="dashWhyClose" onClick={() => { setSelectedIdx(null); setShowWhyDetails(false); }} aria-label="Close explanation">
                x
              </button>
            </div>
          </div>
          {aiLoading ? (
            <div className="dashAiLoading">Thinking...</div>
          ) : (
            <div className="dashWhyContent">
              <div className="dashWhyLead">
                <span key={`${selectedIdx}-${aiRefreshToken}-${recSeed}`} className="dashAiReveal">
                  {(explanationSummaryText || explanationText).split(" ").map((word, i) => (
                    <React.Fragment key={i}>
                      <span className="dashAiWord" style={{ animationDelay: `${i * 28}ms` }}>
                        {word}
                      </span>{" "}
                    </React.Fragment>
                  ))}
                </span>
              </div>

              {showWhyDetails ? (
                <div className="dashWhyGrid">
                  {explanationDetails.map((detail) => (
                    <div key={detail.title} className="dashWhyCard">
                      <div className="dashWhyCardTitle">{detail.title}</div>
                      <div className="dashWhyCardText">{detail.body}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>,
        document.body
      )}

    </div>
  );

}
