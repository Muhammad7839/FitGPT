import { useState, useEffect } from "react";
import { loadWardrobe, GUEST_WARDROBE_KEY, WARDROBE_KEY } from "../utils/userStorage";
import { EVT_WARDROBE_CHANGED } from "../utils/constants";

/**
 * Reactive wardrobe hook — returns the current wardrobe array and
 * automatically refreshes on user change, storage events, focus,
 * and custom wardrobe-changed events.
 */
export default function useWardrobe(user) {
  const [items, setItems] = useState(() => loadWardrobe(user));

  useEffect(() => {
    setItems(loadWardrobe(user));
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
