import { apiFetch } from "./apiFetch";

/**
 * Fetch AI-powered outfit recommendations from the backend.
 *
 * @param {Array} items  - Wardrobe items (image_url stripped before sending)
 * @param {Object} context - { weather_category, time_category, occasion, body_type, style_preferences }
 * @returns {{ source: string, outfits: Array }} or throws on network error
 */
export async function fetchAIRecommendations(items, context) {
  const stripped = (Array.isArray(items) ? items : []).map((item) => ({
    id: (item?.id ?? "").toString(),
    name: item?.name || "",
    category: item?.category || "",
    color: item?.color || "",
    fit_type: item?.fit_type || item?.fitType || "",
    style_tag: item?.style_tag || item?.styleTag || "",
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
