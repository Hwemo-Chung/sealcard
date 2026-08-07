import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { CardFace } from '../components/CardFace';
import { PrimaryButton } from '../components/PrimaryButton';
import type { DateFormatId, TemplateId } from '../domain/types';
import { resolveTemplate } from '../domain/templates';
import { useI18n } from '../i18n/I18nProvider';
import { colors, space } from '../theme';

type Props = {
  photoUri: string;
  templateId: TemplateId;
  dateFormatId: DateFormatId;
  sealedAtIso: string;
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
  onRetake,
  onConfirmSeal,
}: Props) {
  const { t } = useI18n();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const screenW = Dimensions.get('window').width;
  const cardW = Math.min(screenW - space.lg * 2, 340);
  const template = resolveTemplate(templateId);
  const cardH = cardW / template.aspect;

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
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <CardFace
          ref={cardRef}
          photoUri={photoUri}
          templateId={templateId}
          dateFormatId={dateFormatId}
          sealedAtIso={sealedAtIso}
          width={cardW}
        />
      </ScrollView>
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
    marginBottom: space.md,
  },
  scroll: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    paddingBottom: space.lg,
  },
  btn: { flex: 1 },
});
