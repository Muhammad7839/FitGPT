export const LAYER_TYPE_OPTIONS = [
  { value: "", label: "Unspecified" },
  { value: "base", label: "Base Layer" },
  { value: "mid", label: "Mid Layer" },
  { value: "outer", label: "Outer Layer" },
];

export const STYLE_TAG_OPTIONS = [
  "casual",
  "formal",
  "smart casual",
  "relaxed",
  "lounge",
  "activewear",
  "social",
  "work",
];

export const OCCASION_TAG_OPTIONS = [
  "casual",
  "work",
  "formal",
  "athletic",
  "social",
  "lounge",
];

export const SEASON_TAG_OPTIONS = [
  "winter",
  "spring",
  "summer",
  "fall",
  "all-season",
];

export const CLOTHING_TYPE_OPTIONS = {
  Tops: ["t-shirt", "long sleeve shirt", "sweater", "hoodie", "dress shirt", "tank top", "polo", "blouse", "crop top", "turtleneck", "henley"],
  Bottoms: ["jeans", "pants", "cargo pants", "trousers", "chinos", "dress pants", "shorts", "skirt", "leggings", "joggers", "sweatpants", "wide-leg pants"],
  Outerwear: ["jacket", "coat", "blazer", "cardigan", "windbreaker", "parka", "puffer jacket", "trench coat", "hoodie"],
  Shoes: ["sneakers", "boots", "sandals", "dress shoes", "heels", "flats", "loafers", "slip-ons", "Chelsea boots"],
  Accessories: ["hat", "cap", "scarf", "watch", "belt", "jewelry", "sunglasses", "bag", "backpack", "gloves"],
  "One-Piece": ["dress", "jumpsuit", "overalls", "romper", "bodysuit", "maxi dress", "midi dress", "mini dress", "wrap dress"],
};

export function normalizeTagList(value) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(raw.map((x) => (x || "").toString().trim().toLowerCase()).filter(Boolean))];
}

export function optionLabel(value) {
  return (value || "")
    .toString()
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

export function clothingTypeOptionsForCategory(category) {
  return CLOTHING_TYPE_OPTIONS[category] || [];
}

export function normalizeItemMetadata(item) {
  const next = item && typeof item === "object" ? { ...item } : {};
  next.layer_type = (next.layer_type || "").toString().trim().toLowerCase();
  next.clothing_type = (next.clothing_type || "").toString().trim().toLowerCase();
  next.set_id = (next.set_id || "").toString().trim();
  next.is_one_piece = next.is_one_piece === true || next.is_one_piece === "true";
  next.style_tags = normalizeTagList(next.style_tags);
  next.occasion_tags = normalizeTagList(next.occasion_tags);
  next.season_tags = normalizeTagList(next.season_tags);
  return next;
}

export function mergeWardrobeMetadata(remoteItems, localItems) {
  const remote = Array.isArray(remoteItems) ? remoteItems : [];
  const local = (Array.isArray(localItems) ? localItems : []).map(normalizeItemMetadata);
  const remoteMap = new Map(remote.map((item) => [String(item?.id || ""), item]));
  const merged = [];
  const seen = new Set();

  for (const localItem of local) {
    const id = String(localItem?.id || "");
    if (!id) {
      merged.push(localItem);
      continue;
    }

    const remoteItem = remoteMap.get(id);
    if (!remoteItem) {
      merged.push(localItem);
      seen.add(id);
      continue;
    }

    merged.push(normalizeItemMetadata({
      ...remoteItem,
      layer_type: localItem.layer_type || remoteItem.layer_type,
      clothing_type: localItem.clothing_type || remoteItem.clothing_type,
      set_id: localItem.set_id || remoteItem.set_id,
      is_one_piece: localItem.is_one_piece || remoteItem.is_one_piece,
      style_tags: localItem.style_tags?.length ? localItem.style_tags : remoteItem.style_tags,
      occasion_tags: localItem.occasion_tags?.length ? localItem.occasion_tags : remoteItem.occasion_tags,
      season_tags: localItem.season_tags?.length ? localItem.season_tags : remoteItem.season_tags,
      image_url: localItem.image_url || remoteItem.image_url,
      fit_tag: localItem.fit_tag || remoteItem.fit_tag,
    }));
    seen.add(id);
  }

  for (const remoteItem of remote) {
    const id = String(remoteItem?.id || "");
    if (id && seen.has(id)) continue;
    merged.push(normalizeItemMetadata(remoteItem));
  }

  return merged;
}
