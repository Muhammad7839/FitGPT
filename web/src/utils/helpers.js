import { FIT_TAGS, REUSE_OUTFIT_KEY } from "./constants";

const FIT_TAG_SET = new Set(FIT_TAGS);

export function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function normalizeFitTag(raw) {
  const v = (raw || "").toString().trim().toLowerCase();
  if (!v) return "unknown";
  return FIT_TAG_SET.has(v) ? v : "unknown";
}

export const PROFILE_PIC_MAX_BYTES = 10 * 1024 * 1024;
export const PROFILE_GIF_MAX_BYTES = 3 * 1024 * 1024;

export function getProfilePicUploadIssue(file) {
  const type = (file?.type || "").toString().trim().toLowerCase();
  if (!type.startsWith("image/")) return "Please choose an image file.";

  const maxBytes = type === "image/gif" ? PROFILE_GIF_MAX_BYTES : PROFILE_PIC_MAX_BYTES;
  if (Number(file?.size || 0) <= maxBytes) return "";

  return type === "image/gif"
    ? "This GIF is too large. Please upload one under 3MB."
    : "This profile photo is too large. Please upload one under 10MB.";
}

export function fileToDataUrl(file, maxSize = 200) {
  if (file.type === "image/gif") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image"));
    };
    img.src = objectUrl;
  });
}

export function formatCardDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function buildWardrobeMap(wardrobe) {
  const map = new Map();
  for (const it of Array.isArray(wardrobe) ? wardrobe : []) {
    const id = (it?.id ?? "").toString().trim();
    if (id && !map.has(id)) map.set(id, it);
  }
  return map;
}

export function normalizeItems(items) {
  const cleaned = (Array.isArray(items) ? items : [])
    .map((x) => (x ?? "").toString().trim())
    .filter(Boolean);
  cleaned.sort();
  return cleaned;
}

export function idsSignature(ids) {
  return normalizeItems(ids).join("|");
}

export function formatPlanDate(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso || "";
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso || "";
  }
}

/** Build a Google Calendar event creation URL for a planned outfit. */
export function buildGoogleCalendarUrl({ date, occasion, itemNames }) {
  const names = Array.isArray(itemNames) ? itemNames.filter(Boolean) : [];
  const leadItems = names.slice(0, 2);
  const summary = leadItems.length >= 2 ? `${leadItems[0]} + ${leadItems[1]}` : "";
  const title = occasion
    ? (summary ? `FitGPT: ${occasion} - ${summary}` : `FitGPT: ${occasion}`)
    : (summary ? `FitGPT: Outfit Plan - ${summary}` : "FitGPT: Outfit Plan");
  const displayDate = date || new Date().toISOString().slice(0, 10);
  const details = [
    "Planned with FitGPT",
    `Date: ${displayDate}`,
    occasion ? `Occasion: ${occasion}` : "",
    names.length > 0 ? `Outfit:\n- ${names.join("\n- ")}` : "Outfit: Planned outfit from FitGPT",
  ].filter(Boolean).join("\n\n");

  // Google Calendar uses all-day format: YYYYMMDD/YYYYMMDD (next day for end)
  const d = (date || "").replace(/-/g, "");
  const start = d || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const end = (() => {
    const dt = new Date((date || new Date().toISOString().slice(0, 10)) + "T00:00:00");
    dt.setDate(dt.getDate() + 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${y}${m}${dd}`;
  })();

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function labelFromSource(src) {
  const s = (src || "").toString().trim().toLowerCase();
  if (s === "planner") return "Planned";
  if (s === "recommended" || s === "recommendation") return "Recommended";
  if (s === "history") return "History";
  if (s === "saved") return "Saved";
  return "Saved";
}

export function monthKey(dateInput) {
  if (dateInput == null || dateInput === "") return "";
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export function isNetworkError(e) {
  const msg = (e?.message || "").toString().toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
}

export function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function onTiltMove(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  const tiltX = -(y * 8);
  const tiltY = x * 8;
  el.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
}

export function onTiltLeave(e) {
  e.currentTarget.style.transform = "";
}

export function setReuseOutfit(itemIds, outfitId) {
  const items = normalizeItems(itemIds);
  if (!items.length) return;
  sessionStorage.setItem(
    REUSE_OUTFIT_KEY,
    JSON.stringify({ items, saved_outfit_id: outfitId || "" })
  );
}
