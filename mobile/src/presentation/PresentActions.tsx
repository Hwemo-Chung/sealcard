import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Alert, StyleSheet, View, type ViewStyle } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import type { Card } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import {
  capturePresentationTemp,
  deleteTempQuiet,
  sharePresentationImage,
} from './capturePresentation';
import { PresentationStage } from './PresentationStage';

export type PresentActionsHandle = {
  share: () => void;
  busy: boolean;
};

type Props = {
  card: Card;
  binderName: string;
  /** Smaller buttons for card detail toolbar */
  compact?: boolean;
  style?: ViewStyle;
  /** Hide PrimaryButton — parent drives share via ref (CollectUI nav). */
  hideButton?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Share action from card detail (wallpaper / widget pin disabled for now).
 */
export const PresentActions = forwardRef<PresentActionsHandle, Props>(
  function PresentActions(
    {
      card,
      binderName,
      compact = true,
      style,
      hideButton = false,
      onBusyChange,
    },
    ref,
  ) {
    const { t } = useI18n();
    const stageRef = useRef<View>(null);
    const [busy, setBusy] = useState(false);
    const name = binderName || t('cardDetail.uncategorized');
    const btnSize = compact ? 'sm' : 'md';

    const setBusyBoth = (v: boolean) => {
      setBusy(v);
      onBusyChange?.(v);
    };

    const onShare = async () => {
      if (busy) return;
      setBusyBoth(true);
      let uri: string | undefined;
      try {
        await new Promise((r) => setTimeout(r, 80));
        uri = await capturePresentationTemp(stageRef, 'share');
        await sharePresentationImage(uri);
      } catch {
        Alert.alert(t('present.shareFailTitle'), t('present.shareFailBody'));
      } finally {
        await deleteTempQuiet(uri);
        setBusyBoth(false);
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        share: () => void onShare(),
        busy,
      }),
      // onShare closes over latest busy/card via state — rebind when busy flips
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [busy, card.id, name],
    );

    return (
      <View style={[hideButton ? styles.wrapHost : styles.wrap, style]} pointerEvents={hideButton ? 'none' : 'auto'}>
        {/* Keep full layout for view-shot; park far off-screen */}
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
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

        {!hideButton && (
          <PrimaryButton
            label={t('present.share')}
            onPress={() => void onShare()}
            loading={busy}
            variant="ghost"
            size={btnSize}
            accessibilityLabel={t('present.shareA11y')}
            style={styles.btn}
          />
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  /** Host only for offscreen stage — no layout footprint */
  wrapHost: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'visible',
  },
  btn: { alignSelf: 'stretch' },
  offscreen: {
    position: 'absolute',
    left: -4000,
    top: 0,
    width: 540,
  },
});
