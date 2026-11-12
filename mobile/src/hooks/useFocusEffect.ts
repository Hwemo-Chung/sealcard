import { useEffect, useRef } from 'react';

import { guard } from '../domain/guard';

/**
 * Runs callback on mount and when `active` flips to true. A failing callback is
 * not an unhandled rejection (screens show their own error state).
 */
export function useFocusEffect(callback: () => void | Promise<void>, active = true) {
  const cb = useRef(callback);
  cb.current = callback;

  useEffect(() => {
    if (!active) return;
    void guard(() => cb.current());
  }, [active]);
}
