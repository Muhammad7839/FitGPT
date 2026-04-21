import { apiFetch } from "./apiFetch";

export async function lookupProduct(code) {
  const trimmed = (code || "").toString().trim();
  if (!trimmed) return null;
  try {
    const data = await apiFetch("/product-lookup", {
      method: "POST",
      body: JSON.stringify({ code: trimmed }),
    });
    return data || null;
  } catch {
    return null;
  }
}
