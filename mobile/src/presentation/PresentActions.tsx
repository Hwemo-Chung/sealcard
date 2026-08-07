import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, View, type ViewStyle } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import type { Card } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
// import * as repo from '../storage/repository';
import {
  capturePresentationTemp,
  deleteTempQuiet,
  // setAsWallpaperFlow,
  sharePresentationImage,
} from './capturePresentation';
import { PresentationStage } from './PresentationStage';

type Props = {
  card: Card;
  binderName: string;
  /** Smaller buttons for card detail toolbar */
  compact?: boolean;
  style?: ViewStyle;
};

/**
 * Share action from card detail (wallpaper / widget pin disabled for now).
 */
export function PresentActions({ card, binderName, compact = true, style }: Props) {
  const { t } = useI18n();
  const stageRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const name = binderName || t('cardDetail.uncategorized');
  const btnSize = compact ? 'sm' : 'md';

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    let uri: string | undefined;
    try {
      await new Promise((r) => setTimeout(r, 80));
      uri = await capturePresentationTemp(stageRef, 'share');
      await sharePresentationImage(uri);
    } catch {
      Alert.alert(t('present.shareFailTitle'), t('present.shareFailBody'));
    } finally {
      await deleteTempQuiet(uri);
      setBusy(false);
    }
  };

  // const onWallpaper = async () => { ... setAsWallpaperFlow ... };
  // const onWidget = () => { ... repo.updateSettings widget ... };

  return (
    <View style={[styles.wrap, style]}>
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
        loading={busy}
        variant="ghost"
        size={btnSize}
        accessibilityLabel={t('present.shareA11y')}
        style={styles.btn}
      />

      {/*
      <PrimaryButton
        label={t('present.wallpaper')}
        onPress={() => void onWallpaper()}
        variant="ghost"
        size={btnSize}
        accessibilityLabel={t('present.wallpaperA11y')}
        style={styles.btn}
      />
      <PrimaryButton
        label={t('present.widgetPin')}
        onPress={onWidget}
        variant="ghost"
        size={btnSize}
        accessibilityLabel={t('present.widgetPinA11y')}
        style={styles.btn}
      />
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  btn: { alignSelf: 'stretch' },
  offscreen: {
    position: 'absolute',
    left: -4000,
    top: 0,
  },
});
