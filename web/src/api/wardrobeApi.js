// web/src/api/wardrobeApi.js
import { apiFetch, hasApi } from "./apiFetch";

const PATHS = {
  list: "/wardrobe/items",
  create: "/wardrobe/items",
  update: (id) => `/wardrobe/items/${id}`,
  remove: (id) => `/wardrobe/items/${id}`,
};

function ensureApi() {
  if (!hasApi()) throw new Error("API base URL is missing.");
}

export const wardrobeApi = {
  async getItems() {
    ensureApi();
    return apiFetch(PATHS.list, { method: "GET" });
  },

  async createItem(payload) {
    ensureApi();
    return apiFetch(PATHS.create, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateItem(id, payload) {
    ensureApi();
    return apiFetch(PATHS.update(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteItem(id) {
    ensureApi();
    return apiFetch(PATHS.remove(id), { method: "DELETE" });
  },
};