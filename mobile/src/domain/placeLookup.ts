import { locationForCapture, settleWithin } from './settle';

/**
 * Wait for a fresh fix before the lookup's final label falls back to the recent
 * position. A cold GPS often needs several seconds; a shorter limit dropped the
 * stamp whenever no recent position existed. The recent position is queried in
 * parallel from the start (PlaceLookup.recentLabel), so a shutter whose wait runs
 * out before this limit still stamps it; a fresh label landing later only fills a
 * preview that has no place yet (navigation/lateLocation).
 */
export const CURRENT_FIX_TIMEOUT_MS = 8000;
/**
 * Fix + recent fallback + reverse geocode (permission dialog time not counted).
 * Must stay ≥ CURRENT_FIX_TIMEOUT_MS and leave time to geocode a late fix.
 */
export const LOOKUP_TIMEOUT_MS = 12000;
/** Last known fix is acceptable for a place-name stamp (city · district). */
export const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;
/**
 * Max wait after the shutter for a fresh fix (shutter stays responsive). When it
 * runs out, the recent-position label is stamped if it is already geocoded.
 */
export const LOCATION_WAIT_AFTER_SHUTTER_MS = 4000;
/**
 * A place lookup that started longer ago than this is not stamped: the shutter
 * restarts it (and waits as for a fresh one). Its fresh-fix place is then at most
 * 5 min old; with the 10-min last-known fallback, at most 15 min.
 */
export const PLACE_MAX_AGE_MS = 5 * 60 * 1000;

export type Coords = { latitude: number; longitude: number };

export type PlaceParts = {
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  district?: string | null;
  street?: string | null;
  name?: string | null;
};

/** Platform location calls, injected so the timing logic stays testable. */
export type PlaceSources = {
  /** Foreground location permission (dialog time is not counted in any limit). Omitted = granted. */
  permission?: () => Promise<boolean>;
  currentFix: () => Promise<Coords | null>;
  /** Last known fix no older than LAST_KNOWN_MAX_AGE_MS, or null. */
  lastKnownFix: () => Promise<Coords | null>;
  reverseGeocode: (coords: Coords) => Promise<PlaceParts[]>;
};

/** "City · District" label from a geocoded address, or null if it has no usable part. */
export function formatPlace(p: PlaceParts | undefined): string | null {
  if (!p) return null;
  const city = p.city ?? p.subregion ?? p.region ?? null;
  const detail = p.district ?? p.street ?? p.name ?? null;
  if (city && detail && detail !== city) return `${city} · ${detail}`;
  if (city) return city;
  if (detail) return detail;
  return null;
}

export type PlaceLookup = {
  /**
   * Fresh-fix label (waits up to CURRENT_FIX_TIMEOUT_MS), else the recent-position
   * label, else null. Settles within LOOKUP_TIMEOUT_MS after the permission step.
   * Never rejects.
   */
  label: Promise<string | null>;
  /**
   * First place available: the recent-position label if it is geocoded before
   * `label` settles, else `label`. Fills a preview that opened without a place.
   */
  firstLabel: Promise<string | null>;
  /**
   * Recent-position label once it is geocoded, else null. Synchronous so the
   * shutter can stamp it the moment its wait runs out, with no further wait.
   */
  recentLabel: () => string | null;
};

async function labelAt(src: PlaceSources, pos: Coords | null): Promise<string | null> {
  if (!pos) return null;
  const places = await src.reverseGeocode(pos);
  return formatPlace(places[0]);
}

/** Call now (timers start at once); a synchronous throw becomes a rejection. */
function attempt<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return fn();
  } catch (e) {
    return Promise.reject(e);
  }
}

/** Start a place lookup: fresh fix and recent position run in parallel from t=0. */
export function startPlaceLookup(src: PlaceSources): PlaceLookup {
  let recent: string | null = null;
  let onRecent: (label: string) => void = () => {};
  /** Resolves only with a non-null recent label. */
  const recentFound = new Promise<string>((resolve) => {
    onRecent = resolve;
  });

  const run = async (): Promise<string | null> => {
    if (src.permission && !(await attempt(src.permission).catch(() => false))) return null;
    // Catch at creation: a failing recent lookup must not surface as an unhandled rejection.
    const recentLabel = attempt(src.lastKnownFix)
      .then((pos) => labelAt(src, pos))
      .catch(() => null);
    void recentLabel.then((label) => {
      recent = label;
      if (label != null) onRecent(label);
    });
    const freshOrRecent = async () => {
      const current = await settleWithin<Coords | null>(
        attempt(src.currentFix),
        CURRENT_FIX_TIMEOUT_MS,
        null,
      );
      const fresh = current ? await labelAt(src, current).catch(() => null) : null;
      return fresh ?? (await recentLabel);
    };
    return settleWithin(freshOrRecent(), LOOKUP_TIMEOUT_MS, null);
  };

  const label = run().catch(() => null);
  return {
    label,
    firstLabel: Promise.race([recentFound, label]),
    recentLabel: () => recent,
  };
}

