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

export function labelFromSource(src) {
  const s = (src || "").toString().trim().toLowerCase();
  if (s === "planner") return "Planned";
  if (s === "recommended") return "Recommended";
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

export function setReuseOutfit(itemIds, outfitId) {
  const items = normalizeItems(itemIds);
  if (!items.length) return;
  sessionStorage.setItem(
    REUSE_OUTFIT_KEY,
    JSON.stringify({ items, saved_outfit_id: outfitId || "" })
  );
}
