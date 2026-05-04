import { apiFetch, hasApi } from "./apiFetch";

const PATHS = {
  list: "/wardrobe/items",
  create: "/wardrobe/items",
  update: (id) => `/wardrobe/items/${id}`,
  remove: (id) => `/wardrobe/items/${id}`,
  favorite: (id) => `/wardrobe/items/${id}/favorite`,
};

function isServerItemId(id) {
  const text = `${id ?? ""}`.trim();
  return /^\d+$/.test(text);
}

function ensureApi() {
  if (!hasApi()) throw new Error("API base URL is missing.");
}

function toBackendPayload(payload) {
  const backendPayload = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (key === "image_url" || key === "imageFile") return;
    backendPayload[key] = value;
  });
  return backendPayload;
}

/** Merge API JSON responses with client-side image data (never persist Render-local /uploads URLs). */
function mergeItemResponse(response, payload) {
  if (response == null || typeof response !== "object") return response;
  const merged = { ...response };
  const localUrl = payload?.image_url;
  if (localUrl !== undefined && localUrl !== null) {
    merged.image_url = String(localUrl).trim();
  } else if (payload?.imageFile != null) {
    merged.image_url = "";
  }
  return merged;
}

export const wardrobeApi = {
  async getItems(fetchOptions = {}) {
    ensureApi();
    const response = await apiFetch(`${PATHS.list}?limit=200&offset=0`, {
      method: "GET",
      ...fetchOptions,
    });
    if (Array.isArray(response)) return response;
    return Array.isArray(response?.items) ? response.items : [];
  },

  async createItem(payload) {
    ensureApi();
    const backendPayload = toBackendPayload(payload);

    const response = await apiFetch(PATHS.create, {
      method: "POST",
      body: JSON.stringify(backendPayload),
    });
    return mergeItemResponse(response, payload);
  },

  async updateItem(id, payload) {
    ensureApi();
    if (!isServerItemId(id)) return null;
    const backendPayload = toBackendPayload(payload);

    const response = await apiFetch(PATHS.update(id), {
      method: "PUT",
      body: JSON.stringify(backendPayload),
    });
    return mergeItemResponse(response, payload);
  },

  async deleteItem(id) {
    ensureApi();
    if (!isServerItemId(id)) return null;
    return apiFetch(PATHS.remove(id), { method: "DELETE" });
  },

  async setFavorite(id, is_favorite) {
    ensureApi();
    if (!isServerItemId(id)) return null;
    return apiFetch(PATHS.favorite(id), {
      method: "POST",
      body: JSON.stringify({ is_favorite }),
    });
  },

  async archiveItem(id) {
    ensureApi();
    if (!isServerItemId(id)) return null;
    return apiFetch(PATHS.update(id), {
      method: "PUT",
      body: JSON.stringify({ is_archived: true }),
    });
  },

  async unarchiveItem(id) {
    ensureApi();
    if (!isServerItemId(id)) return null;
    return apiFetch(PATHS.update(id), {
      method: "PUT",
      body: JSON.stringify({ is_archived: false }),
    });
  },
};
