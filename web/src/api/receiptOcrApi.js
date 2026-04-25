import { apiFetch } from "./apiFetch";

export async function scanReceipt(file) {
  if (!file) return null;
  const form = new FormData();
  form.append("image", file);
  const data = await apiFetch("/receipts/ocr", {
    method: "POST",
    body: form,
    timeoutMs: 45000,
  });
  return data || null;
}
