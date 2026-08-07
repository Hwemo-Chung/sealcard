import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFace } from '../components/CardFace';
import { PrimaryButton } from '../components/PrimaryButton';
import { TemplatePicker } from '../components/TemplatePicker';
import { formatSealDate, nowIso } from '../domain/dates';
import { cardLayout } from '../domain/templates';
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

/**
 * Live seal camera: CardFace chrome + CameraView in the photo slot.
 * Same geometry as SealPreviewScreen so viewfinder ≈ sealed result (cover crop).
 */
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const sealedAtIso = nowIso();

  const win = Dimensions.get('window');
  const topBarH = insets.top + 56;
  // Reserve expanded picker height so card/camera size stays fixed (no remount churn).
  const bottomReserve = Math.max(insets.bottom, 8) + 280;

  const cardWidth = useMemo(() => {
    const maxW = win.width * 0.86;
    const maxH = Math.max(160, win.height - topBarH - bottomReserve - 24);
    const { t: spec } = cardLayout(templateId, maxW);
    const aspect = spec.aspect || 0.8;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    return Math.floor(w);
  }, [win.width, win.height, topBarH, bottomReserve, templateId]);

  const { photoW, photoH } = useMemo(
    () => cardLayout(templateId, cardWidth),
    [templateId, cardWidth],
  );

  useEffect(() => {
    setCameraReady(false);
    // Some Android devices never fire onCameraReady for nested previews; unlock shutter.
    const unlock = setTimeout(() => setCameraReady(true), 1800);
    return () => clearTimeout(unlock);
  }, [facing, templateId]);

  const templateLabel = t(`template.${templateId}_label`);

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
    if (!cameraRef.current || busy || !cameraReady) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (!photo?.uri) return;
      // Full sensor image; SealPreview CardFace uses resizeMode="cover" into the
      // same photoW×photoH aspect as this live CameraView — center crop matches.
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

  const onPickTemplate = (id: TemplateId) => {
    setTemplateId(id);
    setPickerOpen(false);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text style={styles.topLink}>{t('common.close')}</Text>
        </Pressable>
        <View style={styles.bannerCol}>
          <Text style={styles.banner}>{t('sealCamera.banner')}</Text>
          <Text style={styles.datePreview}>{formatSealDate(sealedAtIso, dateFormatId)}</Text>
        </View>
        <Pressable
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          accessibilityRole="button"
          accessibilityLabel={t('sealCamera.flipA11y')}
        >
          <Text style={styles.topLink}>{t('sealCamera.flip')}</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        <CardFace
          templateId={templateId}
          dateFormatId={dateFormatId}
          sealedAtIso={sealedAtIso}
          width={cardWidth}
          photoSlot={
            <CameraView
              key={facing}
              ref={cameraRef}
              style={{ width: photoW, height: photoH }}
              facing={facing}
              onCameraReady={() => setCameraReady(true)}
            />
          }
        />
      </View>

      <View
        style={[
          styles.bottomBlock,
          { paddingBottom: Math.max(insets.bottom, space.sm) + 4 },
        ]}
      >
        {pickerOpen ? (
          <>
            <Pressable
              onPress={() => setPickerOpen(false)}
              style={styles.panelHeader}
              accessibilityRole="button"
              accessibilityLabel={t('sealCamera.collapsePickerA11y')}
            >
              <View style={styles.handle} />
              <Text style={styles.panelHeaderText}>
                {t('sealCamera.frame')} · {templateLabel} · {t('sealCamera.collapsePicker')}
              </Text>
            </Pressable>
            <TemplatePicker
              value={templateId}
              onChange={onPickTemplate}
              variant="camera"
              compact
            />
          </>
        ) : (
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={styles.collapsedStrip}
            accessibilityRole="button"
            accessibilityLabel={t('sealCamera.expandPickerA11y')}
          >
            <View style={styles.handle} />
            <Text style={styles.collapsedText} numberOfLines={1}>
              {t('sealCamera.frame')} · {templateLabel} · {t('sealCamera.expandPicker')}
            </Text>
          </Pressable>
        )}

        <View style={styles.shutterRow}>
          <Pressable
            onPress={() => void take()}
            disabled={busy || !cameraReady}
            style={[styles.shutter, (busy || !cameraReady) && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={t('sealCamera.shutterA11y')}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  topBar: {
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingBottom: space.sm,
    zIndex: 2,
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
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  bottomBlock: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingTop: 6,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 8,
  },
  collapsedStrip: {
    paddingHorizontal: space.md,
    paddingBottom: 4,
  },
  collapsedText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  panelHeader: {
    paddingHorizontal: space.md,
    paddingBottom: 4,
  },
  panelHeaderText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  shutterRow: {
    alignItems: 'center',
    paddingTop: space.sm,
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
