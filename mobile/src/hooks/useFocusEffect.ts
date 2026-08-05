import { useEffect, useRef } from 'react';

/** Runs callback on mount and when `active` flips to true. */
export function useFocusEffect(callback: () => void | Promise<void>, active = true) {
  const cb = useRef(callback);
  cb.current = callback;

  useEffect(() => {
    if (!active) return;
    void cb.current();
  }, [active]);
}
