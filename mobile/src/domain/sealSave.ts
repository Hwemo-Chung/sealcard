/**
 * A seal save (view-shot capture + repository write) that has not settled after
 * this long is treated as stuck: Cancel and back work again, Done stays locked.
 */
export const SEAL_STALL_MS = 20000;

/**
 * - `saving`: back is swallowed, Cancel disabled, Done spinning.
 * - `stalled`: save outlived SEAL_STALL_MS; Cancel/back leave to the binder list,
 *   Done stays disabled (the save may still land, so it must not run twice).
 * - `idle`: nothing running (also after a failure, which allows a retry).
 */
export type SealPhase = 'idle' | 'saving' | 'stalled';

export type SealSaveHooks<T> = {
  phase: (phase: SealPhase) => void;
  /** Save finished while the picker is still shown (also after a stall). */
  done: (result: T) => void;
  /** Save failed while the picker is still shown; Done may retry. */
  failed: () => void;
  /**
   * Save settled after the picker was left (dispose, e.g. Cancel after a stall).
   * The picker is gone, so the caller reports it at App level (toast + refresh).
   */
  late?: (outcome: LateSealResult<T>) => void;
};

export type LateSealResult<T> = { ok: true; result: T } | { ok: false };

export type SealSave = {
  /** Start a save; false (ignored) while an earlier save has not failed. */
  start: <T>(save: () => Promise<T>, hooks: SealSaveHooks<T>) => boolean;
  /** Picker left the screen: only `late` runs after this (a late result never navigates). */
  dispose: () => void;
};

/**
 * One binder-picker save at a time, with a stall watchdog. The lock is released
 * only by a failure (nothing was sealed); a stall keeps it, so a late-finishing
 * first save and a retry can never seal the same capture twice.
 */
export function createSealSave(stallMs: number = SEAL_STALL_MS): SealSave {
  let locked = false;
  let active = true;
  let stalled = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  const stopWatchdog = () => {
    if (watchdog != null) clearTimeout(watchdog);
    watchdog = null;
  };

  return {
    start(save, hooks) {
      if (locked || !active) return false;
      locked = true;
      stalled = false;
      hooks.phase('saving');
      watchdog = setTimeout(() => {
        watchdog = null;
        stalled = true;
        if (active) hooks.phase('stalled');
      }, stallMs);

      let pending: ReturnType<typeof save>;
      try {
        pending = save();
      } catch (e) {
        pending = Promise.reject(e);
      }
      void pending.then(
        (result) => {
          stopWatchdog();
          if (!active) {
            hooks.late?.({ ok: true, result });
            return;
          }
          // Busy again after a stall, so back stays swallowed until the next screen is up.
          if (stalled) hooks.phase('saving');
          hooks.done(result);
        },
        () => {
          stopWatchdog();
          locked = false;
          if (!active) {
            hooks.late?.({ ok: false });
            return;
          }
          hooks.phase('idle');
          hooks.failed();
        },
      );
      return true;
    },
    dispose() {
      active = false;
      stopWatchdog();
    },
  };
}
