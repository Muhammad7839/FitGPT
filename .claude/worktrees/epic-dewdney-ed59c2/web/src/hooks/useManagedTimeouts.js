import { useCallback, useEffect, useRef } from "react";

export default function useManagedTimeouts() {
  const pending = useRef(new Set());

  const set = useCallback((fn, ms) => {
    const id = window.setTimeout(() => {
      pending.current.delete(id);
      fn();
    }, ms);
    pending.current.add(id);
    return id;
  }, []);

  const clear = useCallback((id) => {
    if (id == null) return;
    pending.current.delete(id);
    window.clearTimeout(id);
  }, []);

  useEffect(() => () => {
    pending.current.forEach((id) => window.clearTimeout(id));
    pending.current.clear();
  }, []);

  return { set, clear };
}
