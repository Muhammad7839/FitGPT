// web/src/api/wardrobeApi.js
const BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();

  return res.text();
}

export async function uploadWardrobeItem(payload) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("category", payload.category);
  form.append("color", payload.color);
  form.append("image", payload.imageFile);

  if (payload.tags && Array.isArray(payload.tags)) {
    form.append("tags", JSON.stringify(payload.tags));
  }
  if (payload.size) form.append("size", payload.size);
  if (payload.notes) form.append("notes", payload.notes);

  return request("/wardrobe", {
    method: "POST",
    body: form,
    // do not set Content-Type manually for FormData
  });
}

export async function deleteWardrobeItem(id) {
  return request(`/wardrobe/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listWardrobeItems() {
  return request("/wardrobe", {
    method: "GET",
  });
}