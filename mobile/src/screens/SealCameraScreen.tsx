import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { TemplatePicker } from '../components/TemplatePicker';
import { formatSealDate, nowIso } from '../domain/dates';
import type { DateFormatId, TemplateId } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { colors, space } from '../theme';

type Props = {
  defaultTemplateId: TemplateId;
  dateFormatId: DateFormatId;
  onCaptured: (payload: {
    photoUri: string;
    templateId: TemplateId;
    dateFormatId: DateFormatId;
    sealedAtIso: string;
  }) => void;
  onCancel: () => void;
};

export function SealCameraScreen({
  defaultTemplateId,
  dateFormatId,
  onCaptured,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [templateId, setTemplateId] = useState<TemplateId>(defaultTemplateId);
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.permTitle}>{t('sealCamera.needPermissionTitle')}</Text>
        <Text style={styles.permBody}>{t('sealCamera.needPermissionBody')}</Text>
        <PrimaryButton
          label={t('sealCamera.allow')}
          onPress={() => void requestPermission()}
        />
        <PrimaryButton
          label={t('common.back')}
          onPress={onCancel}
          variant="ghost"
          style={{ marginTop: space.sm }}
        />
      </View>
    );
  }

  const take = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (!photo?.uri) return;
      onCaptured({
        photoUri: photo.uri,
        templateId,
        dateFormatId,
        sealedAtIso: nowIso(),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
          <Pressable onPress={onCancel} accessibilityRole="button">
            <Text style={styles.topLink}>{t('common.close')}</Text>
          </Pressable>
          <View style={styles.bannerCol}>
            <Text style={styles.banner}>{t('sealCamera.banner')}</Text>
            <Text style={styles.datePreview}>{formatSealDate(nowIso(), dateFormatId)}</Text>
          </View>
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            accessibilityRole="button"
            accessibilityLabel={t('sealCamera.flipA11y')}
          >
            <Text style={styles.topLink}>{t('sealCamera.flip')}</Text>
          </Pressable>
        </View>

        <View style={styles.midSpacer} />

        <View style={[styles.bottomBlock, { paddingBottom: Math.max(insets.bottom, space.sm) + 8 }]}>
          <Text style={styles.frameHint}>{t('sealCamera.frame')}</Text>
          <TemplatePicker value={templateId} onChange={setTemplateId} variant="camera" />
          <View style={styles.shutterRow}>
            <Pressable
              onPress={() => void take()}
              disabled={busy}
              style={[styles.shutter, busy && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel={t('sealCamera.shutterA11y')}
            >
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingBottom: space.sm,
  },
  topLink: { color: '#fff', fontSize: 16, minWidth: 48 },
  bannerCol: { flex: 1, alignItems: 'center' },
  banner: { color: '#fff', fontSize: 12, opacity: 0.9, textAlign: 'center' },
  datePreview: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.6,
  },
  midSpacer: { flex: 1 },
  bottomBlock: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: space.sm,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  frameHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    paddingHorizontal: space.md,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  shutterRow: {
    alignItems: 'center',
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: space.lg,
    gap: space.md,
  },
  permTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  permBody: { color: colors.textMuted, marginBottom: space.md },
});
