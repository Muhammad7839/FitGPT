import { normalizeFitTag } from "./helpers";
import { getUserId, userKey } from "./userStorage";
import { normalizeItemMetadata, normalizeTagList, optionLabel } from "./wardrobeOptions";

const DUPLICATE_IGNORE_KEY = "fitgpt_duplicate_ignore_v1";
const HASH_SIZE = 8;
const imageHashCache = new Map();

function normalizeText(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueList(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter(Boolean))];
}

function intersectCount(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  let count = 0;
  a.forEach((item) => {
    if (b.has(item)) count += 1;
  });
  return count;
}

function overlapScore(left, right) {
  const a = uniqueList(left);
  const b = uniqueList(right);
  if (!a.length || !b.length) return 0;
  const shared = intersectCount(a, b);
  return shared / Math.max(a.length, b.length);
}

function nameSimilarity(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  const tokenScore = overlapScore(tokensA, tokensB);

  if (a.includes(b) || b.includes(a)) return Math.max(0.88, tokenScore);
  return tokenScore;
}

function formatValue(value, fallback = "Not set") {
  if (Array.isArray(value)) {
    if (!value.length) return fallback;
    return value.map((part) => optionLabel(part)).join(", ");
  }
  const text = (value || "").toString().trim();
  if (!text) return fallback;
  if (text.includes(",")) {
    return text
      .split(",")
      .map((part) => optionLabel(part.trim()))
      .filter(Boolean)
      .join(", ");
  }
  return optionLabel(text);
}

function colorTokens(value) {
  return (value || "")
    .toString()
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

function normalizeItemForDetection(item) {
  const next = normalizeItemMetadata(item);
  return {
    raw: next,
    id: String(next?.id || ""),
    name: (next?.name || "").toString().trim(),
    normalizedName: normalizeText(next?.name),
    nameTokens: tokenize(next?.name),
    category: (next?.category || "").toString().trim(),
    clothingType: normalizeText(next?.clothing_type),
    colorTokens: colorTokens(next?.color),
    fitTag: normalizeFitTag(next?.fit_tag || next?.fitTag || next?.fit),
    styleTags: normalizeTagList(next?.style_tags),
    occasionTags: normalizeTagList(next?.occasion_tags),
    seasonTags: normalizeTagList(next?.season_tags),
    layerType: normalizeText(next?.layer_type),
    setId: (next?.set_id || "").toString().trim(),
    isOnePiece: next?.is_one_piece === true,
    imageUrl: (next?.image_url || "").toString(),
  };
}

function hashDistance(left, right) {
  if (!left || !right || left.length !== right.length) return 1;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) diff += 1;
  }
  return diff / left.length;
}

function buildHashFromPixels(data, size) {
  const values = [];
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round((data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114));
    values.push(gray);
  }
  const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  return values.map((value) => (value >= avg ? "1" : "0")).join("").slice(0, size * size);
}

function getImageHash(imageUrl) {
  if (!imageUrl) return Promise.resolve(null);
  if (imageHashCache.has(imageUrl)) return imageHashCache.get(imageUrl);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = HASH_SIZE;
        canvas.height = HASH_SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, HASH_SIZE, HASH_SIZE);
        const imageData = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE);
        resolve(buildHashFromPixels(imageData.data, HASH_SIZE));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });

  imageHashCache.set(imageUrl, promise);
  return promise;
}

function completenessScore(item) {
  let score = 0;
  if (item.name) score += 1;
  if (item.category) score += 1;
  if (item.clothingType) score += 1;
  if (item.colorTokens.length) score += 1;
  if (item.fitTag && item.fitTag !== "unknown") score += 1;
  if (item.styleTags.length) score += 1;
  if (item.occasionTags.length) score += 1;
  if (item.seasonTags.length) score += 1;
  if (item.imageUrl) score += 1;
  return score;
}

export function makeDuplicatePairKey(idA, idB) {
  return [String(idA || ""), String(idB || "")]
    .sort((left, right) => left.localeCompare(right))
    .join("::");
}

function confidenceTone(score) {
  if (score >= 0.9) return "high";
  if (score >= 0.8) return "medium";
  return "low";
}

