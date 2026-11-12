import { useEffect, useRef, useState } from 'react';

import { guard } from '../domain/guard';
import { createKeyGate } from './reloadGate';

/**
 * Re-runs `callback` whenever `key` changes after mount (the mount load is
 * useFocusEffect's). App bumps the key when data changed behind the screen, e.g. a
 * seal that finished after the user left the binder picker. A failing callback
 * is not an unhandled rejection (screens show their own error state).
 */
export function useReloadOnChange(key: unknown, callback: () => void | Promise<void>) {
  const cb = useRef(callback);
  cb.current = callback;
  const [changed] = useState(createKeyGate);

  useEffect(() => {
    if (!changed()) return;
    void guard(() => cb.current());
  }, [key, changed]);
}
