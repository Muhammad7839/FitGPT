import { apiFetch } from "./apiFetch";

export function buildChatContext(wardrobeItems, answers) {
  const items = Array.isArray(wardrobeItems) ? wardrobeItems : [];
  const compact = items
    .filter((x) => x && x.is_active !== false && String(x.is_active) !== "false")
    .map((x) => {
      const parts = [x.name, x.category, x.color].filter(Boolean);
      if (x.fit_tag && x.fit_tag !== "unknown" && x.fit_tag !== "unspecified") parts.push(x.fit_tag);
      if (x.clothing_type) parts.push(x.clothing_type);
      return parts.join(", ");
    })
    .filter(Boolean);
  const wardrobe_summary = compact.length
    ? `${compact.length} items:\n` + compact.map((line) => `- ${line}`).join("\n")
    : "";

  const prefParts = [];
  if (answers?.style?.length) prefParts.push(`Style: ${answers.style.join(", ")}`);
  if (answers?.comfort?.length) prefParts.push(`Comfort: ${answers.comfort.join(", ")}`);
  if (answers?.dressFor?.length) prefParts.push(`Occasions: ${answers.dressFor.join(", ")}`);
  if (answers?.bodyType) prefParts.push(`Body type: ${answers.bodyType}`);
  const preferences = prefParts.join(". ");

  if (!wardrobe_summary && !preferences) return null;
  return { wardrobe_summary, preferences };
}

export async function sendChatMessage(messages, context) {
  const body = { messages };
  if (context) body.context = context;
  return apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