function compareItems(left, right) {
  if (!left.id || !right.id) return null;
  if (left.id === right.id) return null;
  if (!left.category || !right.category || left.category !== right.category) return null;

  const clothingTypeScore = left.clothingType && right.clothingType && left.clothingType === right.clothingType ? 1 : 0;
  const colorScore = overlapScore(left.colorTokens, right.colorTokens);
  const styleScore = overlapScore(left.styleTags, right.styleTags);
  const occasionScore = overlapScore(left.occasionTags, right.occasionTags);
  const seasonScore = overlapScore(left.seasonTags, right.seasonTags);
  const fitScore = left.fitTag !== "unknown" && left.fitTag === right.fitTag ? 1 : 0;
  const layerScore = left.layerType && left.layerType === right.layerType ? 1 : 0;
  const setScore = left.setId && left.setId === right.setId ? 1 : 0;
  const onePieceScore = left.isOnePiece === right.isOnePiece ? 1 : 0;
  const nameScore = nameSimilarity(left.name, right.name);
  const imageScore = left.imageHash && right.imageHash ? Math.max(0, 1 - hashDistance(left.imageHash, right.imageHash)) : 0;

  const signalMatches = [
    clothingTypeScore >= 1,
    colorScore >= 0.7,
    styleScore >= 0.5,
    occasionScore >= 0.5,
    seasonScore >= 0.5,
    fitScore >= 1,
    layerScore >= 1,
    setScore >= 1,
    onePieceScore >= 1,
    nameScore >= 0.82,
    imageScore >= 0.75,
  ].filter(Boolean).length;

  if (signalMatches < 2) return null;

  const score = (
    0.26 +
    (clothingTypeScore * 0.16) +
    (colorScore * 0.14) +
    (imageScore * 0.22) +
    (nameScore * 0.1) +
    (styleScore * 0.04) +
    (occasionScore * 0.02) +
    (seasonScore * 0.02) +
    (fitScore * 0.03) +
    (layerScore * 0.01)
  );

  if (score < 0.72) return null;

  const duplicateType = score >= 0.89 && imageScore >= 0.88 && (clothingTypeScore >= 1 || nameScore >= 0.94) && colorScore >= 0.6
    ? "exact"
    : "near";

  const confidence = Math.min(99, Math.max(72, Math.round(score * 100)));

  const fields = [
    {
      key: "category",
      label: "Category",
      left: formatValue(left.category),
      right: formatValue(right.category),
      same: left.category === right.category,
    },
    {
      key: "type",
      label: "Clothing Type",
      left: formatValue(left.clothingType),
      right: formatValue(right.clothingType),
      same: left.clothingType === right.clothingType,
    },
    {
      key: "color",
      label: "Color",
      left: formatValue(left.colorTokens),
      right: formatValue(right.colorTokens),
      same: colorScore >= 0.9,
    },
    {
      key: "fit",
      label: "Fit",
      left: formatValue(left.fitTag),
      right: formatValue(right.fitTag),
      same: fitScore >= 1,
    },
    {
      key: "style",
      label: "Style",
      left: formatValue(left.styleTags),
      right: formatValue(right.styleTags),
      same: styleScore >= 0.5,
    },
    {
      key: "occasion",
      label: "Occasion",
      left: formatValue(left.occasionTags),
      right: formatValue(right.occasionTags),
      same: occasionScore >= 0.5,
    },
    {
      key: "season",
      label: "Season",
      left: formatValue(left.seasonTags),
      right: formatValue(right.seasonTags),
      same: seasonScore >= 0.5,
    },
  ];

  const matchHighlights = [
    left.category === right.category ? "Same category" : "",
    clothingTypeScore >= 1 ? "Matching clothing type" : "",
    colorScore >= 0.7 ? "Very similar color" : "",
    nameScore >= 0.82 ? "Similar item name" : "",
    imageScore >= 0.75 ? "Similar image" : "",
    fitScore >= 1 ? "Matching fit" : "",
    styleScore >= 0.5 ? "Shared style tags" : "",
  ].filter(Boolean);

  return {
    pairKey: makeDuplicatePairKey(left.id, right.id),
    duplicateType,
    duplicateTypeLabel: duplicateType === "exact" ? "Exact duplicate" : "Near duplicate",
    confidence,
    confidenceTone: confidenceTone(score),
    score,
    fields,
    matchHighlights,
    leftItem: left.raw,
    rightItem: right.raw,
    preferredKeepId: completenessScore(left) >= completenessScore(right) ? left.id : right.id,
  };
}

