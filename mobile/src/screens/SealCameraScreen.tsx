import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFace } from '../components/CardFace';
import { PrimaryButton } from '../components/PrimaryButton';
import { pressLock } from '../components/pressLock';
import { TemplatePicker } from '../components/TemplatePicker';
import { formatSealDate, nowIso } from '../domain/dates';
import { startPlaceLabelLookup } from '../domain/locationLabel';
import {
  classifyPermissionRequest,
  openSettingsNow,
  permissionAction,
} from '../domain/permissions';
import { createPlaceTracker, type PlaceLookup } from '../domain/placeLookup';
import { cardLayout } from '../domain/templates';
import type { DateFormatId, TemplateId } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { onCameraAppState, placeForShot } from '../navigation/cameraWiring';
import { colors, space } from '../theme';

/** Fixed edge inset — no % wasted margin around live card preview. */
const EDGE = 5;

type Props = {
  defaultTemplateId: TemplateId;
  dateFormatId: DateFormatId;
  showDate: boolean;
  showLocation: boolean;
  showBinderName: boolean;
  onCaptured: (payload: {
    photoUri: string;
    templateId: TemplateId;
    dateFormatId: DateFormatId;
    sealedAtIso: string;
    showDate: boolean;
    locationLabel: string | null;
    /**
     * Lookup's first place when the post-shutter wait ran out with no place (not
     * even the recent position). The caller applies it to the preview if it lands
     * before the seal is confirmed (domain/placeLookup placeAtShutter, navigation/lateLocation).
     */
    locationPending: Promise<string | null> | null;
    showBinderName: boolean;
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
  showDate: showDateProp,
  showLocation: showLocationProp,
  showBinderName: showBinderNameProp,
  onCaptured,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [templateId, setTemplateId] = useState<TemplateId>(defaultTemplateId);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  /** A button press confirmed a permanent camera denial (not just canAskAgain=false). */
  const [cameraBlocked, setCameraBlocked] = useState(false);
  /** Session overrides of settings defaults */
  const [showDate, setShowDate] = useState(showDateProp);
  const [showLocation, setShowLocation] = useState(showLocationProp);
  const [showBinderName, setShowBinderName] = useState(showBinderNameProp);
  /**
   * Location toggle as of now (updated on tap, before the re-render): the shutter
   * re-reads it after its wait, so turning it off mid-wait stamps nothing.
   */
  const showLocationRef = useRef(showLocationProp);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  /**
   * Current place lookup (pending or settled) and its start time — awaited
   * (bounded) at shutter time, with its recent-position label as the fallback when
   * the wait runs out. Restarted on foreground and when stale at the shutter.
   */
  const [tracker] = useState(() => createPlaceTracker(startPlaceLabelLookup));
  /** False after close/back — a capture finishing late must not navigate. */
  const mountedRef = useRef(true);
  /** Stage layout — card fills this rect with EDGE padding only. */
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const sealedAtIso = nowIso();

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStageSize((prev) =>
      prev.w === Math.floor(width) && prev.h === Math.floor(height)
        ? prev
        : { w: Math.floor(width), h: Math.floor(height) },
    );
  };

  const cardWidth = useMemo(() => {
    const maxW = Math.max(1, stageSize.w - EDGE * 2);
    const maxH = Math.max(1, stageSize.h - EDGE * 2);
    if (stageSize.w <= 0 || stageSize.h <= 0) return maxW;
    // Fit using real cardLayout height (minimal has square photo + date band).
    let w = maxW;
    let h = cardLayout(templateId, w).height;
    if (h > maxH) {
      w = Math.max(1, Math.floor(w * (maxH / h)));
      h = cardLayout(templateId, w).height;
      // one more tighten if float residual
      if (h > maxH) w = Math.max(1, Math.floor(w * (maxH / h)));
    }
    return Math.max(1, Math.floor(w));
  }, [stageSize.w, stageSize.h, templateId]);

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

  /**
   * Show `lookup` in the stamp line: "finding place…" until it settles. A lookup
   * that was replaced (restart, toggle off) or outlived the screen is ignored.
   */
  const follow = (lookup: PlaceLookup) => {
    setLocationLabel(null);
    setLocationBusy(true);
    // `label` never rejects by contract; a broken lookup reads as "no place".
    void lookup.label.catch(() => null).then((label) => {
      if (!mountedRef.current || tracker.current() !== lookup) return;
      setLocationLabel(label);
      setLocationBusy(false);
    });
  };

  useEffect(() => {
    if (!showLocation) {
      tracker.stop();
      setLocationLabel(null);
      setLocationBusy(false);
      return;
    }
    // The tracker keeps the (soon settled) lookup: take() reads it after awaiting
    // the photo. A settled promise resolves immediately inside placeAtShutter.
    follow(tracker.start());
    // `follow` only uses stable setters, refs and the tracker.
  }, [showLocation, tracker]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Back in the foreground (system settings, another app, screen unlock): re-read
  // the camera permission and restart the place lookup, which may be an hour old.
  // The restart never shows the location dialog (Android also reports 'active'
  // when a permission dialog closes).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) =>
      onCameraAppState(state, { recheckPermission: getPermission, tracker, follow }),
    );
    return () => sub.remove();
    // `follow` only uses stable setters, refs and the tracker.
  }, [getPermission, tracker]);

  const templateLabel = t(`template.${templateId}_label`);

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    const blocked = permissionAction(permission, cameraBlocked) === 'openSettings';
    const onAllow = async () => {
      if (blocked) {
        void Linking.openSettings().catch(() => undefined);
        return;
      }
      const before = permission;
      const startedAt = Date.now();
      const after = await requestPermission().catch(() => null);
      if (!after || !mountedRef.current) return;
      const outcome = classifyPermissionRequest(before, after);
      // Blocked → the button becomes "open settings", so the next press is never a no-op.
      setCameraBlocked(outcome === 'blocked' || outcome === 'blockedNoPrompt');
      // System answered without a dialog: go to settings in this same press.
      if (openSettingsNow(outcome, Date.now() - startedAt)) {
        void Linking.openSettings().catch(() => undefined);
      }
    };
    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.permTitle}>{t('sealCamera.needPermissionTitle')}</Text>
        <Text style={styles.permBody}>
          {blocked ? t('sealCamera.blockedBody') : t('sealCamera.needPermissionBody')}
        </Text>
        <PrimaryButton
          label={blocked ? t('sealCamera.openSettings') : t('sealCamera.allow')}
          onPress={() => void onAllow()}
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
      // Seal time = shutter time, even if we then wait briefly for the place lookup.
      const sealedAt = nowIso();
      // A lookup older than PLACE_MAX_AGE_MS is restarted; its shown place is dropped.
      // The toggle is re-read after the wait (turned off meanwhile → no place).
      const place = await placeForShot({
        tracker,
        shown: locationLabel,
        isOn: () => showLocationRef.current,
        follow,
      });
      if (!mountedRef.current) return;
      onCaptured({
        photoUri: photo.uri,
        templateId,
        dateFormatId,
        sealedAtIso: sealedAt,
        showDate,
        locationLabel: place.locationLabel,
        locationPending: place.locationPending,
        showBinderName,
      });
    } catch {
      // takePictureAsync rejected (camera busy/unavailable): say so; the shutter unlocks below.
      if (mountedRef.current) {
        Alert.alert(t('sealCamera.captureFailTitle'), t('sealCamera.captureFailBody'));
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleLocation = () => {
    const next = !showLocationRef.current;
    showLocationRef.current = next;
    setShowLocation(next);
  };

  const onPickTemplate = (id: TemplateId) => {
    setTemplateId(id);
    setPickerOpen(false);
  };

  const binderPreview = showBinderName ? t('sealCamera.binderPlaceholder') : null;
  const stampLine = [
    showDate ? formatSealDate(sealedAtIso, dateFormatId) : null,
    showLocation
      ? locationBusy
        ? t('sealCamera.locationLoading')
        : locationLabel ?? t('sealCamera.locationUnavailable')
      : null,
    binderPreview,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text style={styles.topLink}>{t('common.close')}</Text>
        </Pressable>
        <View style={styles.bannerCol}>
          <Text style={styles.banner}>{t('sealCamera.banner')}</Text>
          {stampLine ? (
            <Text style={styles.datePreview} numberOfLines={1}>
              {stampLine}
            </Text>
          ) : (
            <Text style={styles.datePreviewMuted}>{t('sealCamera.stampOff')}</Text>
          )}
        </View>
        <Pressable
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          accessibilityRole="button"
          accessibilityLabel={t('sealCamera.flipA11y')}
        >
          <Text style={styles.topLink}>{t('sealCamera.flip')}</Text>
        </Pressable>
      </View>

      <View style={styles.stage} onLayout={onStageLayout}>
        {stageSize.w > 0 && stageSize.h > 0 ? (
          <CardFace
            templateId={templateId}
            dateFormatId={dateFormatId}
            sealedAtIso={sealedAtIso}
            width={cardWidth}
            showDate={showDate}
            locationLabel={showLocation ? locationLabel : null}
            binderLabel={binderPreview}
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
        ) : null}
      </View>

      <View
        style={[
          styles.bottomBlock,
          { paddingBottom: Math.max(insets.bottom, space.sm) + 4 },
        ]}
      >
        {/* Session stamp toggles (defaults from settings) */}
        <View style={styles.optRow}>
          {/* Locked while a shot is in progress: the shot uses the toggles as of the shutter. */}
          <Pressable
            {...pressLock(busy, () => setShowDate((v) => !v))}
            style={[styles.optChip, showDate && styles.optChipOn, busy && styles.optChipBusy]}
            accessibilityRole="switch"
            accessibilityState={{ checked: showDate, disabled: busy }}
            accessibilityLabel={t('sealCamera.toggleDateA11y')}
          >
            <Text style={[styles.optChipText, showDate && styles.optChipTextOn]}>
              {t('sealCamera.toggleDate')}
            </Text>
          </Pressable>
          <Pressable
            {...pressLock(busy, toggleLocation)}
            style={[styles.optChip, showLocation && styles.optChipOn, busy && styles.optChipBusy]}
            accessibilityRole="switch"
            accessibilityState={{ checked: showLocation, disabled: busy }}
            accessibilityLabel={t('sealCamera.toggleLocationA11y')}
          >
            <Text
              style={[styles.optChipText, showLocation && styles.optChipTextOn]}
            >
              {t('sealCamera.toggleLocation')}
            </Text>
          </Pressable>
          <Pressable
            {...pressLock(busy, () => setShowBinderName((v) => !v))}
            style={[styles.optChip, showBinderName && styles.optChipOn, busy && styles.optChipBusy]}
            accessibilityRole="switch"
            accessibilityState={{ checked: showBinderName, disabled: busy }}
            accessibilityLabel={t('sealCamera.toggleBinderA11y')}
          >
            <Text
              style={[styles.optChipText, showBinderName && styles.optChipTextOn]}
            >
              {t('sealCamera.toggleBinder')}
            </Text>
          </Pressable>
        </View>

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
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.4,
    paddingHorizontal: 4,
  },
  datePreviewMuted: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: EDGE,
  },
  bottomBlock: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingTop: 6,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: space.md,
    paddingBottom: 8,
  },
  optChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  optChipOn: {
    borderColor: 'rgba(255,255,255,0.75)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  optChipText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
  optChipTextOn: {
    color: '#fff',
  },
  optChipBusy: {
    opacity: 0.5,
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
