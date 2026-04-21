import { classifyFromUrl } from "./classifyClothing";
import {
  CLOTHING_TYPE_OPTIONS,
  STYLE_TAG_OPTIONS,
  OCCASION_TAG_OPTIONS,
  SEASON_TAG_OPTIONS,
} from "./wardrobeOptions";

const COLOR_SWATCHES = [
  { name: "Black", rgb: [26, 26, 26] },
  { name: "White", rgb: [245, 245, 245] },
  { name: "Gray", rgb: [156, 163, 175] },
  { name: "Beige", rgb: [212, 197, 169] },
  { name: "Brown", rgb: [146, 64, 14] },
  { name: "Navy", rgb: [30, 58, 95] },
  { name: "Blue", rgb: [59, 130, 246] },
  { name: "Green", rgb: [34, 197, 94] },
  { name: "Olive", rgb: [101, 163, 13] },
  { name: "Yellow", rgb: [234, 179, 8] },
  { name: "Orange", rgb: [249, 115, 22] },
  { name: "Red", rgb: [220, 38, 38] },
  { name: "Pink", rgb: [236, 72, 153] },
  { name: "Purple", rgb: [168, 85, 247] },
  { name: "Gold", rgb: [217, 119, 6] },
  { name: "Silver", rgb: [192, 192, 192] },
  { name: "Burgundy", rgb: [127, 29, 29] },
  { name: "Teal", rgb: [20, 184, 166] },
  { name: "Cream", rgb: [255, 248, 220] },
  { name: "Charcoal", rgb: [55, 65, 81] },
];

const TYPE_SYNONYMS = {
  "t-shirt": ["tshirt", "tee", "tee shirt"],
  "long sleeve shirt": ["long sleeve", "longsleeve"],
  sweater: ["jumper", "knit", "pullover"],
  hoodie: ["hooded"],
  "dress shirt": ["button up", "button-up", "buttondown", "button down"],
  "tank top": ["tank", "cami", "camisole"],
  polo: ["golf shirt"],
  blouse: ["top"],
  jeans: ["denim", "jean"],
  "dress pants": ["trousers", "slacks"],
  shorts: ["short"],
  skirt: ["mini skirt", "midi skirt", "maxi skirt"],
  leggings: ["tights"],
  joggers: ["track pants"],
  sweatpants: ["sweats"],
  jacket: ["bomber", "zip jacket"],
  coat: ["overcoat", "trench", "pea coat", "peacoat"],
  blazer: ["suit jacket"],
  cardigan: ["open knit"],
  windbreaker: ["shell jacket"],
  parka: ["puffer", "anorak"],
  sneakers: ["trainer", "running shoe"],
  boots: ["boot"],
  sandals: ["slides", "flip flops", "flip-flops"],
  "dress shoes": ["oxford", "loafer", "derby"],
  heels: ["pump", "stiletto"],
  flats: ["ballet flat"],
  hat: ["cap", "beanie"],
  scarf: ["shawl"],
  watch: ["timepiece"],
  belt: [],
  jewelry: ["jewellery", "necklace", "bracelet", "earring", "ring"],
  sunglasses: ["glasses", "shades"],
  bag: ["purse", "handbag", "tote", "backpack"],
};

const STYLE_RULES = [
  { match: ["blazer", "dress shirt", "dress pants", "dress shoes", "heels"], style: "formal" },
  { match: ["blazer", "dress shirt", "dress pants", "blouse", "flats"], style: "work" },
  { match: ["hoodie", "joggers", "leggings", "sweatpants", "sneakers", "tank top"], style: "activewear" },
  { match: ["hoodie", "cardigan", "joggers", "sweatpants"], style: "relaxed" },
  { match: ["hoodie", "sweatpants", "joggers"], style: "lounge" },
  { match: ["t-shirt", "long sleeve shirt", "jeans", "shorts", "sneakers", "sandals"], style: "casual" },
  { match: ["blouse", "skirt", "flats", "heels", "jewelry", "bag"], style: "smart casual" },
  { match: ["jewelry", "bag", "heels", "blouse"], style: "social" },
];

