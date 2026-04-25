import { apiFetch } from "./apiFetch";

export async function scanReceipt(file) {
  if (!file) return null;

  const form = new FormData();
  form.append("image", file);

  try {
    return await apiFetch("/receipts/ocr", {
      method: "POST",
      body: form,
      timeoutMs: 45000,
    });
  } catch (error) {
    if (error?.code === "network_error") error.isNetwork = true;
    if (error?.code === "request_timeout") error.isTimeout = true;
    throw error;
  }
}
