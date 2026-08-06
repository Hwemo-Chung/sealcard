import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import type { Card } from '../domain/types';
import { UNCATEGORIZED_LABEL } from '../domain/types';
import * as repo from '../storage/repository';
import { space } from '../theme';
import {
  capturePresentationTemp,
  deleteTempQuiet,
  setAsWallpaperFlow,
  sharePresentationImage,
} from './capturePresentation';
import { PresentationStage } from './PresentationStage';

type Props = {
  card: Card;
  binderName: string;
  /** hide off-screen stage after actions */
  compact?: boolean;
};

/**
 * P1–P3 entry points from card detail / wall mode.
 * Off-screen PresentationStage is captured for share/wallpaper (E9: temp only).
 * Sealing flow never mounts this component (E8).
 */
export function PresentActions({ card, binderName, compact }: Props) {
  const stageRef = useRef<View>(null);
  const [busy, setBusy] = useState<'share' | 'wall' | 'widget' | null>(null);
  const name = binderName || UNCATEGORIZED_LABEL;

  const runCapture = async (profile: 'share' | 'wallpaper') => {
    // wait a frame so offscreen stage lays out
    await new Promise((r) => setTimeout(r, 80));
    return capturePresentationTemp(stageRef, profile);
  };

  const onShare = async () => {
    if (busy) return;
    setBusy('share');
    let uri: string | undefined;
    try {
      uri = await runCapture('share');
      await sharePresentationImage(uri);
    } catch {
      Alert.alert('공유하지 못했습니다', '다시 시도해 주세요.');
    } finally {
      await deleteTempQuiet(uri);
      setBusy(null);
    }
  };

  const onWallpaper = async () => {
    if (busy) return;
    setBusy('wall');
    let uri: string | undefined;
    try {
      uri = await runCapture('wallpaper');
      await setAsWallpaperFlow(uri);
    } catch {
      Alert.alert('저장하지 못했습니다', '다시 시도해 주세요.');
    } finally {
      await deleteTempQuiet(uri);
      setBusy(null);
    }
  };

  const onWidget = () => {
    if (busy) return;
    Alert.alert('위젯에 고정', '홈 화면에 이 카드(또는 바인더 최신)를 고정합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '이 카드 고정',
        onPress: () =>
          void (async () => {
            setBusy('widget');
            try {
              await repo.updateSettings({
                widgetBinderId: card.binderId,
                widgetCardId: card.id,
              });
              Alert.alert(
                '고정했습니다',
                '홈 화면에서 Sealcard 위젯을 추가하면 이 카드가 표시됩니다. (Android 개발 빌드에서 위젯 제공)',
              );
            } finally {
              setBusy(null);
            }
          })(),
      },
      {
        text: '바인더 최신',
        onPress: () =>
          void (async () => {
            setBusy('widget');
            try {
              await repo.updateSettings({
                widgetBinderId: card.binderId,
                widgetCardId: null,
              });
              Alert.alert(
                '고정했습니다',
                '해당 바인더의 최신 카드가 위젯에 표시됩니다. 홈 화면에 위젯을 추가하세요.',
              );
            } finally {
              setBusy(null);
            }
          })(),
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      {/* Off-screen capture target — fixed size for consistent share/wallpaper output */}
      <View style={styles.offscreen} pointerEvents="none">
        <PresentationStage
          ref={stageRef}
          imageUri={card.imagePath}
          binderName={name}
          sealedAtIso={card.sealedAt}
          dateFormatId={card.dateFormatId}
          profile="share"
          width={540}
        />
      </View>

      <PrimaryButton
        label="이미지 공유"
        onPress={() => void onShare()}
        loading={busy === 'share'}
        variant="ghost"
        accessibilityLabel="이미지로 보내기"
        style={styles.btn}
      />
      <PrimaryButton
        label="배경화면으로"
        onPress={() => void onWallpaper()}
        loading={busy === 'wall'}
        variant="ghost"
        accessibilityLabel="배경화면으로"
        style={styles.btn}
      />
      <PrimaryButton
        label="위젯에 고정…"
        onPress={onWidget}
        loading={busy === 'widget'}
        variant="ghost"
        accessibilityLabel="위젯에 고정"
        style={styles.btn}
      />
      {compact ? null : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginTop: space.md },
  btn: { alignSelf: 'stretch' },
  offscreen: {
    position: 'absolute',
    left: -4000,
    top: 0,
    // opacity must stay 1 — view-shot often captures blank if invisible
  },
});