const OCCASION_RULES = [
  { match: ["blazer", "dress shirt", "dress pants", "dress shoes", "blouse"], occasion: "work" },
  { match: ["dress shoes", "heels", "blazer", "jewelry"], occasion: "formal" },
  { match: ["hoodie", "sweatpants", "joggers", "cardigan"], occasion: "lounge" },
  { match: ["sneakers", "leggings", "joggers", "tank top"], occasion: "athletic" },
  { match: ["heels", "jewelry", "bag", "skirt", "blouse"], occasion: "social" },
  { match: ["t-shirt", "jeans", "shorts", "sandals", "hat"], occasion: "casual" },
];

const WINTER_TYPES = new Set(["sweater", "hoodie", "coat", "cardigan", "parka", "boots", "scarf"]);
const SUMMER_TYPES = new Set(["tank top", "shorts", "sandals", "skirt"]);
const ALL_SEASON_TYPES = new Set(["t-shirt", "long sleeve shirt", "polo", "blouse", "jeans", "dress pants", "sneakers", "watch", "belt", "bag"]);
const DARK_COLORS = new Set(["Black", "Navy", "Charcoal", "Brown", "Burgundy"]);
const LIGHT_COLORS = new Set(["White", "Cream", "Beige", "Yellow", "Pink"]);

