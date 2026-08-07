import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
/**
 * SDK 57 default entry is the Next API (`ExpoMediaLibraryNext`) — no createAssetAsync
 * and missing in Expo Go. Legacy uses `ExpoMediaLibrary` + createAssetAsync/album APIs.
 */
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

import type { PresentationProfile } from '../domain/types';
import { t } from '../i18n';

/**
 * Capture presentation stage to a *temp* JPEG.
 * Must never write into card.imagePath (E9).
 */
export async function capturePresentationTemp(
  stageRef: RefObject<View | null>,
  profile: PresentationProfile = 'share',
): Promise<string> {
  if (!stageRef.current) throw new Error('presentation stage missing');
  const quality = profile === 'wallpaper' ? 0.95 : 0.9;
  const uri = await captureRef(stageRef, {
    format: 'jpg',
    quality,
    result: 'tmpfile',
  });
  return uri;
}

/** P1 — system share sheet only (no feed). */
export async function sharePresentationImage(tempUri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert(t('present.cannotShareTitle'), t('present.cannotShareBody'));
    return;
  }
  await Sharing.shareAsync(tempUri, {
    mimeType: 'image/jpeg',
    dialogTitle: t('present.shareA11y'),
    UTI: 'public.jpeg',
  });
}

/**
 * P2 — wallpaper path:
 * 1) save derived JPEG to media library (not card.imagePath)
 * 2) open system wallpaper / settings when possible
 * 3) else tell user to set manually
 */
export async function setAsWallpaperFlow(tempUri: string): Promise<void> {
  // writeOnly: save to gallery only; avoid broad photo-library read prompts
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) {
    Alert.alert(t('present.needPhotosTitle'), t('present.needPhotosBody'));
    return;
  }

  let asset: MediaLibrary.Asset;
  try {
    asset = await MediaLibrary.createAssetAsync(tempUri);
  } catch {
    Alert.alert(t('present.saveFailTitle'), t('present.saveFailBody'));
    return;
  }

  try {
    const album = await MediaLibrary.getAlbumAsync('Sealcard');
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync('Sealcard', asset, false);
    }
  } catch {
    // album optional — asset already in library
  }

  if (Platform.OS === 'android') {
    Alert.alert(t('present.savedTitle'), t('present.savedBody'));
    return;
  }

  Alert.alert(t('present.savedTitle'), t('present.savedFallbackBody'));
}

/** Clean temp capture when done (best effort). */
export async function deleteTempQuiet(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}
