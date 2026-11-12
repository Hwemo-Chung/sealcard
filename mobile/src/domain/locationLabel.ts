import { requireOptionalNativeModule } from 'expo';
import * as Location from 'expo-location';

import { getI18n } from '../i18n';
import type { PlaceParts } from './placeLookup';
import { createPlaceLabelLookup, type LocalizedGeocoder } from './placeSources';

/** modules/sealcard-geocoder (Android): Geocoder built with the requested locale. */
type SealcardGeocoderModule = {
  reverseGeocodeAsync(latitude: number, longitude: number, language: string): Promise<PlaceParts[]>;
};

/** Null on iOS, Expo Go or a build without the module: expo-location (device language) is used. */
const nativeGeocoder = requireOptionalNativeModule<SealcardGeocoderModule>('SealcardGeocoder');

const localized: LocalizedGeocoder | null = nativeGeocoder
  ? (coords, language) => nativeGeocoder.reverseGeocodeAsync(coords.latitude, coords.longitude, language)
  : null;

/**
 * On-device place lookup for the seal stamp. Never uploaded.
 * `label` is null if permission is denied, GPS is unavailable, geocode is empty,
 * or the lookup runs out of time; `recentLabel` is the last-known position's
 * label, queried in parallel (see placeLookup; permission dialog time is not counted).
 * `prompt: false` (restarts) reads the permission without showing the dialog.
 * Place names follow the app UI language (i18n locale), not the device language.
 */
export const startPlaceLabelLookup = createPlaceLabelLookup(Location, {
  accuracy: Location.Accuracy.Balanced,
  language: () => getI18n().locale,
  localized,
});
