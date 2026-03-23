import { apiFetch, hasApi } from "./apiFetch";

const PATHS = {
  list: "/wardrobe/items",
  create: "/wardrobe/items",
  update: (id) => `/wardrobe/items/${id}`,
  remove: (id) => `/wardrobe/items/${id}`,
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
    fd.append(k, String(v));
  });

  if (payload?.imageFile) {
    fd.append("image", payload.imageFile);
  }

  return fd;
}

export const wardrobeApi = {
  async getItems() {
    ensureApi();
    return apiFetch(PATHS.list, { method: "GET" });
  },

  async createItem(payload) {
    ensureApi();

    const hasFile = !!payload?.imageFile;
    if (hasFile) {
      const body = toFormData(payload);
      return apiFetch(PATHS.create, { method: "POST", body });
    }

    return apiFetch(PATHS.create, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateItem(id, payload) {
    ensureApi();
    if (!isServerItemId(id)) return null;

    const hasFile = !!payload?.imageFile;
    if (hasFile) {
      const body = toFormData(payload);
      return apiFetch(PATHS.update(id), { method: "PUT", body });
    }

    return apiFetch(PATHS.update(id), {
      method: "PUT",
      body: JSON.stringify(payload),
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
    return apiFetch(PATHS.update(id), {
      method: "PUT",
      body: JSON.stringify({ is_favorite }),
    });
  },

  async archiveItem(id) {
    ensureApi();
    if (!isServerItemId(id)) return null;
    return apiFetch(PATHS.update(id), {
      method: "PUT",
      body: JSON.stringify({ is_active: false }),
    });
  },

  async unarchiveItem(id) {
    ensureApi();
    if (!isServerItemId(id)) return null;
    return apiFetch(PATHS.update(id), {
      method: "PUT",
      body: JSON.stringify({ is_active: true }),
    });
  },
};