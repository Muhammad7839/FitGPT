import { normalizeTagList } from "./wardrobeOptions";

export const SEASON_ORDER = ["winter", "spring", "summer", "fall"];

const SEASON_LABELS = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
};

const SEASON_OVERLAP_MAP = {
  winter: ["fall"],
  spring: ["winter", "summer"],
  summer: ["spring"],
  fall: ["summer", "winter"],
};

function normalizeSeason(value) {
  const season = (value || "").toString().trim().toLowerCase();
  return SEASON_ORDER.includes(season) ? season : "";
}

function seasonTagsFromValue(itemOrTags) {
  if (Array.isArray(itemOrTags) || typeof itemOrTags === "string") {
    return normalizeTagList(itemOrTags);
  }
  return normalizeTagList(itemOrTags?.season_tags);
}

export function getCurrentSeason(dateObj = new Date()) {
  const month = (dateObj instanceof Date ? dateObj : new Date(dateObj)).getMonth() + 1;
  if (month === 12 || month <= 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "fall";
}

export function getSeasonLabel(season) {
  return SEASON_LABELS[normalizeSeason(season)] || "Seasonal";
}

export function getSeasonalWardrobeLabel(season) {
  return `${getSeasonLabel(season)} Wardrobe`;
}

export function hasSeasonalMetadata(items) {
  return (Array.isArray(items) ? items : []).some((item) => seasonTagsFromValue(item).length > 0);
}

export function getSeasonMatch(itemOrTags, currentSeasonRaw) {
  const currentSeason = normalizeSeason(currentSeasonRaw) || getCurrentSeason();
  const tags = seasonTagsFromValue(itemOrTags);
  const overlapSeasons = SEASON_OVERLAP_MAP[currentSeason] || [];
  const isTransitionSeason = currentSeason === "spring" || currentSeason === "fall";

  if (!tags.length) {
    return {
      status: "untagged",
      label: "Needs season tag",
      tone: "muted",
      sortRank: 1,
      scoreAdjustment: 0,
      isRelevant: true,
    };
  }

  if (tags.includes(currentSeason)) {
    return {
      status: "in-season",
      label: "In season",
      tone: "in",
      sortRank: 5,
      scoreAdjustment: 12,
      isRelevant: true,
    };
  }

  if (tags.includes("all-season")) {
    return {
      status: "all-season",
      label: "All season",
      tone: "in",
      sortRank: 4,
      scoreAdjustment: 9,
      isRelevant: true,
    };
  }

  if (tags.some((tag) => overlapSeasons.includes(tag))) {
    return {
      status: "season-overlap",
      label: "Season overlap",
      tone: "overlap",
      sortRank: isTransitionSeason ? 3 : 2,
      scoreAdjustment: isTransitionSeason ? 5 : 3,
      isRelevant: true,
    };
  }

  return {
    status: "out-of-season",
    label: "Out of season",
    tone: "out",
    sortRank: 0,
    scoreAdjustment: -10,
    isRelevant: false,
  };
}

export function sortItemsBySeasonalRelevance(items, currentSeason) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const seasonA = getSeasonMatch(a, currentSeason);
    const seasonB = getSeasonMatch(b, currentSeason);
    if (seasonB.sortRank !== seasonA.sortRank) return seasonB.sortRank - seasonA.sortRank;

    const nameA = (a?.name || "").toString().trim().toLowerCase();
    const nameB = (b?.name || "").toString().trim().toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

export function summarizeSeasonalCollection(items, currentSeason) {
  const summary = {
    total: 0,
    inSeasonCount: 0,
    allSeasonCount: 0,
    overlapCount: 0,
    outOfSeasonCount: 0,
    untaggedCount: 0,
    relevantCount: 0,
    taggedCount: 0,
    hasSeasonalMetadata: false,
  };

  for (const item of Array.isArray(items) ? items : []) {
    summary.total += 1;
    const tags = seasonTagsFromValue(item);
    if (tags.length) {
      summary.taggedCount += 1;
      summary.hasSeasonalMetadata = true;
    }

    const match = getSeasonMatch(item, currentSeason);
    if (match.status === "in-season") summary.inSeasonCount += 1;
    else if (match.status === "all-season") summary.allSeasonCount += 1;
    else if (match.status === "season-overlap") summary.overlapCount += 1;
    else if (match.status === "out-of-season") summary.outOfSeasonCount += 1;
    else summary.untaggedCount += 1;

    if (match.isRelevant) summary.relevantCount += 1;
  }

  return summary;
}
