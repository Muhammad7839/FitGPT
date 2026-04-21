import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { useTheme } from "../App";
import { savedOutfitsApi } from "../api/savedOutfitsApi";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import { wardrobeApi } from "../api/wardrobeApi";
import useWardrobe from "../hooks/useWardrobe";
import { fetchAIRecommendations } from "../api/recommendationsApi";
import { submitRecommendationFeedback } from "../api/recommendationFeedbackApi";
import { readAccessibilityPrefs, adaptAiText, effectiveAccessibilityPrefs } from "../utils/accessibilityPrefs";
import { plannedOutfitsApi } from "../api/plannedOutfitsApi";
import MannequinViewer from "./MannequinViewer";
import MeshGradient from "./MeshGradient";
import ErrorBoundary from "./ErrorBoundary";
import WardrobeGapPanel from "./WardrobeGapPanel";
import WardrobeRotationPanel from "./WardrobeRotationPanel";
import OutfitMannequinPreview from "./OutfitMannequinPreview";
import {
  OPEN_ADD_ITEM_FLAG,
  REUSE_OUTFIT_KEY,
  CURRENT_RECS_KEY,
  EVT_OUTFIT_HISTORY_CHANGED,
  EVT_RECOMMENDATION_FEEDBACK_CHANGED,
  EVT_RECOMMENDATION_PERSONALIZATION_CHANGED,
  EVT_ACCESSIBILITY_CHANGED,
  UNDERUSED_ALERTS_KEY,
} from "../utils/constants";
import {
  writeRecSeed,
  readTimeOverride,
  writeTimeOverride,
  readWeatherOverride,
  setWeatherOverride,
  makeObjectStore,
  readSeasonalMode,
  writeSeasonalMode,
  saveWardrobe,
  mergeWardrobeWithLocalMetadata,
  loadRejectedOutfits,
  saveRejectedOutfit,
  loadRecommendationFeedback,
  saveRecommendationFeedback,
} from "../utils/userStorage";
import { safeParse, formatToday, normalizeFitTag, normalizeItems, buildGoogleCalendarUrl, onTiltMove, onTiltLeave, tomorrowDateStr } from "../utils/helpers";
import { getWeatherContext } from "../api/weatherApi";
import { analyzeWardrobeGaps } from "../utils/wardrobeGapInsights";
import { analyzeWardrobeRotation } from "../utils/wardrobeRotationInsights";
import { getCurrentSeason, getSeasonLabel, getSeasonalWardrobeLabel, hasSeasonalMetadata } from "../utils/seasonalWardrobe";
import {
  readRotationAlertPreferences,
} from "../utils/rotationAlertPreferences";
import {
  titleCase, normalizeCategory, normalizeColorName, colorToCss,
  timeCategoryFromDate,
  generateThreeOutfits, idsSignature, makeRecentSets,
  buildExplanation, buildOutfitFromIds, scoreOutfitForDisplay, computeOutfitConfidence,
  analyzeOutfitColors, colorInfo, buildPersonalizationProfile,
} from "../utils/recommendationEngine";
import {
  shouldShowPrompt, recordVisit, recordPromptShown,
  recordPromptEngaged, recordPromptDismissed,
} from "../utils/feedbackPrompts";
import {
  FEEDBACK_REASON_OPTIONS,
  FEEDBACK_SIGNALS,
  buildRecommendationFeedbackPayload,
  buildRecommendationFeedbackProfile,
  getRecommendationFeedback,
  readRecommendationFeedback,
  restoreRecommendationFeedback,
  upsertRecommendationFeedback,
} from "../utils/recommendationFeedback";
import {
  PERSONALIZATION_ACTIONS,
  buildRecommendationPersonalizationProfile,
  describeRecommendationPersonalization,
  readRecommendationPersonalization,
  trackRecommendationPersonalization,
} from "../utils/recommendationPersonalization";
import STYLE_TIPS from "../utils/styleTips";

const DEFAULT_BODY_TYPE = "rectangle";
const OCCASION_OPTIONS = ["", "casual", "work", "formal", "athletic", "social", "lounge"];
const STYLE_OPTIONS = ["", "casual", "formal", "smart casual", "relaxed", "lounge", "activewear", "social", "work"];
const RECENT_RECOMMENDATION_SIGS_KEY = "fitgpt_recent_recommendation_sigs_v1";
const FEEDBACK_PROMPT_SESSION_KEY = "fitgpt_feedback_prompt_session_v1";
const FEEDBACK_PROMPT_DELAY_MS = 1400;
const FEEDBACK_PROMPT_FADE_MS = 9000;
const MAX_FEEDBACK_PROMPTS_PER_SESSION = 2;
const FEEDBACK_NOTICE_MS = 4800;
const REJECT_PENDING_MESSAGE = "Removing outfit...";
const REJECT_SUCCESS_MESSAGE = "Outfit removed from your recommendations.";
const dismissedUnderusedAlertsStore = makeObjectStore(UNDERUSED_ALERTS_KEY);

function recommendationSignature(outfit) {
  return idsSignature((Array.isArray(outfit) ? outfit : []).map((item) => item?.id));
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

function readFeedbackPromptSession() {
  const raw = sessionStorage.getItem(FEEDBACK_PROMPT_SESSION_KEY);
  const parsed = raw ? safeParse(raw) : null;
  const shownSignatures = Array.isArray(parsed?.shownSignatures)
    ? [...new Set(parsed.shownSignatures.map((value) => (value || "").toString().trim()).filter(Boolean))]
    : [];

  return {
    shownSignatures,
    shownCount: Math.max(0, Number(parsed?.shownCount) || shownSignatures.length),
  };
}

function writeFeedbackPromptSession(next) {
  const safeNext = {
    shownSignatures: [...new Set((Array.isArray(next?.shownSignatures) ? next.shownSignatures : []).map((value) => (value || "").toString().trim()).filter(Boolean))],
    shownCount: Math.max(0, Number(next?.shownCount) || 0),
  };
  sessionStorage.setItem(FEEDBACK_PROMPT_SESSION_KEY, JSON.stringify(safeNext));
  return safeNext;
}

function uniqueRecommendationEntries(entries) {
  const seen = new Set();

  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const signature = (entry?.signature || recommendationSignature(entry?.outfit) || "").toString().trim();

    if (signature) {
      if (seen.has(signature)) return false;
      seen.add(signature);
    }

    return Array.isArray(entry?.outfit) && entry.outfit.length > 0;
  });
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
    detail: "",
  };
}

function feedbackSummaryText(entry) {
  if (!entry) return "Optional feedback helps future picks feel more personal.";
  if (entry.signal === FEEDBACK_SIGNALS.LIKE) {
    return entry.detailCode ? "Liked with extra detail saved." : "Saved as a preference.";
  }
  if (entry.signal === FEEDBACK_SIGNALS.DISLIKE) {
    return entry.detailCode ? "Not for you, with extra detail saved." : "Saved as not for you.";
  }
  return "Skipped for now.";
}

function feedbackBadgeText(signal) {
  if (signal === FEEDBACK_SIGNALS.LIKE) return "Liked";
  if (signal === FEEDBACK_SIGNALS.DISLIKE) return "Not for me";
  if (signal === FEEDBACK_SIGNALS.SKIP) return "Skipped";
  return "";
}

function feedbackNoticeText(signal) {
  if (signal === FEEDBACK_SIGNALS.LIKE) return "We’ll lean into looks like this next time.";
  if (signal === FEEDBACK_SIGNALS.DISLIKE) return "We’ll tone down similar looks over time.";
  return "We’ll treat this as a pass and keep exploring.";
}

function rejectSyncErrorText() {
  return `${REJECT_SUCCESS_MESSAGE} We couldn't sync that rejection right now.`;
}

// ── Editorial mode helpers ─────────────────────────────────────────
// Used only when the "editorial" theme is active. Keep these data-only
// (no JSX) so they stay easy to test and don't pull React in.

