import { makeLocalStore } from "../utils/userStorage";
import { EVT_TRIP_PACKING_CHANGED, TRIP_PACKING_KEY } from "../utils/constants";
import { makeId } from "../utils/helpers";

const store = makeLocalStore(TRIP_PACKING_KEY, EVT_TRIP_PACKING_CHANGED);

function buildTripRecord(payload) {
  const now = new Date().toISOString();
  return {
    trip_id: makeId(),
    destination: payload?.destination || "",
    destination_label: payload?.destination_label || payload?.destination || "",
    start_date: payload?.start_date || "",
    end_date: payload?.end_date || "",
    trip_purpose: payload?.trip_purpose || "",
    luggage_mode: payload?.luggage_mode || "carry-on",
    activities: Array.isArray(payload?.activities) ? payload.activities : [],
    packing_groups: Array.isArray(payload?.packing_groups) ? payload.packing_groups : [],
    outfit_plan: Array.isArray(payload?.outfit_plan) ? payload.outfit_plan : [],
    forecast: payload?.forecast || { status: "fallback", days: [], message: "" },
    summary: payload?.summary || {},
    created_at: now,
    updated_at: now,
    archived_at: payload?.archived_at || "",
  };
}

export const tripPackingApi = {
  async listTrips(user) {
    const allTrips = store.read(user);
    return {
      trips: allTrips.filter((trip) => !trip?.archived_at),
      archivedTrips: allTrips.filter((trip) => !!trip?.archived_at),
    };
  },

  async createTrip(payload, user) {
    const record = buildTripRecord(payload);
    store.write([record, ...store.read(user)], user);
    return { created: true, trip: record };
  },

  async updateTrip(tripId, patch, user) {
    const current = store.read(user);
    let updatedTrip = null;
    const next = current.map((trip) => {
      if ((trip?.trip_id || "") !== tripId) return trip;
      updatedTrip = {
        ...trip,
        ...(patch || {}),
        updated_at: new Date().toISOString(),
      };
      return updatedTrip;
    });

    store.write(next, user);
    return { updated: !!updatedTrip, trip: updatedTrip };
  },

  async removeTrip(tripId, user) {
    const current = store.read(user);
    const next = current.map((trip) =>
      (trip?.trip_id || "") !== tripId
        ? trip
        : { ...trip, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    );
    store.write(next, user);
    return { deleted: true };
  },

  async restoreTrip(tripId, user) {
    const current = store.read(user);
    let restoredTrip = null;
    const next = current.map((trip) => {
      if ((trip?.trip_id || "") !== tripId) return trip;
      restoredTrip = { ...trip, archived_at: "", updated_at: new Date().toISOString() };
      return restoredTrip;
    });
    store.write(next, user);
    return { restored: !!restoredTrip, trip: restoredTrip };
  },
};