/**
 * Place label within LOOKUP_TIMEOUT_MS. Null when no fix (current or recent),
 * geocode empty or failing, or the whole lookup runs out of time. Never rejects.
 */
export function lookupPlaceLabel(src: PlaceSources): Promise<string | null> {
  return startPlaceLookup(src).label;
}

export type ShutterPlace = {
  /** Place stamped on the preview: fresh fix within the wait, else the recent position. */
  locationLabel: string | null;
  /** When nothing was stamped: the lookup's first place, to fill the preview later. */
  locationPending: Promise<string | null> | null;
};

/**
 * What the camera passes to onCaptured for a shot: waits up to
 * LOCATION_WAIT_AFTER_SHUTTER_MS for the running lookup, then stamps the recent
 * position if it is ready. Without any place, hands over the lookup's first
 * place (navigation/lateLocation fills the preview only while it has none).
 */
export async function placeAtShutter({
  enabled,
  resolved,
  lookup,
}: {
  /**
   * Location toggle. A getter is read again after the wait, so turning the toggle
   * off while the shutter waits stamps nothing and leaves nothing to fill later.
   */
  enabled: boolean | (() => boolean);
  /** Label the camera already shows (lookup settled before the shutter). */
  resolved: string | null;
  lookup: PlaceLookup | null;
}): Promise<ShutterPlace> {
  const isOn = typeof enabled === 'function' ? enabled : () => enabled;
  const label = await locationForCapture({
    enabled: isOn(),
    resolved,
    pending: lookup?.label ?? null,
    recent: lookup?.recentLabel,
    waitMs: LOCATION_WAIT_AFTER_SHUTTER_MS,
  });
  if (!isOn()) return { locationLabel: null, locationPending: null };
  return {
    locationLabel: label,
    locationPending: label == null ? (lookup?.firstLabel ?? null) : null,
  };
}

export type PlaceTracker = {
  /** Toggle on / camera mount: start a lookup (may show the permission dialog). */
  start: () => PlaceLookup;
  /** Toggle off / unmount. */
  stop: () => void;
  /** Running or settled lookup, null while the toggle is off. */
  current: () => PlaceLookup | null;
  /**
   * App back in the foreground (AppState 'active'): restart the lookup without
   * prompting — Android also reports 'active' when a permission dialog closes, so
   * a prompting restart would ask again right after a denial. Null when off.
   */
  onForeground: () => PlaceLookup | null;
  /**
   * Shutter: the lookup to wait for and the label the camera shows. A lookup that
   * started more than PLACE_MAX_AGE_MS ago is restarted (without prompting) and
   * the shown label is dropped (`resolved: null`), so a stale place is never stamped.
   */
  atShutter: (shown: string | null) => {
    lookup: PlaceLookup | null;
    resolved: string | null;
    restarted: boolean;
  };
};

/** Owns the camera's place lookup and its start time (`now` is injectable for tests). */
export function createPlaceTracker(
  begin: (prompt: boolean) => PlaceLookup,
  now: () => number = Date.now,
): PlaceTracker {
  let cur: { lookup: PlaceLookup; startedAt: number } | null = null;
  const launch = (prompt: boolean) => {
    cur = { lookup: begin(prompt), startedAt: now() };
    return cur.lookup;
  };
  return {
    start: () => launch(true),
    stop: () => {
      cur = null;
    },
    current: () => cur?.lookup ?? null,
    onForeground: () => (cur ? launch(false) : null),
    atShutter: (shown) => {
      if (!cur) return { lookup: null, resolved: null, restarted: false };
      if (now() - cur.startedAt > PLACE_MAX_AGE_MS) {
        return { lookup: launch(false), resolved: null, restarted: true };
      }
      return { lookup: cur.lookup, resolved: shown, restarted: false };
    },
  };
}