function editorialDayName(date) {
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function buildEditorialHeadline({ count, tempF, day }) {
  const ways = count >= 3 ? "Three" : count === 2 ? "Two" : count === 1 ? "One" : "No";
  const wayLabel = count === 1 ? "way" : "ways";
  if (count === 0) {
    return { before: `No outfits for a ${day}.`, temp: "", after: "" };
  }
  if (Number.isFinite(tempF)) {
    return {
      before: `${ways} ${wayLabel} to dress for a `,
      temp: `${Math.round(tempF)}\u00B0`,
      after: ` ${day}.`,
    };
  }
  return { before: `${ways} ${wayLabel} to dress for a ${day}.`, temp: "", after: "" };
}

function buildClosetGapInsight(wardrobe) {
  const active = (wardrobe || []).filter((item) => !item?.is_archived);
  const counts = { Tops: 0, Bottoms: 0, Shoes: 0, Outerwear: 0, Accessories: 0 };
  for (const item of active) {
    const cat = normalizeCategory(item?.category);
    if (counts[cat] != null) counts[cat] += 1;
  }
  const order = ["Outerwear", "Tops", "Bottoms", "Shoes", "Accessories"];
  const missing = order.find((c) => counts[c] === 0);
  if (missing) return { headline: `Add ${missing.toLowerCase()}`, sub: "Empty category in your closet" };
  const lowest = order.reduce((acc, c) => (counts[c] < counts[acc] ? c : acc), order[0]);
  if (counts[lowest] <= 2) return { headline: `Light on ${lowest.toLowerCase()}`, sub: `Only ${counts[lowest]} in rotation` };
  return { headline: "Balanced closet", sub: "Every category is covered" };
}

function buildRotationInsight(historyEntries) {
  const list = Array.isArray(historyEntries) ? historyEntries : [];
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const recent = list.filter((entry) => {
    const ts = entry?.worn_at || entry?.created_at;
    if (!ts) return false;
    const d = new Date(ts);
    return !Number.isNaN(d.getTime()) && d >= monthAgo;
  });
  if (recent.length === 0) return { headline: "Quiet month", sub: "Log an outfit to start the count" };
  return {
    headline: `${recent.length} outfit${recent.length === 1 ? "" : "s"} worn`,
    sub: "In the last 30 days",
  };
}

function buildTomorrowInsight(plannedOutfits) {
  const list = Array.isArray(plannedOutfits) ? plannedOutfits : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = list
    .filter((p) => {
      const d = p?.planned_date ? new Date(p.planned_date) : null;
      return d && !Number.isNaN(d.getTime()) && d >= today;
    })
    .sort((a, b) => new Date(a.planned_date) - new Date(b.planned_date));
  const next = future[0];
  if (!next) return { headline: "Nothing planned", sub: "Plan an outfit from the dashboard" };
  const when = new Date(next.planned_date);
  const isToday = when.getTime() === today.getTime();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = when.getTime() === tomorrow.getTime();
  const label = isToday ? "Today" : isTomorrow ? "Tomorrow" : when.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return {
    headline: label,
    sub: next.occasion ? titleCase(next.occasion) : "Outfit planned",
  };
}

function pickEditorialHeroImage(outfit) {
  const list = Array.isArray(outfit) ? outfit : [];
  const withImg = list.find((item) => item?.image_url);
  return withImg?.image_url || null;
}

export default function Dashboard({ answers, onResetOnboarding = () => {} }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme() || {};
  const isEditorial = theme?.id === "editorial";
  const isGuestMode = !user;

  const wardrobe = useWardrobe(user);
  const [recSeed, setRecSeed] = useState(() => Date.now());

  const [saveMsg, setSaveMsg] = useState("");
  const [savingSig, setSavingSig] = useState("");
  const [savedSigs, setSavedSigs] = useState(() => new Set());
  const [savedOutfitEntries, setSavedOutfitEntries] = useState([]);
  const [recentRecommendationSigs, setRecentRecommendationSigs] = useState(() => new Set(readRecentRecommendationSigs()));
  const [recommendationFeedback, setRecommendationFeedback] = useState(() => readRecommendationFeedback(user));
  const [recommendationPersonalization, setRecommendationPersonalization] = useState(() => readRecommendationPersonalization(user));
  const [feedbackPendingSig, setFeedbackPendingSig] = useState("");
  const [feedbackComposer, setFeedbackComposer] = useState(null);
  const [feedbackNotice, setFeedbackNotice] = useState(null);
  const [feedbackPromptSig, setFeedbackPromptSig] = useState("");
  const feedbackNoticeTimerRef = useRef(null);
  const feedbackPromptTimerRef = useRef(null);
  const feedbackPromptFadeTimerRef = useRef(null);

  const [historyEntries, setHistoryEntries] = useState([]);
  const [dismissedRotationAlerts, setDismissedRotationAlerts] = useState({});
  const [rotationPreferences, setRotationPreferences] = useState(() => readRotationAlertPreferences(user));
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
  const [seasonalMode, setSeasonalMode] = useState(() => readSeasonalMode(user));
  const [showWhyDetails, setShowWhyDetails] = useState(false);
  const [showRefineControls, setShowRefineControls] = useState(false);
  const [refreshWardrobeSnapshot, setRefreshWardrobeSnapshot] = useState(null);

  const [rejectedOutfits] = useState(() => loadRejectedOutfits(user));
  const [editorialPlanned, setEditorialPlanned] = useState([]);
  const [legacyPreferenceProfile, setLegacyPreferenceProfile] = useState(null);

  /* Build personalization profile from all signals once history + saved are loaded */
  useEffect(() => {
    let alive = true;
    async function loadProfile() {
      const [histRes, savedRes] = await Promise.all([
        outfitHistoryApi.listHistory(user).catch(() => ({ history: [] })),
        savedOutfitsApi.listSaved(user).catch(() => ({ saved_outfits: [] })),
      ]);
      if (!alive) return;
      const feedback = loadRecommendationFeedback(user);
      const history = Array.isArray(histRes?.history) ? histRes.history : [];
      const saved = Array.isArray(savedRes?.saved_outfits) ? savedRes.saved_outfits : [];
      setLegacyPreferenceProfile(buildPersonalizationProfile(feedback, history, saved, wardrobe));
    }
    loadProfile();
    return () => { alive = false; };
  }, [user, wardrobe]);

  const [nudge, setNudge] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const nudgeTimerRef = useRef(null);

  useEffect(() => { recordVisit(user); }, [user]);

  // Editorial mode: load planned outfits for the "Tomorrow" insight card.
  // Only fires when the editorial theme is active so we don't pay for it
  // on every dashboard mount.
  useEffect(() => {
    if (!isEditorial) return;
    let alive = true;
    plannedOutfitsApi.listPlanned(user).then((res) => {
      if (!alive) return;
      setEditorialPlanned(Array.isArray(res?.planned_outfits) ? res.planned_outfits : []);
    }).catch(() => { if (alive) setEditorialPlanned([]); });
    return () => { alive = false; };
  }, [isEditorial, user]);

  const [aiOutfits, setAiOutfits] = useState(null);
  const [aiExplanations, setAiExplanations] = useState([]);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSource, setAiSource] = useState("local");
  const [aiRefreshToken, setAiRefreshToken] = useState(0);
  const [aiHasResolved, setAiHasResolved] = useState(false);
  const [gapLoading, setGapLoading] = useState(true);
  const [gapAnalysis, setGapAnalysis] = useState(() => ({
    gaps: [],
    summaryTitle: "Analyzing your wardrobe...",
    summaryText: "",
    checkedItems: 0,
  }));
  const currentSeason = useMemo(() => getCurrentSeason(), []);
  const currentSeasonLabel = useMemo(() => getSeasonLabel(currentSeason), [currentSeason]);
  const seasonalWardrobeLabel = useMemo(() => getSeasonalWardrobeLabel(currentSeason), [currentSeason]);
  const hasSeasonTags = useMemo(() => hasSeasonalMetadata(wardrobe), [wardrobe]);


  useEffect(() => {
    writeRecSeed(recSeed);
  }, [recSeed]);

  useEffect(() => {
    setSeasonalMode(readSeasonalMode(user));
  }, [user]);

  useEffect(() => {
    setRecommendationFeedback(readRecommendationFeedback(user));
    setRecommendationPersonalization(readRecommendationPersonalization(user));
    setFeedbackPendingSig("");
    setFeedbackComposer(null);
    setFeedbackNotice(null);
    setFeedbackPromptSig("");
  }, [user]);

  useEffect(() => {
    const syncFeedback = () => {
      setRecommendationFeedback(readRecommendationFeedback(user));
    };

    window.addEventListener(EVT_RECOMMENDATION_FEEDBACK_CHANGED, syncFeedback);
    return () => {
      window.removeEventListener(EVT_RECOMMENDATION_FEEDBACK_CHANGED, syncFeedback);
    };
  }, [user]);

  useEffect(() => {
    const syncPersonalization = () => {
      setRecommendationPersonalization(readRecommendationPersonalization(user));
    };

    window.addEventListener(EVT_RECOMMENDATION_PERSONALIZATION_CHANGED, syncPersonalization);
    return () => {
      window.removeEventListener(EVT_RECOMMENDATION_PERSONALIZATION_CHANGED, syncPersonalization);
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (feedbackNoticeTimerRef.current) {
        window.clearTimeout(feedbackNoticeTimerRef.current);
      }
      if (feedbackPromptTimerRef.current) {
        window.clearTimeout(feedbackPromptTimerRef.current);
      }
      if (feedbackPromptFadeTimerRef.current) {
        window.clearTimeout(feedbackPromptFadeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadSavedSigs() {
      try {
        const res = await savedOutfitsApi.listSaved(user);
        const list = Array.isArray(res?.saved_outfits) ? res.saved_outfits : [];

        const sigs = new Set(list.map((o) => (o?.outfit_signature || "").toString().trim()).filter(Boolean));

        if (alive) {
          setSavedSigs(sigs);
          setSavedOutfitEntries(list);
        }
      } catch {
        if (alive) {
          setSavedSigs(new Set());
          setSavedOutfitEntries([]);
        }
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

        if (!alive) return;
        syncHistoryState(list);
      } catch {
        if (!alive) return;
        syncHistoryState([]);
      }
    }

    loadRecentHistory();

    const onHistoryChanged = () => {
      loadRecentHistory();
    };
    window.addEventListener(EVT_OUTFIT_HISTORY_CHANGED, onHistoryChanged);

    return () => {
      alive = false;
      window.removeEventListener(EVT_OUTFIT_HISTORY_CHANGED, onHistoryChanged);
    };
  }, [user]);

  useEffect(() => {
    setDismissedRotationAlerts(dismissedUnderusedAlertsStore.read(user));
  }, [user]);

  useEffect(() => {
    setRefreshWardrobeSnapshot(null);
  }, [wardrobe]);

  useEffect(() => {
    setRotationPreferences(readRotationAlertPreferences(user));
  }, [user]);

  const feedbackProfile = useMemo(
    () => buildRecommendationFeedbackProfile(recommendationFeedback),
    [recommendationFeedback]
  );

  const rejectedRecommendationSigs = useMemo(
    () => new Set(
      Object.values(recommendationFeedback?.entriesBySignature || {})
        .filter((entry) => entry?.signal === FEEDBACK_SIGNALS.DISLIKE)
        .map((entry) => (entry?.signature || "").toString().trim())
        .filter(Boolean)
    ),
    [recommendationFeedback]
  );

  const personalizationProfile = useMemo(
    () => buildRecommendationPersonalizationProfile({
      interactionState: recommendationPersonalization,
      savedOutfits: savedOutfitEntries,
      historyEntries,
      wardrobe,
    }),
    [recommendationPersonalization, savedOutfitEntries, historyEntries, wardrobe]
  );

  const explicitFeedbackCount = useMemo(
    () => Object.values(recommendationFeedback?.entriesBySignature || {}).filter((entry) => entry?.signal !== FEEDBACK_SIGNALS.SKIP).length,
    [recommendationFeedback]
  );

  const recommendationWardrobe = useMemo(
    () => (Array.isArray(refreshWardrobeSnapshot) && refreshWardrobeSnapshot.length ? refreshWardrobeSnapshot : wardrobe),
    [refreshWardrobeSnapshot, wardrobe]
  );

  const personalizationSummary = useMemo(
    () => describeRecommendationPersonalization(personalizationProfile, explicitFeedbackCount),
    [personalizationProfile, explicitFeedbackCount]
  );

  function syncHistoryState(nextList) {
    const sorted = [...(Array.isArray(nextList) ? nextList : [])].sort((a, b) => {
      const da = (a?.worn_at || "").toString();
      const db = (b?.worn_at || "").toString();
      return db.localeCompare(da);
    });

    const recentSets = makeRecentSets(sorted);
    setHistoryEntries(sorted);
    setRecentExactSigs(recentSets.sigs);
    setRecentItemCounts(recentSets.itemCounts);
  }

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
        const active = (Array.isArray(recommendationWardrobe) ? recommendationWardrobe : []).filter(
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
            current_season: currentSeason,
            seasonal_mode: seasonalMode,
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
  }, [recommendationWardrobe, weatherCategory, timeCategory, effectiveAnswers, aiRefreshToken, currentSeason, seasonalMode]);

  const bodyTypeId = effectiveAnswers?.bodyType ? effectiveAnswers.bodyType : DEFAULT_BODY_TYPE;

  const generatedOutfits = useMemo(
    () =>
      generateThreeOutfits(
        recommendationWardrobe,
        recSeed,
        bodyTypeId,
        recentExactSigs,
        recentItemCounts,
        weatherCategory,
        timeCategory,
        effectiveAnswers,
        savedSigs,
        {
          selectedSeason: currentSeason,
          seasonalMode,
          feedbackProfile,
          personalizationProfile,
          rejectedOutfits,
          precipCat: precipCondition,
          limit: 9,
        }
      ),
    [recommendationWardrobe, recSeed, bodyTypeId, recentExactSigs, recentItemCounts, weatherCategory, precipCondition, timeCategory, effectiveAnswers, savedSigs, currentSeason, seasonalMode, feedbackProfile, personalizationProfile, rejectedOutfits]
  );

  const reused = useMemo(() => readReuseOutfit(), []);

  const { outfits, pairedExplanations } = useMemo(() => {
    const localEntries = (Array.isArray(generatedOutfits) ? generatedOutfits : []).map((outfit) => ({
      outfit,
      explanation: "",
      signature: recommendationSignature(outfit),
      allowSaved: false,
    }));

    let candidateEntries;

    if (reused) {
      const reusedOutfit = buildOutfitFromIds(reused.items, wardrobe);
      candidateEntries = [
        {
          outfit: reusedOutfit,
          explanation: "",
          signature: recommendationSignature(reusedOutfit),
          allowSaved: true,
        },
        ...localEntries,
      ];
    } else if (aiOutfits && aiOutfits.length > 0) {
      const aiEntries = aiOutfits.map((outfit, idx) => ({
        outfit,
        explanation: aiExplanations[idx] || "",
        signature: recommendationSignature(outfit),
        allowSaved: false,
      }));
      candidateEntries = [...aiEntries, ...localEntries];
    } else {
      candidateEntries = localEntries;
    }

    const ranked = uniqueRecommendationEntries(candidateEntries)
      .filter((entry) => {
        if (!entry.signature) return true;
        if (rejectedRecommendationSigs.has(entry.signature)) return false;
        if (entry.allowSaved) return true;
        return !savedSigs.has(entry.signature);
      })
      .map((entry) => ({
        ...entry,
        score: scoreOutfitForDisplay(entry.outfit, {
          weatherCategory,
          precipCategory: precipCondition,
          timeCategory,
          answers: effectiveAnswers,
          bodyTypeId,
          selectedSeason: currentSeason,
          seasonalMode,
          feedbackProfile,
          personalizationProfile,
        }),
      }))
      .sort((a, b) => {
        const aSeen = a.signature && recentRecommendationSigs.has(a.signature) ? 1 : 0;
        const bSeen = b.signature && recentRecommendationSigs.has(b.signature) ? 1 : 0;
        return (aSeen - bSeen) || (b.score - a.score);
      })
      .slice(0, 3);

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
    rejectedRecommendationSigs,
    currentSeason,
    seasonalMode,
    feedbackProfile,
    personalizationProfile,
  ]);

  const [selectedIdx, setSelectedIdx] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [accessibilityPrefs, setAccessibilityPrefs] = useState(() => readAccessibilityPrefs(user));

  useEffect(() => {
    setAccessibilityPrefs(readAccessibilityPrefs(user));
    const onChange = () => setAccessibilityPrefs(readAccessibilityPrefs(user));
    window.addEventListener(EVT_ACCESSIBILITY_CHANGED, onChange);
    return () => window.removeEventListener(EVT_ACCESSIBILITY_CHANGED, onChange);
  }, [user]);

  const effectivePrefs = useMemo(
    () => effectiveAccessibilityPrefs(accessibilityPrefs, theme),
    [accessibilityPrefs, theme]
  );
  const [mannequinPreview, setMannequinPreview] = useState(null);

  useEffect(() => {
    if (selectedIdx != null && selectedIdx >= outfits.length) {
      setSelectedIdx(null);
    setShowWhyDetails(false);
    }
  }, [outfits.length, selectedIdx]);

  /* Show nudge after sustained engagement with selected outfit */
  useEffect(() => {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    setNudge(null);
    if (selectedIdx == null) return;
    nudgeTimerRef.current = setTimeout(() => {
      const result = shouldShowPrompt(user, { refreshCount, engagementSec: 3 });
      if (result.show) {
        setNudge(result);
        recordPromptShown(user, result.type);
      }
    }, 3000);
    return () => { if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current); };
  }, [selectedIdx, user, refreshCount]);
  useEffect(() => {
    if (feedbackPromptTimerRef.current) {
      window.clearTimeout(feedbackPromptTimerRef.current);
      feedbackPromptTimerRef.current = null;
    }
    if (feedbackPromptFadeTimerRef.current) {
      window.clearTimeout(feedbackPromptFadeTimerRef.current);
      feedbackPromptFadeTimerRef.current = null;
    }

    if (!aiHasResolved || !outfits.length) {
      setFeedbackPromptSig("");
      return;
    }

    const activeOutfit = outfits[selectedIdx ?? 0] || [];
    const signature = outfitSignature(activeOutfit);
    if (!signature || getRecommendationFeedback(recommendationFeedback, signature)) {
      setFeedbackPromptSig("");
      return;
    }

    const session = readFeedbackPromptSession();
    if (session.shownCount >= MAX_FEEDBACK_PROMPTS_PER_SESSION || session.shownSignatures.includes(signature)) {
      setFeedbackPromptSig("");
      return;
    }

    feedbackPromptTimerRef.current = window.setTimeout(() => {
      setFeedbackPromptSig(signature);
      writeFeedbackPromptSession({
        shownSignatures: [...session.shownSignatures, signature],
        shownCount: session.shownCount + 1,
      });
      feedbackPromptFadeTimerRef.current = window.setTimeout(() => {
        setFeedbackPromptSig((prev) => (prev === signature ? "" : prev));
        feedbackPromptFadeTimerRef.current = null;
      }, FEEDBACK_PROMPT_FADE_MS);
      feedbackPromptTimerRef.current = null;
    }, FEEDBACK_PROMPT_DELAY_MS);

    return () => {
      if (feedbackPromptTimerRef.current) {
        window.clearTimeout(feedbackPromptTimerRef.current);
        feedbackPromptTimerRef.current = null;
      }
      if (feedbackPromptFadeTimerRef.current) {
        window.clearTimeout(feedbackPromptFadeTimerRef.current);
        feedbackPromptFadeTimerRef.current = null;
      }
    };
  }, [aiHasResolved, outfits, selectedIdx, recommendationFeedback]);

  const explanationText = useMemo(() => {
    if (selectedIdx == null) return "";
    if (aiSource === "ai" && !reused && pairedExplanations[selectedIdx]) {
      return pairedExplanations[selectedIdx];
    }

    const activeOutfit = outfits[selectedIdx] || outfits[0] || [];
    const text = buildExplanation({ answers: effectiveAnswers, outfit: activeOutfit, weatherCategory, precipCategory: precipCondition, timeCategory, outfitIndex: selectedIdx ?? 0 });
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
      const confidence = computeOutfitConfidence(outfit, {
        weatherCategory,
        precipCategory: precipCondition,
        timeCategory,
        answers: effectiveAnswers,
        bodyTypeId,
        feedbackProfile,
        recentSigs: recentRecommendationSigs,
      });
      const score = confidence.score;

      const rankLabel = idx === 0 ? "Top Match" : idx === 1 ? "Strong Pick" : "Fresh Option";
      const LEVEL_LABELS = { excellent: "Excellent", strong: "Strong", good: "Good", fair: "Fair", low: "Flexible", none: "—" };
      const confidenceLabel = LEVEL_LABELS[confidence.level] || "Good";
      const pieces = Array.isArray(outfit) ? outfit : [];
      const hasOnePiece = pieces.some((item) => item?.is_one_piece);
      const layerCount = pieces.filter((item) => item?.layer_type).length;
      const accessoryCount = pieces.filter((item) => (item?.category || "") === "Accessories").length;
      const setIds = pieces.map((item) => (item?.set_id || "").toString().trim().toLowerCase()).filter(Boolean);
      const hasSet = setIds.some((setId) => pieces.filter((item) => ((item?.set_id || "").toString().trim().toLowerCase() === setId)).length >= 2);
      const comfortSummary = buildComfortSummary(outfit, effectiveAnswers, weatherCategory);
      const explanation = aiSource === "ai" && !reused && pairedExplanations[idx]
        ? pairedExplanations[idx]
        : buildExplanation({ answers: effectiveAnswers, outfit, weatherCategory, precipCategory: precipCondition, timeCategory, outfitIndex: idx });
      const explanationPreview = summarizeExplanation(explanation) || buildColorReason(outfit);

      const traits = [];
      if (hasOnePiece) traits.push("One-piece");
      if (layerCount >= 2) traits.push("Layered");
      if (hasSet) traits.push("Matched set");
      if (accessoryCount > 0) traits.push(accessoryCount === 1 ? "1 accessory" : `${accessoryCount} accessories`);
      if (!traits.length) traits.push("Balanced basics");

      return { score, rankLabel, confidenceLabel, confidence, traits, comfortSummary, explanationPreview };
    });
  }, [outfits, weatherCategory, precipCondition, timeCategory, effectiveAnswers, bodyTypeId, aiSource, reused, pairedExplanations, feedbackProfile, recentRecommendationSigs]);

  // Persist current recommendations so the chatbot can reference them
  useEffect(() => {
    if (!outfits.length) return;
    try {
      const summary = outfits.map((outfit, idx) => ({
        option: idx + 1,
        items: (Array.isArray(outfit) ? outfit : []).map((item) => ({
          name: item?.name || "",
          category: item?.category || "",
          color: item?.color || "",
        })).filter((i) => i.name),
      }));
      sessionStorage.setItem(CURRENT_RECS_KEY, JSON.stringify(summary));
    } catch {}
  }, [outfits]);

  const rotationAnalysis = useMemo(() => {
    return analyzeWardrobeRotation({
      wardrobe,
      history: historyEntries,
      outfits,
      isGuestMode,
      dismissedAlerts: dismissedRotationAlerts,
      preferences: rotationPreferences,
    });
  }, [wardrobe, historyEntries, outfits, isGuestMode, dismissedRotationAlerts, rotationPreferences]);

  const showRotationAlert = rotationAnalysis?.state === "alert"
    && Array.isArray(rotationAnalysis?.items)
    && rotationAnalysis.items.length > 0;

  useEffect(() => {
    const next = rotationAnalysis?.dismissedAlerts || {};
    const current = dismissedRotationAlerts || {};
    if (JSON.stringify(next) === JSON.stringify(current)) return;

    setDismissedRotationAlerts(next);
    dismissedUnderusedAlertsStore.write(next, user);
  }, [rotationAnalysis, dismissedRotationAlerts, user]);

  const canRefresh = true;

  const rememberCurrentRecommendations = () => {
    const current = outfits.map((outfit) => recommendationSignature(outfit)).filter(Boolean);
    if (!current.length) return;
    setRecentRecommendationSigs((prev) => new Set(writeRecentRecommendationSigs([...prev, ...current])));
  };

  const selectRecommendationOption = (optionIndex, { track = true } = {}) => {
    if (!Number.isInteger(optionIndex) || optionIndex < 0) return;

    setSelectedIdx(optionIndex);
    setShowWhyDetails(false);

    if (!track) return;

    const outfit = outfits[optionIndex] || [];
    const tracked = trackRecommendationPersonalization({
      user,
      outfit,
      action: PERSONALIZATION_ACTIONS.SELECT,
    });

    if (tracked?.state) {
      setRecommendationPersonalization(tracked.state);
    }
  };

  const handleRefreshRecommendation = async () => {
    if (!isGuestMode) {
      try {
        const remoteItems = await wardrobeApi.getItems();
        const apiItems = Array.isArray(remoteItems) ? remoteItems : [];
        if (apiItems.length) {
          const mergedItems = mergeWardrobeWithLocalMetadata(apiItems, wardrobe);
          saveWardrobe(mergedItems, user);
          setRefreshWardrobeSnapshot(mergedItems);
        }
      } catch {
        // Keep the local refresh path working even if the wardrobe API is unavailable.
      }
    }

    rememberCurrentRecommendations();
    clearReuseOutfit();
    setSelectedIdx(0);
    setFeedbackComposer(null);
    setRecSeed((prev) => prev + Math.floor(Math.random() * 100000) + 1);
    setAiExplanations([]);
    setAiRefreshToken((prev) => prev + 1);
    setRefreshCount((c) => c + 1);
    setNudge(null);
  };

  const showFeedbackNotice = (notice) => {
    if (feedbackNoticeTimerRef.current) {
      window.clearTimeout(feedbackNoticeTimerRef.current);
    }

    setFeedbackNotice({
      tone: "success",
      ...notice,
    });
    feedbackNoticeTimerRef.current = window.setTimeout(() => {
      setFeedbackNotice(null);
      feedbackNoticeTimerRef.current = null;
    }, FEEDBACK_NOTICE_MS);
  };

  const openFeedbackComposer = (outfit, preferredSignal = FEEDBACK_SIGNALS.DISLIKE) => {
    const signature = outfitSignature(outfit);
    if (!signature) return;

    const existing = getRecommendationFeedback(recommendationFeedback, signature);
    const signal = existing?.signal === FEEDBACK_SIGNALS.LIKE || existing?.signal === FEEDBACK_SIGNALS.DISLIKE
      ? existing.signal
      : preferredSignal;

    setFeedbackComposer({
      signature,
      signal,
      detailCode: existing?.detailCode || "",
      note: existing?.note || "",
    });
    setFeedbackPromptSig("");
  };

  const submitFeedback = async ({ outfit, signal, detailCode = "", note = "" }) => {
    const signature = outfitSignature(outfit);
    if (!signature || feedbackPendingSig === signature) return;

    setFeedbackPendingSig(signature);

    const result = upsertRecommendationFeedback({
      user,
      outfit,
      signal,
      detailCode,
      note,
      source: "dashboard",
    });

    if (!result) {
      setFeedbackPendingSig("");
      return;
    }

    setRecommendationFeedback(result.state);
    setFeedbackComposer((prev) => (prev?.signature === signature ? null : prev));
    setFeedbackPromptSig("");

    try {
      if (!isGuestMode) {
        await submitRecommendationFeedback(
          buildRecommendationFeedbackPayload({
            entry: result.entry,
            context: {
              recommendation_source: aiSource,
              weather_category: weatherCategory,
              time_category: timeCategory,
              occasion: chipText,
            },
          })
        );
      }
    } catch {}

    showFeedbackNotice({
      message: feedbackNoticeText(signal),
      undo: {
        signature: result.signature,
        previousEntry: result.previousEntry,
      },
    });

    setFeedbackPendingSig("");
  };

  const handleRejectOutfit = async (outfit, optionIndex) => {
    const signature = outfitSignature(outfit);
    if (!signature || feedbackPendingSig === signature) return;

    if (Number.isInteger(optionIndex) && optionIndex >= 0) {
      selectRecommendationOption(optionIndex, { track: false });
    }

    setFeedbackPendingSig(signature);
    setFeedbackComposer((prev) => (prev?.signature === signature ? null : prev));

    if (!isGuestMode) {
      showFeedbackNotice({
        message: REJECT_PENDING_MESSAGE,
        undo: null,
        tone: "pending",
      });
    }

    const result = upsertRecommendationFeedback({
      user,
      outfit,
      signal: FEEDBACK_SIGNALS.DISLIKE,
      source: "dashboard",
    });

    if (!result) {
      setFeedbackPendingSig("");
      return;
    }

    setRecommendationFeedback(result.state);

    try {
      if (!isGuestMode) {
        await submitRecommendationFeedback(
          buildRecommendationFeedbackPayload({
            entry: result.entry,
            context: {
              recommendation_source: aiSource,
              weather_category: weatherCategory,
              time_category: timeCategory,
              occasion: chipText,
              action: "reject",
            },
          })
        );
      }

      showFeedbackNotice({
        message: REJECT_SUCCESS_MESSAGE,
        undo: {
          signature: result.signature,
          previousEntry: result.previousEntry,
        },
        tone: "success",
      });
    } catch {
      showFeedbackNotice({
        message: rejectSyncErrorText(),
        undo: {
          signature: result.signature,
          previousEntry: result.previousEntry,
        },
        tone: "error",
      });
    } finally {
      setFeedbackPendingSig("");
    }
  };

  const handleUndoFeedback = () => {
    if (!feedbackNotice?.undo) return;

    const restored = restoreRecommendationFeedback({
      user,
      signature: feedbackNotice.undo.signature,
      previousEntry: feedbackNotice.undo.previousEntry,
    });

    setRecommendationFeedback(restored);
    showFeedbackNotice({
      message: "Feedback undone.",
      undo: null,
    });
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

  const focusRecommendationOption = (optionIndex) => {
    if (!Number.isInteger(optionIndex) || optionIndex < 0) {
      navigate("/wardrobe");
      return;
    }

    selectRecommendationOption(optionIndex);
    const recCard = document.querySelector(".dashRecCard");
    if (recCard?.scrollIntoView) {
      recCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleWearRotationSuggestion = (_item, suggestion) => {
    focusRecommendationOption(suggestion?.index);
  };

  const handleDismissRotationAlert = (item) => {
    const itemId = (item?.id ?? "").toString().trim();
    if (!itemId) return;

    setDismissedRotationAlerts((prev) => {
      const next = {
        ...(prev && typeof prev === "object" ? prev : {}),
        [itemId]: Date.now(),
      };
      dismissedUnderusedAlertsStore.write(next, user);
      return next;
    });
  };



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
        setSavedOutfitEntries((prev) => prev.filter((entry) => (entry?.outfit_signature || "").toString().trim() !== sig));
        syncHistoryState(historyEntries.filter((entry) => idsSignature(Array.isArray(entry?.item_ids) ? entry.item_ids : []) !== sig));
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
      if (res?.saved_outfit) {
        setSavedOutfitEntries((prev) => {
          const filtered = prev.filter((entry) => (entry?.outfit_signature || "").toString().trim() !== sig);
          return [res.saved_outfit, ...filtered];
        });
      }

      if (created) {
        const historyRes = await outfitHistoryApi.recordWorn({
          item_ids: normalized,
          source: "recommendation",
          context: {
            occasion: chipText,
            temperature_category: weatherCategory,
            temperature_f: weatherTempF,
            time_of_day: timeCategory,
          },
        }, user).catch(() => null);

        if (historyRes?.history_entry) {
          syncHistoryState([historyRes.history_entry, ...historyEntries]);
        }
      }

      if (msg) setSaveMsg(msg);
      else setSaveMsg(created ? "Saved! Refreshing recommendations..." : "This outfit is already in your saved outfits.");

      window.setTimeout(() => {
        setSaveMsg("");
        if (created) {
          const result = shouldShowPrompt(user, { justSaved: true });
          if (result.show) { setNudge(result); recordPromptShown(user, result.type); }
        }
      }, 2500);

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
    /* Also feed the new-format feedback store so the Like/Dislike button's
     * active state reflects the click; submitFeedback is async but we don't
     * need to await it here. */
    submitFeedback({ outfit, signal: type }).catch(() => {});
    /* Rebuild personalization profile from all signals */
    Promise.all([
      outfitHistoryApi.listHistory(user).catch(() => ({ history: [] })),
      savedOutfitsApi.listSaved(user).catch(() => ({ saved_outfits: [] })),
    ]).then(([histRes, savedRes]) => {
      const feedback = loadRecommendationFeedback(user);
      const history = Array.isArray(histRes?.history) ? histRes.history : [];
      const saved = Array.isArray(savedRes?.saved_outfits) ? savedRes.saved_outfits : [];
      setLegacyPreferenceProfile(buildPersonalizationProfile(feedback, history, saved, wardrobe));
    });
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

  useEffect(() => {
    let alive = true;
    setGapLoading(true);

    const timerId = window.setTimeout(() => {
      if (!alive) return;

      setGapAnalysis(
        analyzeWardrobeGaps({
          wardrobe,
          answers: effectiveAnswers,
          weatherCategory,
          recentItemCounts,
        })
      );
      setGapLoading(false);
    }, 380);

    return () => {
      alive = false;
      window.clearTimeout(timerId);
    };
  }, [wardrobe, effectiveAnswers, weatherCategory, recentItemCounts]);

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

  const toggleSeasonalMode = () => {
    setSeasonalMode((prev) => {
      const next = !prev;
      writeSeasonalMode(next, user);
      return next;
    });
  };

  const seasonalHelperText = useMemo(() => {
    if (!seasonalMode) return "Seasonal filtering is off, so recommendations can use your full wardrobe.";
    if (!hasSeasonTags) return `Filtered by current season. Add season tags to make ${currentSeasonLabel.toLowerCase()} recommendations more precise.`;
    return "Filtered by current season. In season items stay first, while overlap pieces still help with transitional weather.";
  }, [seasonalMode, hasSeasonTags, currentSeasonLabel]);

  const editorialHeadline = isEditorial
    ? buildEditorialHeadline({
        count: outfits.length,
        tempF: weatherTempF,
        day: editorialDayName(new Date()),
      })
    : { before: "", temp: "", after: "" };
  const editorialHeroOutfit = isEditorial ? (outfits[selectedIdx ?? 0] || outfits[0] || []) : [];
  const editorialHeroImage = isEditorial ? pickEditorialHeroImage(editorialHeroOutfit) : null;
  const editorialClosetGap = isEditorial ? buildClosetGapInsight(wardrobe) : null;
  const editorialRotation = isEditorial ? buildRotationInsight(historyEntries) : null;
  const editorialTomorrow = isEditorial ? buildTomorrowInsight(editorialPlanned) : null;

  return (
    <div className={"onboarding onboardingPage dashPage" + (isEditorial ? " dashPageEditorial" : "")}>
      {isEditorial ? (
        <header className="editorialHero">
          <div className="editorialHeroLeft">
            <div className="editorialMasthead">FitGPT — {formatToday()}</div>
            <h1 className="editorialHeadline">
              {editorialHeadline.before}
              {editorialHeadline.temp ? (
                <span className="editorialHeadlineTemp">{editorialHeadline.temp}</span>
              ) : null}
              {editorialHeadline.after}
            </h1>
            <div className="editorialDek">
              {weatherPresentation.subline || "Refine, save, or plan today's look."}
            </div>
            <div className="editorialActions">
              <button type="button" className="editorialBtnPrimary" onClick={goAddItem}>Add item</button>
              {!isGuestMode ? (
                <>
                  <button type="button" className="editorialBtnGhost" onClick={openPlanModal}>Plan outfit</button>
                  <button type="button" className="editorialBtnGhost" onClick={() => navigate("/history")}>History</button>
                </>
              ) : null}
            </div>
          </div>
          <div className="editorialHeroRight">
            {editorialHeroImage ? (
              <div className="editorialHeroFigure">
                <img src={editorialHeroImage} alt="Today's selected outfit" className="editorialHeroImg" />
                <div className="editorialHeroCaption">
                  {`Plate ${String((selectedIdx ?? 0) + 1).padStart(2, "0")} \u2014 ${editorialHeroOutfit.length} pieces`}
                </div>
              </div>
            ) : (
              <div className="editorialHeroFigure editorialHeroFigureEmpty">
                <div className="editorialHeroFigureLabel">No plate yet</div>
                <div className="editorialHeroCaption">Add a few items to render today's outfit.</div>
              </div>
            )}
          </div>
        </header>
      ) : (
        <div className="dashHeroBar">
          <div className="dashHeroLeft">
            <div className="dashHeroDate">{formatToday()}</div>
            <div className="dashHeroIntro">
              A cleaner way to check today&apos;s outfit, refine it fast, and spot the next best move for your wardrobe.
            </div>
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
            <div
              className="dashPersonalization"
              title={`Personalization: ${legacyPreferenceProfile?.personalizationLevel ?? 0}%`}
            >
              <span className="dashPersonalizationSparkle" aria-hidden="true">{"\u2728"}</span>
              <div className="dashPersonalizationBody">
                <div className="dashPersonalizationHead">
                  <span className="dashPersonalizationLabel">
                    {(() => {
                      const lvl = legacyPreferenceProfile?.personalizationLevel ?? 0;
                      if (lvl >= 70) return "Tuned to you";
                      if (lvl >= 35) return "Learning";
                      return "Getting started";
                    })()}
                  </span>
                  <span className="dashPersonalizationPct">
                    {`${Math.round(legacyPreferenceProfile?.personalizationLevel ?? 0)}%`}
                  </span>
                </div>
                <div className="dashPersonalizationBar" aria-hidden="true">
                  <div
                    className="dashPersonalizationFill"
                    style={{ width: `${legacyPreferenceProfile?.personalizationLevel ?? 0}%` }}
                  />
                </div>
                <div className="dashPersonalizationCaption">Personalized daily styling</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditorial ? (
        <section className="editorialInsightStrip" aria-label="Closet insights">
          <article className="editorialInsightCard">
            <div className="editorialInsightLabel">Rotation</div>
            <div className="editorialInsightHeadline">{editorialRotation?.headline}</div>
            <div className="editorialInsightSub">{editorialRotation?.sub}</div>
          </article>
          <article className="editorialInsightCard">
            <div className="editorialInsightLabel">Closet gap</div>
            <div className="editorialInsightHeadline">{editorialClosetGap?.headline}</div>
            <div className="editorialInsightSub">{editorialClosetGap?.sub}</div>
          </article>
          <article className="editorialInsightCard">
            <div className="editorialInsightLabel">Tomorrow</div>
            <div className="editorialInsightHeadline">{editorialTomorrow?.headline}</div>
            <div className="editorialInsightSub">{editorialTomorrow?.sub}</div>
          </article>
        </section>
      ) : null}

      <section className="card dashWide dashWeatherCard dashSectionCard">
        <div className="dashWeatherHud">
          <div className="dashWeatherMain">
            <span className={"dashWeatherEmoji" + (weatherLoading ? " dashWeatherEmojiLoading" : "")}>
              {weatherPresentation.glyph}
            </span>
            <div className="dashWeatherInfo">
              <div className={"dashWeatherTemp" + (weatherLoading ? " dashWeatherTempLoading" : "")}>
                {weatherLoading ? "Detecting weather" : weatherPresentation.headline}
              </div>
              <div className="dashWeatherLabel">
                {weatherLoading ? "Checking forecast for your area" : weatherPresentation.subline}
              </div>
            </div>
          </div>

          <div className="dashRefineSummary">
            <div className="dashRefinePills">
              {!weatherLoading ? (
                <span className="dashMiniPill">{weatherPresentation.status}</span>
              ) : null}
              <span className="dashMiniPill">{timeLine}</span>
              {seasonalMode ? (
                <span className="dashMiniPill dashMiniPillAccent">{seasonalWardrobeLabel}</span>
              ) : (
                <span className="dashMiniPill">All seasons</span>
              )}
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

              <button
                type="button"
                className={"dashContextChip" + (seasonalMode ? " active" : "")}
                onClick={toggleSeasonalMode}
                aria-pressed={seasonalMode}
              >
                <span className="dashContextChipIcon">{"\u25C8"}</span>
                <span>{seasonalMode ? seasonalWardrobeLabel : "Seasonal Wardrobe Off"}</span>
              </button>
            </div>

            <div className="dashSeasonNote">
              <span className="dashSeasonIndicator">{currentSeasonLabel}</span>
              <span>{seasonalHelperText}</span>
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

      <div className="dashSectionLead">
        <div>
          <div className="dashSectionEyebrow">Today&apos;s focus</div>
          <div className="dashSectionTitle">Outfit recommendations made simple</div>
        </div>
        {showRotationAlert ? (
          <WardrobeRotationPanel
            analysis={rotationAnalysis}
            preferences={rotationPreferences}
            loadingSuggestions={!aiHasResolved && aiLoading}
            onOpenWardrobe={() => navigate("/wardrobe")}
            onDismissAlert={handleDismissRotationAlert}
            onWearSuggestion={handleWearRotationSuggestion}
            onManagePreferences={() => navigate("/profile#smart-alerts")}
          />
        ) : null}
      </div>

      <div className="dashStyleMarquee" aria-label="Style tips">
        <div className="dashStyleMarqueeTrack" aria-hidden="true">
          {STYLE_TIPS.concat(STYLE_TIPS).map((tip, index) => (
            <span className="dashStyleMarqueeItem" key={`mq-${index}`}>
              <span className="dashStyleMarqueeDot" aria-hidden="true" />
              <span className="dashStyleMarqueeText">{tip}</span>
            </span>
          ))}
        </div>
      </div>

      <section className="card dashWide dashRecCard dashSectionCard">
        <div className="dashRecHeader">
          <ErrorBoundary fallback={null}><MeshGradient className="dashRecHeaderGradient" /></ErrorBoundary>
          <div className="dashRecHeaderLeft">
            <div className="dashRecTitle">Today's Recommendation</div>
            <div className="dashRecPersonalizationRow">
              <span className={`dashRecPersonalizationBadge ${personalizationSummary.tone}`}>
                {personalizationSummary.label}
              </span>
              <span className="dashRecPersonalizationText">
                {personalizationSummary.subline}
              </span>
            </div>
            {reused ? (
              <div className="dashMuted" style={{ fontSize: 12, marginTop: 4 }}>
                Reused from saved outfits
              </div>
            ) : null}
          </div>
          <div className="dashChip">{chipText}</div>
          {outfits.length > 0 && (
            <div className="dashRecActions">
              <button
                type="button"
                className="dashRecActionBtn dashRecActionPrimary"
                onClick={handleRefreshRecommendation}
                disabled={!canRefresh}
                aria-label="Refresh recommendations"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                <span>Refresh</span>
              </button>
              <button
                type="button"
                className="dashRecActionBtn dashRecActionSecondary"
                onClick={() => {
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
                }}
                aria-label="Share outfit"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>Share</span>
              </button>
              <div className="dashViewToggle" role="radiogroup" aria-label="View mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === "grid"}
                  className={"dashViewToggleBtn" + (viewMode === "grid" ? " active" : "")}
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === "mannequin"}
                  className={"dashViewToggleBtn" + (viewMode === "mannequin" ? " active" : "")}
                  onClick={() => {
                    setViewMode("mannequin");
                    if (selectedIdx == null) setSelectedIdx(0);
                  }}
                  title="3D mannequin view"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="5" r="2.5" />
                    <path d="M7 10h10l-1 5h-3v7h-2v-7H8z" />
                  </svg>
                  <span>3D</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div key={recSeed} className="dashOutfitsAnimWrap">
          {!aiHasResolved ? (
            <div className="dashAiLoading" style={{ padding: "32px 0", textAlign: "center" }}>
              {personalizationSummary.loadingLabel}
            </div>
          ) : wardrobe.filter((it) => it?.is_active !== false).length === 0 ? (
            <div className="dashEmptyWardrobe">
              <div className="dashEmptyIcon">&#x1F455;</div>
              <div className="dashEmptyTitle">Your wardrobe is empty</div>
              <div className="dashEmptySub">Add a few items to get recommendations.</div>
              <div className="dashEmptyActions">
                <button className="btn primary dashEmptyBtn" type="button" onClick={() => navigate("/wardrobe")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Add clothing items</span>
                </button>
                <button className="btn dashEmptyBtn" type="button" onClick={() => navigate("/wardrobe")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v7"/><path d="M12 10l-8 4.5v5h16v-5z"/><circle cx="12" cy="4" r="1.5"/></svg>
                  <span>Open wardrobe</span>
                </button>
              </div>
            </div>
          ) : outfits.length === 0 || wardrobe.filter((it) => it?.is_active !== false).length < 3 ? (
            <div className="dashEmptyWardrobe dashSparseWardrobe">
              <div className="dashEmptyIcon">&#x1F9FA;</div>
              <div className="dashEmptyTitle">Almost there</div>
              <div className="dashEmptySub">
                {(() => {
                  const active = wardrobe.filter((it) => it?.is_active !== false).length;
                  const remaining = Math.max(0, 3 - active);
                  if (remaining > 0) {
                    return `Add ${remaining} more item${remaining === 1 ? "" : "s"} from different categories (tops, bottoms, shoes) and we'll start suggesting full outfits.`;
                  }
                  return `You have ${active} item${active === 1 ? "" : "s"} but we couldn't assemble an outfit. Try adding items from different categories (tops, bottoms, shoes).`;
                })()}
              </div>
              <div className="dashEmptyActions">
                <button className="btn primary dashEmptyBtn" type="button" onClick={() => navigate("/wardrobe")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Add more items</span>
                </button>
                <button className="btn dashEmptyBtn" type="button" onClick={() => navigate("/wardrobe")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v7"/><path d="M12 10l-8 4.5v5h16v-5z"/><circle cx="12" cy="4" r="1.5"/></svg>
                  <span>Open wardrobe</span>
                </button>
              </div>
            </div>
          ) : viewMode === "mannequin" ? (
            outfits.map((outfit, idx) => {
              const sig = outfitSignature(outfit);
              const isSaved = savedSigs.has(sig);
              const disabled = !sig || savingSig === sig;
              const label = isGuestMode ? "Sign in to save" : isSaved ? "Unsave" : savingSig === sig ? "Saving..." : "Save";
              return (
                <div
                  key={`mq_${idx}`}
                  className={"dashOutfitOption" + (idx === selectedIdx ? " dashOutfitSelected" : "")}
                  style={{ animationDelay: `${idx * 120}ms`, marginTop: idx === 0 ? 0 : 18, cursor: "pointer" }}
                  onClick={() => selectRecommendationOption(idx)}
                >
                  <div className="optionLabel">
                    <span className="optionLabelNum">{String(idx + 1).padStart(2, "0")}</span>
                    <span className="optionLabelSlash">{"//"}</span>
                    <span className="optionLabelText">OPTION</span>
                  </div>
                  {idx === selectedIdx ? (
                    <ErrorBoundary fallback={<div style={{ padding: 24, textAlign: "center" }}>3D view unavailable</div>}>
                      <MannequinViewer outfit={outfit} bodyType={bodyTypeId} />
                    </ErrorBoundary>
                  ) : (
                    <div className="dashOutfitGridFigma">
                      {outfit.map((item, itemIdx) => (
                        <div
                          key={item.id}
                          className="dashSquareTile dashTileReveal"
                          style={{ animationDelay: `${itemIdx * 90 + idx * 140}ms` }}
                        >
                          {item.image_url ? (
                            <img className="dashSquareImg" src={item.image_url} alt={item.name} />
                          ) : (
                            <div className="dashSquareImg" aria-hidden="true" />
                          )}
                          <div className="dashSquareNameRow">
                            <span className="dashColorDot" style={{ background: colorToCss(item.color) }} title={item.color} />
                            <span className="dashSquareName">{item.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mannequinSaveBtnRow">
                    <button
                      type="button"
                      className={"styledSaveBtn" + (isSaved ? " saved" : "")}
                      onClick={(e) => { e.stopPropagation(); handleSaveOutfit(outfit); }}
                      disabled={disabled}
                    >
                      <span className="styledSaveBtnIcon">{isSaved ? "\u2713" : "\u2661"}</span>
                      <span className="styledSaveBtnText">{label}</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : outfits.map((outfit, idx) => {
            const sig = outfitSignature(outfit);
            const isSaved = savedSigs.has(sig);
            const disabled = !sig || savingSig === sig;
            const label = isGuestMode ? "Sign in to save" : isSaved ? "Unsave" : savingSig === sig ? "Saving..." : "Save";
            const summary = outfitSummaries[idx] || { score: 0, rankLabel: "Option", confidenceLabel: "Flexible", traits: [] };
            const feedbackEntry = getRecommendationFeedback(recommendationFeedback, sig);
            const feedbackSignal = feedbackEntry?.signal || "";
            const isFeedbackPending = feedbackPendingSig === sig;
            const isComposerOpen = feedbackComposer?.signature === sig;
            const composerSignal = feedbackComposer?.signal || FEEDBACK_SIGNALS.DISLIKE;
            const composerReasons = FEEDBACK_REASON_OPTIONS[composerSignal] || FEEDBACK_REASON_OPTIONS.dislike;
            const isFeedbackCardActive = idx === (selectedIdx ?? 0);
            const showFeedbackPanel = isFeedbackCardActive || Boolean(feedbackSignal) || isComposerOpen;
            const showPromptHighlight = isFeedbackCardActive && feedbackPromptSig === sig && !feedbackSignal && !isComposerOpen;
            const showDetailToggle = feedbackSignal === FEEDBACK_SIGNALS.LIKE || feedbackSignal === FEEDBACK_SIGNALS.DISLIKE || isComposerOpen;
            const feedbackHint = feedbackSignal
              ? feedbackSummaryText(feedbackEntry)
              : showPromptHighlight
                ? "Hide removes this outfit from view. Add detail for a specific reason."
                : "Hide this option, or add detail about what worked.";
            const feedbackToneClass = feedbackSignal === FEEDBACK_SIGNALS.LIKE
              ? " dashOutfitFeedbackLike"
              : feedbackSignal === FEEDBACK_SIGNALS.DISLIKE
                ? " dashOutfitFeedbackDislike"
                : feedbackSignal === FEEDBACK_SIGNALS.SKIP
                  ? " dashOutfitFeedbackSkip"
                  : "";

            return (
              <div
                key={`opt_${idx}`}
                className={"dashOutfitOption" + (idx === selectedIdx ? " dashOutfitSelected" : "") + feedbackToneClass}
                style={{ animationDelay: `${idx * 120}ms`, marginTop: idx === 0 ? 0 : 18, cursor: "pointer" }}
                onClick={() => selectRecommendationOption(idx)}
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

                    <div className={"dashOptionRankBadge conf-" + (summary.confidenceLabel || "").toLowerCase()}>
                      <span className="dashOptionRankDot" aria-hidden="true" />
                      <span className="dashOptionRankLabel">{summary.rankLabel}</span>
                      {summary.confidenceLabel ? (
                        <>
                          <span className="dashOptionRankSep" aria-hidden="true">{"\u00B7"}</span>
                          <span className="dashOptionRankConfidence">{summary.confidenceLabel}</span>
                        </>
                      ) : null}
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
                        {item.image_url ? (
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
                </div>

                <div className="dashOutfitActionsRow">
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
                    <button
                      type="button"
                      className={"dashFeedbackBtn dashFeedbackLike" + (feedbackSignal === FEEDBACK_SIGNALS.LIKE ? " active" : "")}
                      onClick={() => handleFeedback(outfit, "like")}
                      title="More like this"
                      aria-label="More like this"
                      aria-pressed={feedbackSignal === FEEDBACK_SIGNALS.LIKE}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 10v12" />
                        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.97 2.35l-1.4 8A2 2 0 0 1 18.43 22H7V10l4.66-6.66A1 1 0 0 1 13 3a2.88 2.88 0 0 1 2 4.88Z" />
                      </svg>
                      <span>Like</span>
                    </button>
                    <button
                      type="button"
                      className={"dashFeedbackBtn dashFeedbackDislike" + (feedbackSignal === FEEDBACK_SIGNALS.DISLIKE ? " active" : "")}
                      onClick={() => handleFeedback(outfit, "dislike")}
                      title="Less like this"
                      aria-label="Less like this"
                      aria-pressed={feedbackSignal === FEEDBACK_SIGNALS.DISLIKE}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 14V2" />
                        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.97-2.35l1.4-8A2 2 0 0 1 5.57 2H17v12l-4.66 6.66A1 1 0 0 1 11 21a2.88 2.88 0 0 1-2-4.88Z" />
                      </svg>
                      <span>Dislike</span>
                    </button>
                  </div>
                </div>

                <div className="dashOptionReason">
                  <div className="dashOptionReasonHead">
                    <div className="dashOptionReasonLabel">Why this works</div>
                    <div className="dashOptionReasonActions">
                      <div className="dashOptionReasonHint">Quick summary</div>
                      <button
                        type="button"
                        className="dashPreviewBtn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMannequinPreview({
                            outfit,
                            title: `3D Outfit Preview: Option ${String(idx + 1).padStart(2, "0")}`,
                          });
                        }}
                      >
                        View on mannequin
                      </button>
                    </div>
                  </div>
                  <div className="dashOptionReasonText">{summary.explanationPreview}</div>
                </div>

                {showFeedbackPanel ? (
                  <div className={"dashFeedbackPanel" + (showPromptHighlight ? " subtlePrompt" : "")} onClick={(event) => event.stopPropagation()}>
                    <div className="dashFeedbackHeader compact">
                      <div className="dashFeedbackCopy">
                        <div className="dashFeedbackLabel">{feedbackSignal ? feedbackBadgeText(feedbackSignal) : "Quick feedback"}</div>
                        <div className="dashFeedbackHint">{feedbackHint}</div>
                      </div>
                      {showPromptHighlight ? (
                        <button
                          type="button"
                          className="dashFeedbackLaterBtn"
                          onClick={() => setFeedbackPromptSig("")}
                        >
                          Later
                        </button>
                      ) : feedbackSignal ? (
                        <span className={`dashFeedbackState ${feedbackSignal}`}>
                          {feedbackBadgeText(feedbackSignal)}
                        </span>
                      ) : null}
                    </div>

                    <div className="dashFeedbackActions compact" role="group" aria-label={`Recommendation feedback for outfit option ${idx + 1}`}>
                    <button
                      type="button"
                      className="dashFeedbackBtn reject compact ghost"
                      aria-label={`Hide outfit option ${idx + 1}`}
                      disabled={isFeedbackPending}
                      onClick={() => {
                        void handleRejectOutfit(outfit, idx);
                      }}
                    >
                      <span className="dashFeedbackBtnGlyph" aria-hidden="true">x</span>
                      <span className="dashFeedbackBtnText">{isFeedbackPending ? "Hiding..." : "Hide"}</span>
                    </button>
                    {showDetailToggle ? (
                      <button
                        type="button"
                        className={"dashFeedbackBtn explain compact ghost" + (isComposerOpen ? " active" : "")}
                        aria-expanded={isComposerOpen}
                        disabled={isFeedbackPending}
                        onClick={() => {
                          selectRecommendationOption(idx, { track: false });
                          if (isComposerOpen) {
                            setFeedbackComposer(null);
                            return;
                          }
                          openFeedbackComposer(outfit, feedbackSignal === FEEDBACK_SIGNALS.LIKE ? FEEDBACK_SIGNALS.LIKE : FEEDBACK_SIGNALS.DISLIKE);
                        }}
                      >
                        <span className="dashFeedbackBtnText">{isComposerOpen ? "Hide detail" : "Add detail"}</span>
                      </button>
                    ) : null}
                  </div>

                  {isComposerOpen ? (
                    <div className="dashFeedbackExplainCard">
                      <div className="dashFeedbackExplainTop">
                        <div className="dashFeedbackExplainTitle">Explain this recommendation</div>
                        <div className="dashFeedbackExplainHint">Optional detail helps future picks feel more personal.</div>
                      </div>

                      <div className="dashFeedbackSignalTabs" role="group" aria-label="Feedback type">
                        <button
                          type="button"
                          className={"dashFeedbackTab" + (composerSignal === FEEDBACK_SIGNALS.LIKE ? " active" : "")}
                          aria-pressed={composerSignal === FEEDBACK_SIGNALS.LIKE}
                          onClick={() => setFeedbackComposer((prev) => ({ ...prev, signal: FEEDBACK_SIGNALS.LIKE, detailCode: "" }))}
                        >
                          👍 Like
                        </button>
                        <button
                          type="button"
                          className={"dashFeedbackTab" + (composerSignal === FEEDBACK_SIGNALS.DISLIKE ? " active" : "")}
                          aria-pressed={composerSignal === FEEDBACK_SIGNALS.DISLIKE}
                          onClick={() => setFeedbackComposer((prev) => ({ ...prev, signal: FEEDBACK_SIGNALS.DISLIKE, detailCode: "" }))}
                        >
                          👎 Dislike
                        </button>
                      </div>

                      <div className="dashFeedbackChipRow">
                        {composerReasons.map((reason) => (
                          <button
                            key={`${sig}-${reason.code}`}
                            type="button"
                            className={"dashFeedbackReasonChip" + (feedbackComposer?.detailCode === reason.code ? " active" : "")}
                            aria-pressed={feedbackComposer?.detailCode === reason.code}
                            onClick={() => setFeedbackComposer((prev) => ({
                              ...prev,
                              detailCode: prev?.detailCode === reason.code ? "" : reason.code,
                            }))}
                          >
                            {reason.label}
                          </button>
                        ))}
                      </div>

                      <label className="dashFeedbackNoteField">
                        <span className="dashFeedbackNoteLabel">Optional note</span>
                        <textarea
                          value={feedbackComposer?.note || ""}
                          onChange={(event) => setFeedbackComposer((prev) => ({ ...prev, note: event.target.value.slice(0, 140) }))}
                          rows={2}
                          maxLength={140}
                          placeholder="Add a quick note if you want more detail."
                        />
                      </label>

                      <div className="dashFeedbackExplainActions">
                        <button
                          type="button"
                          className="btnSecondary"
                          onClick={() => setFeedbackComposer(null)}
                          disabled={isFeedbackPending}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btnPrimary"
                          onClick={() => {
                            selectRecommendationOption(idx, { track: false });
                            void submitFeedback({
                              outfit,
                              signal: feedbackComposer?.signal || FEEDBACK_SIGNALS.DISLIKE,
                              detailCode: feedbackComposer?.detailCode || "",
                              note: feedbackComposer?.note || "",
                            });
                          }}
                          disabled={isFeedbackPending}
                        >
                          {isFeedbackPending ? "Saving..." : "Save feedback"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>



        {saveMsg ? (
          <div className="noteBox" style={{ marginTop: 12 }}>
            {saveMsg}
          </div>
        ) : null}

        {nudge && !saveMsg && selectedIdx != null && (
          <div className="feedbackNudge" key={nudge.type}>
            <span className="feedbackNudgeText">{nudge.text}</span>
            <button
              type="button"
              className="feedbackNudgeBtn feedbackNudgeLike"
              onClick={() => { handleFeedback(outfits[selectedIdx], "like"); recordPromptEngaged(user, nudge.type); setNudge(null); }}
            >&#x25B2;</button>
            <button
              type="button"
              className="feedbackNudgeBtn feedbackNudgeDislike"
              onClick={() => { handleFeedback(outfits[selectedIdx], "dislike"); recordPromptEngaged(user, nudge.type); setNudge(null); }}
            >&#x25BC;</button>
            <button
              type="button"
              className="feedbackNudgeDismiss"
              onClick={() => { recordPromptDismissed(user); setNudge(null); }}
              aria-label="Dismiss"
            >&times;</button>
          </div>
        )}
        {feedbackNotice ? (
          <div className={`noteBox dashFeedbackNotice ${feedbackNotice.tone || "success"}`} style={{ marginTop: 12 }} role="status" aria-live="polite">
            <span>{feedbackNotice.message}</span>
            {feedbackNotice.undo ? (
              <button type="button" className="dashFeedbackUndoBtn" onClick={handleUndoFeedback}>
                Undo
              </button>
            ) : null}
          </div>
        ) : null}
        <OutfitMannequinPreview
          isOpen={Boolean(mannequinPreview)}
          onClose={() => setMannequinPreview(null)}
          outfit={mannequinPreview?.outfit || []}
          title={mannequinPreview?.title || "3D Outfit Preview"}
          subtitle="View on mannequin"
        />
      </section>

      <WardrobeGapPanel
        analysis={gapAnalysis}
        loading={gapLoading}
        onOpenWardrobe={() => navigate("/wardrobe")}
      />


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
                  {adaptAiText(explanationSummaryText || explanationText, effectivePrefs)
                    .split(/\n{2,}/)
                    .filter(Boolean)
                    .map((paragraph, pi, arr) => (
                      <span key={pi} className="dashAiParagraph">
                        {paragraph.split(" ").map((word, i) => (
                          <React.Fragment key={i}>
                            <span className="dashAiWord" style={{ animationDelay: `${(pi * 40 + i) * 28}ms` }}>
                              {word}
                            </span>{" "}
                          </React.Fragment>
                        ))}
                        {pi < arr.length - 1 ? "\n" : null}
                      </span>
                    ))}
                </span>
              </div>

              {showWhyDetails ? (
                <div className="dashWhyGrid">
                  {explanationDetails.map((detail) => (
                    <div key={detail.title} className="dashWhyCard">
                      <div className="dashWhyCardTitle">{detail.title}</div>
                      <div className="dashWhyCardText" style={{ whiteSpace: "pre-line" }}>
                        {adaptAiText(detail.body, effectivePrefs)}
                      </div>
                    </div>
                  ))}
                  {outfitSummaries[selectedIdx]?.confidence && (
                    <div className="dashWhyCard">
                      <div className="dashWhyCardTitle">Confidence Breakdown</div>
                      <div className="dashConfidenceSignals">
                        {[
                          { label: "Algorithm", value: outfitSummaries[selectedIdx].confidence.signals.algorithm },
                          { label: "Coverage", value: outfitSummaries[selectedIdx].confidence.signals.coverage },
                          { label: "Weather", value: outfitSummaries[selectedIdx].confidence.signals.weather },
                          { label: "Preferences", value: outfitSummaries[selectedIdx].confidence.signals.feedback },
                          { label: "Variety", value: outfitSummaries[selectedIdx].confidence.signals.variety },
                        ].map((s) => (
                          <div key={s.label} className="dashConfidenceRow">
                            <span className="dashConfidenceLabel">{s.label}</span>
                            <div className="dashConfidenceBar"><div className="dashConfidenceFill" style={{ width: `${s.value}%` }} /></div>
                            <span className="dashConfidenceValue">{s.value}</span>
                          </div>
                        ))}
                        <div className="dashConfidenceNote">
                          Data confidence: {outfitSummaries[selectedIdx].confidence.dataConfidence}%
                        </div>
                      </div>
                    </div>
                  )}
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
