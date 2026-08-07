import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import type { Card } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
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
  /** Smaller buttons for card detail toolbar */
  compact?: boolean;
};

/**
 * Share / wallpaper / widget pin from card detail.
 * Off-screen PresentationStage is captured for share/wallpaper (temp only).
 */
export function PresentActions({ card, binderName, compact = true }: Props) {
  const { t } = useI18n();
  const stageRef = useRef<View>(null);
  const [busy, setBusy] = useState<'share' | 'wall' | 'widget' | null>(null);
  const name = binderName || t('cardDetail.uncategorized');
  const btnSize = compact ? 'sm' : 'md';

  const runCapture = async (profile: 'share' | 'wallpaper') => {
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
      Alert.alert(t('present.shareFailTitle'), t('present.shareFailBody'));
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
      Alert.alert(t('present.saveFailTitle'), t('present.saveFailBody'));
    } finally {
      await deleteTempQuiet(uri);
      setBusy(null);
    }
  };

  const onWidget = () => {
    if (busy) return;
    Alert.alert(t('present.widgetTitle'), t('present.widgetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('present.widgetThisCard'),
        onPress: () =>
          void (async () => {
            setBusy('widget');
            try {
              await repo.updateSettings({
                widgetBinderId: card.binderId,
                widgetCardId: card.id,
              });
              Alert.alert(
                t('present.widgetPinnedTitle'),
                t('present.widgetPinnedCardBody'),
              );
            } finally {
              setBusy(null);
            }
          })(),
      },
      {
        text: t('present.widgetBinderLatest'),
        onPress: () =>
          void (async () => {
            setBusy('widget');
            try {
              await repo.updateSettings({
                widgetBinderId: card.binderId,
                widgetCardId: null,
              });
              Alert.alert(
                t('present.widgetPinnedTitle'),
                t('present.widgetPinnedBinderBody'),
              );
            } finally {
              setBusy(null);
            }
          })(),
      },
    ]);
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.offscreen} pointerEvents="none">
        <PresentationStage
          ref={stageRef}
          imageUri={card.imagePath}
          binderName={name}
          sealedAtIso={card.sealedAt}
          dateFormatId={card.dateFormatId}
          profile="share"
          showCaption={false}
          width={540}
        />
      </View>

      <PrimaryButton
        label={t('present.share')}
        onPress={() => void onShare()}
        loading={busy === 'share'}
        variant="ghost"
        size={btnSize}
        accessibilityLabel={t('present.shareA11y')}
        style={styles.btn}
      />
      <PrimaryButton
        label={t('present.wallpaper')}
        onPress={() => void onWallpaper()}
        loading={busy === 'wall'}
        variant="ghost"
        size={btnSize}
        accessibilityLabel={t('present.wallpaperA11y')}
        style={styles.btn}
      />
      <PrimaryButton
        label={t('present.widgetPin')}
        onPress={onWidget}
        loading={busy === 'widget'}
        variant="ghost"
        size={btnSize}
        accessibilityLabel={t('present.widgetPinA11y')}
        style={styles.btn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginTop: space.md },
  wrapCompact: { gap: 6, marginTop: space.sm },
  btn: { alignSelf: 'stretch' },
  offscreen: {
    position: 'absolute',
    left: -4000,
    top: 0,
  },
});
