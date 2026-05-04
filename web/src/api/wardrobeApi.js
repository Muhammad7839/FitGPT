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

function toFormData(payload) {
  const fd = new FormData();

  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "imageFile") return;
    if (k === "image_url") return;
    fd.append(k, String(v));
  });

  if (payload?.imageFile) {
    fd.append("image", payload.imageFile);
  }

  return fd;
}

function toBackendPayload(payload) {
  const backendPayload = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (key === "image_url" || key === "imageFile") return;
    backendPayload[key] = value;
  });
  return backendPayload;
}

export const wardrobeApi = {
  async getItems() {
    ensureApi();
    const response = await apiFetch(`${PATHS.list}?limit=200&offset=0`, { method: "GET" });
    if (Array.isArray(response)) return response;
    return Array.isArray(response?.items) ? response.items : [];
  },

  async createItem(payload) {
    ensureApi();
    const backendPayload = toBackendPayload(payload);

    const hasFile = !!backendPayload?.imageFile;
    if (hasFile) {
      const body = toFormData(backendPayload);
      return apiFetch(PATHS.create, { method: "POST", body });
    }

    return apiFetch(PATHS.create, {
      method: "POST",
      body: JSON.stringify(backendPayload),
    });
  },

  async updateItem(id, payload) {
    ensureApi();
    if (!isServerItemId(id)) return null;
    const backendPayload = toBackendPayload(payload);

    const hasFile = !!backendPayload?.imageFile;
    if (hasFile) {
      const body = toFormData(backendPayload);
      return apiFetch(PATHS.update(id), { method: "PUT", body });
    }

    return apiFetch(PATHS.update(id), {
      method: "PUT",
      body: JSON.stringify(backendPayload),
    });
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
