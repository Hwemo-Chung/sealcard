import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { CardFace } from '../components/CardFace';
import { PrimaryButton } from '../components/PrimaryButton';
import type { DateFormatId, TemplateId } from '../domain/types';
import { cardLayout } from '../domain/templates';
import { useI18n } from '../i18n/I18nProvider';
import { colors, space } from '../theme';

/** Fixed edge inset — fit card tight in remaining space. */
const EDGE = 5;

type Props = {
  photoUri: string;
  templateId: TemplateId;
  dateFormatId: DateFormatId;
  sealedAtIso: string;
  showDate?: boolean;
  locationLabel?: string | null;
  showBinderName?: boolean;
  onRetake: () => void;
  onConfirmSeal: (payload: {
    compositeUri: string;
    width: number;
    height: number;
  }) => void;
};

export function SealPreviewScreen({
  photoUri,
  templateId,
  dateFormatId,
  sealedAtIso,
  showDate = true,
  locationLabel = null,
  showBinderName = false,
  onRetake,
  onConfirmSeal,
}: Props) {
  const { t } = useI18n();
  const binderPreview = showBinderName ? t('sealCamera.binderPlaceholder') : null;
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStageSize((prev) =>
      prev.w === Math.floor(width) && prev.h === Math.floor(height)
        ? prev
        : { w: Math.floor(width), h: Math.floor(height) },
    );
  };

  const cardW = useMemo(() => {
    const maxW = Math.max(1, stageSize.w - EDGE * 2);
    const maxH = Math.max(1, stageSize.h - EDGE * 2);
    if (stageSize.w <= 0 || stageSize.h <= 0) return maxW;
    let w = maxW;
    let h = cardLayout(templateId, w).height;
    if (h > maxH) {
      w = Math.max(1, Math.floor(w * (maxH / h)));
      h = cardLayout(templateId, w).height;
      if (h > maxH) w = Math.max(1, Math.floor(w * (maxH / h)));
    }
    return Math.max(1, Math.floor(w));
  }, [stageSize.w, stageSize.h, templateId]);
  const cardH = cardLayout(templateId, cardW).height;

  const confirm = () => {
    Alert.alert(t('sealPreview.confirmTitle'), t('sealPreview.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sealPreview.seal'),
        onPress: () => void captureAndProceed(),
      },
    ]);
  };

  const captureAndProceed = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });
      onConfirmSeal({
        compositeUri: uri,
        width: Math.round(cardW),
        height: Math.round(cardH),
      });
    } catch {
      Alert.alert(t('sealPreview.failTitle'), t('sealPreview.failBody'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('sealPreview.title')}</Text>
      <Text style={styles.hint}>
        {t('sealPreview.asSeen', { template: t(`template.${templateId}_label`) })}
      </Text>
      <View style={styles.stage} onLayout={onStageLayout}>
        {stageSize.w > 0 && stageSize.h > 0 ? (
          <CardFace
            ref={cardRef}
            photoUri={photoUri}
            templateId={templateId}
            dateFormatId={dateFormatId}
            sealedAtIso={sealedAtIso}
            width={cardW}
            showDate={showDate}
            locationLabel={locationLabel}
            binderLabel={binderPreview}
          />
        ) : null}
      </View>
      <View style={styles.actions}>
        <PrimaryButton
          label={t('sealPreview.retake')}
          onPress={onRetake}
          variant="ghost"
          style={styles.btn}
        />
        <PrimaryButton
          label={t('sealPreview.seal')}
          onPress={confirm}
          loading={busy}
          style={styles.btn}
          accessibilityLabel={t('sealPreview.sealA11y')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  hint: {
    color: colors.textMuted,
    paddingHorizontal: space.md,
    marginTop: 4,
    marginBottom: 4,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: EDGE,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    paddingBottom: space.lg,
  },
  btn: { flex: 1 },
});