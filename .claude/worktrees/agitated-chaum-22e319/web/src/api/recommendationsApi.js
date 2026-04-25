import { apiFetch } from "./apiFetch";

function asStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry || "").toString().trim())
      .filter(Boolean);
  }

  if (value == null) return [];

  return value
    .toString()
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function fetchAIRecommendations(items, context) {
  const stripped = (Array.isArray(items) ? items : []).map((item) => ({
    id: (item?.id ?? "").toString(),
    name: item?.name || "",
    category: item?.category || "",
    color: item?.color || "",
    colors: asStringList(item?.colors || item?.color),
    fit_type: item?.fit_type || item?.fitType || "",
    fit_tag: item?.fit_tag || item?.fitTag || item?.fit || "",
    style_tag: item?.style_tag || item?.styleTag || "",
    style_tags: asStringList(item?.style_tags || item?.styleTags || item?.style_tag || item?.styleTag),
    clothing_type: item?.clothing_type || item?.clothingType || "",
    layer_type: item?.layer_type || item?.layerType || "",
    is_one_piece: Boolean(item?.is_one_piece ?? item?.isOnePiece),
    set_id: item?.set_id || item?.setId || "",
    occasion_tags: asStringList(item?.occasion_tags || item?.occasionTags),
    season_tags: asStringList(item?.season_tags || item?.seasonTags),
  }));

  const res = await apiFetch("/recommendations/ai", {
    method: "POST",
    body: JSON.stringify({
      items: stripped,
      context: context || {},
    }),
  });

  return res;
}
