import { useState, useEffect } from "react";
import { loadWardrobe, saveWardrobe, mergeWardrobeWithLocalMetadata, GUEST_WARDROBE_KEY, WARDROBE_KEY } from "../utils/userStorage";
import { wardrobeApi } from "../api/wardrobeApi";
import { EVT_WARDROBE_CHANGED } from "../utils/constants";

/**
 * Reactive wardrobe hook — returns the current wardrobe array and
 * automatically refreshes on user change, storage events, focus,
 * and custom wardrobe-changed events.
 *
 * When local storage is empty but the user is signed in, attempts
 * a one-time API fetch so Dashboard and other consumers see items
 * that only exist server-side.
 */
export default function useWardrobe(user) {
  const [items, setItems] = useState(() => loadWardrobe(user));

  useEffect(() => {
    let alive = true;
    const local = loadWardrobe(user);
    setItems(local);

    // If local is empty and user is signed in, try the API
    if (local.length === 0 && user) {
      wardrobeApi.getItems()
        .then((data) => {
          if (!alive) return;
          const apiItems = Array.isArray(data) ? data : [];
          if (apiItems.length > 0) {
            const merged = mergeWardrobeWithLocalMetadata(apiItems, local);
            setItems(merged);
            saveWardrobe(merged, user);
          }
        })
        .catch(() => {});
    }

    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    const refresh = () => setItems(loadWardrobe(user));

    const onStorage = (e) => {
      if (
        e.key?.startsWith(WARDROBE_KEY) ||
        e.key?.startsWith(GUEST_WARDROBE_KEY)
      )
        refresh();
    };

    const onFocus = () => refresh();
    const onGuestWardrobeChanged = () => refresh();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener(EVT_WARDROBE_CHANGED, onGuestWardrobeChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(EVT_WARDROBE_CHANGED, onGuestWardrobeChanged);
    };
  }, [user]);

  return items;
}