function uniqueList(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function normalizeText(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ");
}

function tokenize(...values) {
  const joined = values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");
  const tokens = joined.split(/\s+/).filter(Boolean);
  return {
    text: joined,
    tokens: new Set(tokens),
  };
}

function keywordMatches(text, tokens, keyword) {
  const normalized = normalizeText(keyword);
  if (!normalized) return false;
  if (normalized.includes(" ")) return text.includes(normalized);
  return tokens.has(normalized);
}

function inferClothingType(category, haystackText, tokenSet) {
  const options = CLOTHING_TYPE_OPTIONS[category] || [];

  for (const option of options) {
    const keywords = [option, ...(TYPE_SYNONYMS[option] || [])];
    if (keywords.some((keyword) => keywordMatches(haystackText, tokenSet, keyword))) {
      return option;
    }
  }

  return "";
}

function rgbDistance(a, b) {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { hue: 0, saturation: 0, lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  switch (max) {
    case rn:
      hue = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
      break;
    case gn:
      hue = ((bn - rn) / delta + 2) * 60;
      break;
    default:
      hue = ((rn - gn) / delta + 4) * 60;
      break;
  }

  return { hue, saturation, lightness };
}

function namedColorFromRgb(r, g, b) {
  const { hue, saturation, lightness } = rgbToHsl(r, g, b);

  if (lightness <= 0.14) return "Black";
  if (lightness >= 0.94 && saturation <= 0.08) return "White";

  if (saturation <= 0.12) {
    if (lightness <= 0.28) return "Charcoal";
    if (lightness >= 0.82) return "Silver";
    return "Gray";
  }

  if (lightness >= 0.9 && hue >= 30 && hue <= 70) return "Cream";

  let best = COLOR_SWATCHES[0];
  let bestDistance = Infinity;
  for (const swatch of COLOR_SWATCHES) {
    const distance = rgbDistance([r, g, b], swatch.rgb);
    if (distance < bestDistance) {
      best = swatch;
      bestDistance = distance;
    }
  }

  return best.name;
}

async function extractSuggestedColors(imageUrl) {
  if (!imageUrl) return [];

  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Image load failed"));
    element.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const maxSize = 48;
  const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const counts = new Map();

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3];
    if (alpha < 150) continue;

    const colorName = namedColorFromRgb(data[index], data[index + 1], data[index + 2]);
    counts.set(colorName, (counts.get(colorName) || 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return [];

  const [primary, secondary] = ranked;
  const topColors = [primary[0]];

  if (secondary && secondary[1] / primary[1] >= 0.28) {
    topColors.push(secondary[0]);
  }

  return uniqueList(topColors).slice(0, 2);
}

function limitTags(options, values, count) {
  const allowed = new Set(options);
  return uniqueList(values).filter((value) => allowed.has(value)).slice(0, count);
}

function inferStyleTags(type, haystackText, tokenSet) {
  const matches = STYLE_RULES
    .filter((rule) => rule.match.some((keyword) => keywordMatches(haystackText, tokenSet, keyword) || keyword === type))
    .map((rule) => rule.style);

  if (!matches.length) matches.push("casual");
  return limitTags(STYLE_TAG_OPTIONS, matches, 2);
}

function inferOccasionTags(type, haystackText, tokenSet, styleTags) {
  const matches = OCCASION_RULES
    .filter((rule) => rule.match.some((keyword) => keywordMatches(haystackText, tokenSet, keyword) || keyword === type))
    .map((rule) => rule.occasion);

  if (styleTags.includes("work")) matches.push("work");
  if (styleTags.includes("formal")) matches.push("formal");
  if (styleTags.includes("activewear")) matches.push("athletic");
  if (styleTags.includes("lounge") || styleTags.includes("relaxed")) matches.push("lounge");

  if (!matches.length) matches.push("casual");
  return limitTags(OCCASION_TAG_OPTIONS, matches, 2);
}

function inferSeasonTags(type, colors, haystackText, tokenSet) {
  const matches = [];

  if (WINTER_TYPES.has(type) || keywordMatches(haystackText, tokenSet, "wool") || keywordMatches(haystackText, tokenSet, "thermal")) {
    matches.push("fall", "winter");
  }

  if (SUMMER_TYPES.has(type) || keywordMatches(haystackText, tokenSet, "linen")) {
    matches.push("spring", "summer");
  }

  if (!matches.length && ALL_SEASON_TYPES.has(type)) {
    matches.push("all-season");
  }

  if (!matches.length && colors.some((color) => DARK_COLORS.has(color))) {
    matches.push("fall", "winter");
  }

  if (!matches.length && colors.some((color) => LIGHT_COLORS.has(color))) {
    matches.push("spring", "summer");
  }

  if (!matches.length) matches.push("all-season");
  return limitTags(SEASON_TAG_OPTIONS, matches, 2);
}

function buildStatusMessage(status) {
  if (status === "ready") {
    return "We filled in suggested tags from your photo. You can edit anything before saving.";
  }
  if (status === "partial") {
    return "We suggested what we could. You can fill in anything missing before saving.";
  }
  return "We couldn't generate tags. Please add them manually.";
}

export async function generateItemTagSuggestions({
  imageUrl = "",
  fileName = "",
  fallbackCategory = "Tops",
}) {
  let category = fallbackCategory;
  let classifierLabel = "";
  let classifierType = "";

  try {
    const classification = await classifyFromUrl(imageUrl);
    if (classification?.category) category = classification.category;
    if (classification?.label) classifierLabel = classification.label;
    if (classification?.type) classifierType = classification.type;
  } catch {}

  const { text, tokens } = tokenize(fileName, classifierLabel);
  const options = CLOTHING_TYPE_OPTIONS[category] || [];
  const typeFromClassifier = options.includes(classifierType) ? classifierType : "";
  const clothingType = typeFromClassifier || inferClothingType(category, text, tokens);

  let colors = [];
  try {
    colors = await extractSuggestedColors(imageUrl);
  } catch {}

  const styleTags = inferStyleTags(clothingType, text, tokens);
  const occasionTags = inferOccasionTags(clothingType, text, tokens, styleTags);
  const seasonTags = inferSeasonTags(clothingType, colors, text, tokens);

  const color = colors.join(", ");
  const filledCount = [color, clothingType, styleTags.length, occasionTags.length, seasonTags.length]
    .filter((value) => (typeof value === "number" ? value > 0 : !!value))
    .length;

  const status = filledCount === 0 ? "error" : filledCount === 5 ? "ready" : "partial";

  return {
    category,
    suggestions: {
      color,
      clothingType,
      styleTags,
      occasionTags,
      seasonTags,
    },
    label: classifierLabel,
    status,
    message: buildStatusMessage(status),
    suggestedCount: filledCount,
  };
}
