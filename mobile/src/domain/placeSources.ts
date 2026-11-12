import {
  LAST_KNOWN_MAX_AGE_MS,
  startPlaceLookup,
  type Coords,
  type PlaceLookup,
  type PlaceParts,
  type PlaceSources,
} from './placeLookup';

/** The expo-location calls the place lookup uses (injected; this file must not import expo-location). */
export type LocationApi = {
  requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  getForegroundPermissionsAsync(): Promise<{ status: string }>;
  getCurrentPositionAsync(options: { accuracy: number }): Promise<{ coords: Coords }>;
  getLastKnownPositionAsync(options: { maxAge: number }): Promise<{ coords: Coords } | null>;
  reverseGeocodeAsync(location: Coords): Promise<PlaceParts[]>;
};

/**
 * Reverse geocoder that takes the result language explicitly (the app's local
 * native module, modules/sealcard-geocoder: Android Geocoder built with that
 * locale). expo-location 57.0.8 has no language option; its Android geocoder
 * always uses Locale.getDefault() (the device language).
 */
export type LocalizedGeocoder = (coords: Coords, language: string) => Promise<PlaceParts[]>;

/** Geocoder language for an app UI locale: the three UI languages, anything else English. */
export function geocoderLanguage(locale: string): string {
  return locale === 'ko' || locale === 'ja' ? locale : 'en';
}

/**
 * Place names in the app UI language: through `localized` when this build has
 * it, read the language at call time, and fall back to expo-location (device
 * language) when the module is missing (iOS, older builds) or fails.
 */
function reverseGeocoder(
  api: LocationApi,
  language: (() => string) | undefined,
  localized: LocalizedGeocoder | null | undefined,
): (coords: Coords) => Promise<PlaceParts[]> {
  return (coords) => {
    if (!localized || !language) return api.reverseGeocodeAsync(coords);
    let pending: Promise<PlaceParts[]>;
    try {
      pending = localized(coords, geocoderLanguage(language()));
    } catch (e) {
      pending = Promise.reject(e);
    }
    return pending.catch(() => api.reverseGeocodeAsync(coords));
  };
}

/**
 * PlaceSources backed by expo-location. `prompt: false` only reads the permission
 * state (restarts on foreground / at the shutter never show the dialog again).
 */
export function placeSources(
  api: LocationApi,
  {
    accuracy,
    prompt,
    language,
    localized,
  }: {
    accuracy: number;
    prompt: boolean;
    /** App UI locale (ko | ja | en), read at geocode time. */
    language?: () => string;
    /** Null/omitted: expo-location's device-language geocoder only. */
    localized?: LocalizedGeocoder | null;
  },
): PlaceSources {
  const coordsOf = (c: Coords): Coords => ({ latitude: c.latitude, longitude: c.longitude });
  const geocode = reverseGeocoder(api, language, localized);
  return {
    permission: () =>
      (prompt ? api.requestForegroundPermissionsAsync() : api.getForegroundPermissionsAsync()).then(
        ({ status }) => status === 'granted',
      ),
    currentFix: () => api.getCurrentPositionAsync({ accuracy }).then((pos) => coordsOf(pos.coords)),
    lastKnownFix: () =>
      api
        .getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })
        .then((pos) => (pos ? coordsOf(pos.coords) : null)),
    reverseGeocode: (c) => geocode(coordsOf(c)),
  };
}

/**
 * The camera's lookup starter (PlaceTracker `begin`): `prompt` true on toggle
 * on / mount, false on restarts. locationLabel.ts binds expo-location, the
 * localized geocoder and the i18n locale.
 */
export function createPlaceLabelLookup(
  api: LocationApi,
  opts: { accuracy: number; language: () => string; localized: LocalizedGeocoder | null },
): (prompt: boolean) => PlaceLookup {
  return (prompt) => startPlaceLookup(placeSources(api, { ...opts, prompt }));
}
