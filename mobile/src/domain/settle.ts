/**
 * Resolve with the promise's value if it settles within `ms`, else `fallback`.
 * Rejections also yield `fallback`. Never rejects.
 */
export function settleWithin<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);
    p.then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export type LocationCaptureInput = {
  /** Location stamp toggle at shutter time */
  enabled: boolean;
  /** Place label already resolved (null = none yet / none found) */
  resolved: string | null;
  /** In-flight lookup, null when no lookup is running */
  pending: Promise<string | null> | null;
  /** Max wait after the shutter for an in-flight lookup */
  waitMs: number;
  /**
   * Label of the recent (last-known) position if already geocoded. Used, without
   * further waiting, when the wait runs out before the lookup settles.
   */
  recent?: () => string | null;
};

/**
 * Place label to stamp for a capture; waits (bounded) for a running lookup, then
 * falls back to the recent-position label if one is ready.
 */
export async function locationForCapture({
  enabled,
  resolved,
  pending,
  waitMs,
  recent,
}: LocationCaptureInput): Promise<string | null> {
  if (!enabled) return null;
  if (resolved != null) return resolved;
  if (!pending) return null;
  const label = await settleWithin(pending, waitMs, null);
  return label ?? recent?.() ?? null;
}
