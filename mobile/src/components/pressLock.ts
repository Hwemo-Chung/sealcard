/**
 * Press props for a control that must not act while something is busy (camera
 * chips while the shutter waits, picker rows while a seal saves, retake while the
 * preview is captured). `disabled` and `onPress` come together, so a call site
 * cannot keep the handler and lose the lock; the handler also re-checks.
 */
export function pressLock(
  busy: boolean,
  onPress: () => void,
): { onPress: () => void; disabled: boolean } {
  return {
    disabled: busy,
    onPress: () => {
      if (!busy) onPress();
    },
  };
}
