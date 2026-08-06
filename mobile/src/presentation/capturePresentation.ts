import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking, Platform } from 'react-native';

import type { PresentationProfile } from '../domain/types';

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
    Alert.alert('공유할 수 없습니다', '이 기기에서 공유 시트를 열 수 없습니다.');
    return;
  }
  await Sharing.shareAsync(tempUri, {
    mimeType: 'image/jpeg',
    dialogTitle: '이미지로 보내기',
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
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('권한이 필요합니다', '배경화면용 이미지를 저장하려면 사진 권한이 필요합니다.');
    return;
  }

  const asset = await MediaLibrary.createAssetAsync(tempUri);
  try {
    const album = await MediaLibrary.getAlbumAsync('Sealcard');
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync('Sealcard', asset, false);
    }
  } catch {
    // album optional
  }

  if (Platform.OS === 'android') {
    Alert.alert(
      '이미지를 저장했습니다',
      '갤러리의 Sealcard 앨범에서 배경화면으로 설정해 주세요. (기기마다 경로가 다릅니다.)',
    );
    return;
  }

  Alert.alert(
    '이미지를 저장했습니다',
    '사진 앱에서 해당 이미지를 연 뒤 배경화면으로 설정해 주세요.',
  );
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