export async function detectDuplicateFindings({ items, newItemIds = [], ignoredPairKeys = [] }) {
  const list = (Array.isArray(items) ? items : [])
    .map(normalizeItemForDetection)
    .filter((item) => item.id && item.raw?.is_active !== false);

  if (list.length < 2) return [];

  const ignored = new Set(Array.isArray(ignoredPairKeys) ? ignoredPairKeys : []);
  const newIds = new Set((Array.isArray(newItemIds) ? newItemIds : []).map((id) => String(id)));

  const prepared = await Promise.all(
    list.map(async (item) => ({
      ...item,
      imageHash: await getImageHash(item.imageUrl),
    }))
  );

  const findings = [];

  for (let index = 0; index < prepared.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < prepared.length; compareIndex += 1) {
      const left = prepared[index];
      const right = prepared[compareIndex];
      const pairKey = makeDuplicatePairKey(left.id, right.id);
      if (ignored.has(pairKey)) continue;
      if (newIds.size > 0 && !newIds.has(left.id) && !newIds.has(right.id)) continue;

      const finding = compareItems(left, right);
      if (!finding) continue;
      findings.push(finding);
    }
  }

  return findings.sort((left, right) => right.score - left.score);
}

export function mergeDuplicateItems(keepItem, removeItem) {
  const keep = normalizeItemMetadata(keepItem);
  const remove = normalizeItemMetadata(removeItem);
  const keepFit = normalizeFitTag(keep.fit_tag || keep.fitTag || keep.fit);
  const removeFit = normalizeFitTag(remove.fit_tag || remove.fitTag || remove.fit);

  return normalizeItemMetadata({
    ...remove,
    ...keep,
    id: keep.id,
    name: (keep.name || remove.name || "").toString().trim(),
    category: keep.category || remove.category || "",
    color: (keep.color || remove.color || "").toString().trim(),
    fit_tag: keepFit !== "unknown" ? keepFit : removeFit,
    clothing_type: keep.clothing_type || remove.clothing_type || "",
    layer_type: keep.layer_type || remove.layer_type || "",
    is_one_piece: keep.is_one_piece === true || remove.is_one_piece === true,
    set_id: keep.set_id || remove.set_id || "",
    style_tags: uniqueList([...(keep.style_tags || []), ...(remove.style_tags || [])]),
    occasion_tags: uniqueList([...(keep.occasion_tags || []), ...(remove.occasion_tags || [])]),
    season_tags: uniqueList([...(keep.season_tags || []), ...(remove.season_tags || [])]),
    image_url: keep.image_url || remove.image_url || "",
    is_active: keep.is_active !== false || remove.is_active !== false,
    is_favorite: keep.is_favorite === true || remove.is_favorite === true,
  });
}

export function loadIgnoredDuplicateKeys(user) {
  try {
    const raw = localStorage.getItem(userKey(DUPLICATE_IGNORE_KEY, user));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.map((value) => String(value || "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveIgnoredDuplicateKeys(keys, user) {
  try {
    const safe = uniqueList((Array.isArray(keys) ? keys : []).map((value) => String(value || "")).filter(Boolean));
    localStorage.setItem(userKey(DUPLICATE_IGNORE_KEY, user), JSON.stringify(safe));
  } catch {}
}

export function clearIgnoredDuplicateKey(pairKey, user) {
  const current = loadIgnoredDuplicateKeys(user);
  const next = current.filter((value) => value !== pairKey);
  saveIgnoredDuplicateKeys(next, user);
  return next;
}

export function getDuplicateIgnoreStorageKey(user) {
  const id = getUserId(user);
  return id ? `${DUPLICATE_IGNORE_KEY}_${id}` : DUPLICATE_IGNORE_KEY;
}
