import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { TemplatePicker } from '../components/TemplatePicker';
import { formatSealDate, nowIso } from '../domain/dates';
import { FRAME_OVERLAYS, resolveTemplate } from '../domain/templates';
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
 * Live frame guide: template aspect + overlay PNG + date slot.
 * Does not clip — sized with contain against available center area.
 */
function FrameGuide({
  templateId,
  dateFormatId,
  maxW,
  maxH,
}: {
  templateId: TemplateId;
  dateFormatId: DateFormatId;
  maxW: number;
  maxH: number;
}) {
  const spec = resolveTemplate(templateId);
  const overlay = FRAME_OVERLAYS[templateId];
  const aspect = spec.aspect > 0 ? spec.aspect : 0.8;

  let guideW = maxW;
  let guideH = guideW / aspect;
  if (guideH > maxH) {
    guideH = maxH;
    guideW = guideH * aspect;
  }

  const dateStr = formatSealDate(nowIso(), dateFormatId);
  const dateBandPx = guideH * spec.dateBand;

  return (
    <View
      style={[styles.guideOuter, { width: guideW, height: guideH }]}
      pointerEvents="none"
      collapsable={false}
    >
      {/* Full-bleed frame PNG (transparent center = viewfinder) */}
      {overlay ? (
        <Image
          source={overlay}
          style={{ width: guideW, height: guideH }}
          resizeMode="stretch"
        />
      ) : (
        <View
          style={{
            width: guideW,
            height: guideH,
            borderWidth: Math.max(2, spec.borderWidth),
            borderColor: spec.borderColor,
            borderRadius: Math.min(spec.cornerRadius, 12),
          }}
        />
      )}
      <View
        style={[
          styles.guideDateBand,
          {
            height: dateBandPx,
            justifyContent:
              spec.dateAlign === 'center'
                ? 'center'
                : spec.dateAlign === 'right'
                  ? 'flex-end'
                  : 'flex-start',
            paddingHorizontal: guideW * 0.08,
          },
        ]}
      >
        <Text
          style={[
            styles.guideDate,
            {
              // dark ink on light mats; light ink on dark mats
              color: isLightHex(spec.background) ? '#2A2620' : 'rgba(255,255,255,0.92)',
              fontWeight: spec.dateWeight,
              letterSpacing: spec.dateLetterSpacing,
              fontSize: Math.max(11, guideW * 0.045),
              textAlign: spec.dateAlign,
            },
          ]}
        >
          {dateStr}
        </Text>
      </View>
    </View>
  );
}

function isLightHex(bg: string): boolean {
  if (!bg.startsWith('#') || bg.length < 7) return true;
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  return (r + g + b) / 3 > 140;
}

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
  /** Collapsed by default so viewfinder is usable; expand to change frame. */
  const [pickerOpen, setPickerOpen] = useState(false);

  const win = Dimensions.get('window');
  const topBarH = insets.top + 56;
  const bottomCollapsed = Math.max(insets.bottom, 8) + 120;
  const bottomExpanded = Math.max(insets.bottom, 8) + 280;
  const bottomH = pickerOpen ? bottomExpanded : bottomCollapsed;

  const guideMax = useMemo(() => {
    const maxW = win.width * 0.88;
    const maxH = Math.max(160, win.height - topBarH - bottomH - 24);
    return { maxW, maxH };
  }, [win.width, win.height, topBarH, bottomH]);

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

  const onPickTemplate = (id: TemplateId) => {
    setTemplateId(id);
    setPickerOpen(false);
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

        <View style={styles.guideArea} pointerEvents="none">
          <FrameGuide
            templateId={templateId}
            dateFormatId={dateFormatId}
            maxW={guideMax.maxW}
            maxH={guideMax.maxH}
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
  guideArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  guideOuter: {
    borderRadius: 4,
  },
  guideDateBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
  },
  guideDate: {
    width: '100%',
  },
  bottomBlock: {
    backgroundColor: 'rgba(0,0,0,0.62)',
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
