/**
 * useReloadOnChange's mount check: false on the first call (the mount load is
 * useFocusEffect's), true on every later key change.
 */
export function createKeyGate(): () => boolean {
  let mounted = false;
  return () => {
    if (!mounted) {
      mounted = true;
      return false;
    }
    return true;
  };
}
