import * as Location from 'expo-location';

/**
 * On-device place label for seal stamp. Never uploaded.
 * Returns null if permission denied, GPS unavailable, or geocode empty.
 */
export async function resolvePlaceLabel(): Promise<string | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const p = places[0];
    if (!p) return null;

    const city = p.city ?? p.subregion ?? p.region ?? null;
    const detail = p.district ?? p.street ?? p.name ?? null;
    if (city && detail && detail !== city) return `${city} · ${detail}`;
    if (city) return city;
    if (detail) return detail;
    return null;
  } catch {
    return null;
  }
}
