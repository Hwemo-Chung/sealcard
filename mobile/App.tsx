import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { SealPhase } from './src/domain/sealSave';
import { onHardwareBack } from './src/navigation/back';
import { confirmPreview, stampLateLocation } from './src/navigation/lateLocation';
import { bootSettings, refreshSettings } from './src/navigation/settingsLoad';
import { announceLateSeal, announceSealed, type SealNoticeFx } from './src/navigation/sealNotice';
import { toastLayer } from './src/navigation/toastLayer';
import type { RootScreen } from './src/navigation/types';
import { BinderDetailScreen } from './src/screens/BinderDetailScreen';
import { BindersScreen } from './src/screens/BindersScreen';
import { CardDetailScreen } from './src/screens/CardDetailScreen';
import { PickBinderScreen } from './src/screens/PickBinderScreen';
import { SealCameraScreen } from './src/screens/SealCameraScreen';
import { SealPreviewScreen } from './src/screens/SealPreviewScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import type { Settings } from './src/domain/types';
import { t } from './src/i18n';
import { I18nProvider } from './src/i18n/I18nProvider';
import * as repo from './src/storage/repository';
import { colors } from './src/theme';

export default function App() {
  const [screen, setScreen] = useState<RootScreen>({ name: 'binders' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** Bumped when a seal lands after its picker was left: list screens reload. */
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    // Unreadable storage must not leave the boot screen up: start with defaults.
    void bootSettings(repo.getSettings).then(setSettings);
  }, []);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const noticeFx: SealNoticeFx = {
    // Through the write queue: a late seal's binder may be deleted by a write queued before the toast.
    getBinderName: repo.binderNameAfterWrites,
    toast: showToast,
    t,
  };

  const goBinders = () => setScreen({ name: 'binders' });

  const reloadSettings = useCallback(() => {
    // On a read failure the settings in memory stay in effect.
    void refreshSettings(repo.getSettings, setSettings);
  }, []);

  /** PickBinderScreen's save phase ('saving' is set before its first await). */
  const sealPhaseRef = useRef<SealPhase>('idle');
  const setSealPhase = useCallback((phase: SealPhase) => {
    sealPhaseRef.current = phase;
  }, []);

  // Android hardware/gesture back: step back one screen; only the root list exits.
  // While a seal is saving, back is swallowed so the pending onDone can't land on
  // another screen (or let the same capture be sealed twice); once the save stalls,
  // back leaves to the binder list like Cancel (navigation/back).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () =>
      onHardwareBack(screen, sealPhaseRef.current, { navigate: setScreen, reloadSettings }),
    );
    return () => sub.remove();
  }, [screen, reloadSettings]);

  // Camera is edge-to-edge; other screens sit inside top+bottom safe area.
  const cameraMode = screen.name === 'sealCamera';

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {settings == null ? (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.boot}>
            <Text style={styles.bootText}>Sealcard</Text>
          </View>
        </SafeAreaView>
      ) : (
        <I18nProvider initialPreference={settings.locale ?? 'system'}>
          <View style={styles.safe}>
            {cameraMode ? (
              <View style={styles.safe}>
                <SealCameraScreen
                  defaultTemplateId={settings.defaultTemplateId}
                  dateFormatId={settings.dateFormatId}
                  showDate={settings.showDate !== false}
                  showLocation={!!settings.showLocation}
                  showBinderName={!!settings.showBinderName}
                  onCancel={goBinders}
                  onCaptured={(p) => {
                    setScreen({
                      name: 'sealPreview',
                      photoUri: p.photoUri,
                      templateId: p.templateId,
                      dateFormatId: p.dateFormatId,
                      sealedAtIso: p.sealedAtIso,
                      showDate: p.showDate,
                      locationLabel: p.locationLabel,
                      showBinderName: p.showBinderName,
                    });
                    // Place lookup outlived the post-shutter wait: stamp the preview when it lands.
                    stampLateLocation(p, setScreen);
                  }}
                />
              </View>
            ) : (
              <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
                {screen.name === 'binders' && (
                  <BindersScreen
                    refreshKey={dataVersion}
                    onOpenBinder={(binderId) => setScreen({ name: 'binderDetail', binderId })}
                    onSeal={() => setScreen({ name: 'sealCamera' })}
                    onSettings={() => setScreen({ name: 'settings' })}
                  />
                )}
                {screen.name === 'binderDetail' && (
                  <BinderDetailScreen
                    binderId={screen.binderId}
                    refreshKey={dataVersion}
                    onBack={goBinders}
                    onOpenCard={(cardId) =>
                      setScreen({
                        name: 'cardDetail',
                        cardId,
                        fromBinderId: screen.binderId,
                      })
                    }
                  />
                )}
                {screen.name === 'cardDetail' && (
                  <CardDetailScreen
                    cardId={screen.cardId}
                    binderId={screen.fromBinderId}
                    actionNavPosition={
                      settings.actionNavPosition === 'top' ? 'top' : 'bottom'
                    }
                    onBack={() =>
                      setScreen({
                        name: 'binderDetail',
                        binderId: screen.fromBinderId ?? null,
                      })
                    }
                    onDestroyed={() =>
                      setScreen({
                        name: 'binderDetail',
                        binderId: screen.fromBinderId ?? null,
                      })
                    }
                  />
                )}
                {screen.name === 'sealPreview' && (
                  <SealPreviewScreen
                    photoUri={screen.photoUri}
                    templateId={screen.templateId}
                    dateFormatId={screen.dateFormatId}
                    sealedAtIso={screen.sealedAtIso}
                    showDate={screen.showDate}
                    locationLabel={screen.locationLabel}
                    showBinderName={screen.showBinderName}
                    onRetake={() => setScreen({ name: 'sealCamera' })}
                    onConfirmSeal={(p) =>
                      // Read the latest preview (a late place may have landed while the
                      // confirm dialog was open); ignore if back already left the preview.
                      setScreen((prev) => confirmPreview(prev, p))
                    }
                  />
                )}
                {screen.name === 'pickBinder' && (
                  <PickBinderScreen
                    photoUri={screen.photoUri}
                    templateId={screen.templateId}
                    dateFormatId={screen.dateFormatId}
                    sealedAtIso={screen.sealedAtIso}
                    compositeUri={screen.compositeUri}
                    width={screen.width}
                    height={screen.height}
                    showDate={screen.showDate}
                    locationLabel={screen.locationLabel}
                    showBinderName={screen.showBinderName}
                    onCancel={goBinders}
                    onSealPhaseChange={setSealPhase}
                    onDone={(_cardId, binderId) => {
                      void announceSealed(binderId, noticeFx);
                      setScreen({ name: 'binderDetail', binderId });
                    }}
                    onLateSeal={(outcome) =>
                      void announceLateSeal(outcome, {
                        ...noticeFx,
                        refresh: () => setDataVersion((v) => v + 1),
                      })
                    }
                  />
                )}
                {screen.name === 'settings' && (
                  <SettingsScreen
                    onBack={() => {
                      reloadSettings();
                      goBinders();
                    }}
                  />
                )}
              </SafeAreaView>
            )}
            {/* Above every screen, camera included: a late seal can land anywhere. */}
            {toast && (
              // Plain View owns pointerEvents="none" so the full-screen layer never takes touches.
              <View {...toastLayer}>
                <SafeAreaView edges={['bottom']}>
                  <View style={styles.toast}>
                    <Text style={styles.toastText}>{toast}</Text>
                  </View>
                </SafeAreaView>
              </View>
            )}
          </View>
        </I18nProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bootText: { color: colors.text, fontSize: 20, fontWeight: '600' },
  toast: {
    marginBottom: 24,
    backgroundColor: colors.surface2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastText: { color: colors.text, fontSize: 14 },
});
