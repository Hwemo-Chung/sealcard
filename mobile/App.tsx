import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { RootScreen } from './src/navigation/types';
import { BinderDetailScreen } from './src/screens/BinderDetailScreen';
import { BindersScreen } from './src/screens/BindersScreen';
import { CardDetailScreen } from './src/screens/CardDetailScreen';
import { PickBinderScreen } from './src/screens/PickBinderScreen';
import { SealCameraScreen } from './src/screens/SealCameraScreen';
import { SealPreviewScreen } from './src/screens/SealPreviewScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import type { Settings } from './src/domain/types';
import { I18nProvider } from './src/i18n/I18nProvider';
import * as repo from './src/storage/repository';
import { colors } from './src/theme';

export default function App() {
  const [screen, setScreen] = useState<RootScreen>({ name: 'binders' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void repo.getSettings().then(setSettings);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const goBinders = () => setScreen({ name: 'binders' });

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
          {cameraMode ? (
            <View style={styles.safe}>
              <SealCameraScreen
                defaultTemplateId={settings.defaultTemplateId}
                dateFormatId={settings.dateFormatId}
                onCancel={goBinders}
                onCaptured={(p) =>
                  setScreen({
                    name: 'sealPreview',
                    photoUri: p.photoUri,
                    templateId: p.templateId,
                    dateFormatId: p.dateFormatId,
                    sealedAtIso: p.sealedAtIso,
                  })
                }
              />
            </View>
          ) : (
            <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
              {screen.name === 'binders' && (
                <BindersScreen
                  onOpenBinder={(binderId) => setScreen({ name: 'binderDetail', binderId })}
                  onSeal={() => setScreen({ name: 'sealCamera' })}
                  onSettings={() => setScreen({ name: 'settings' })}
                />
              )}
              {screen.name === 'binderDetail' && (
                <BinderDetailScreen
                  binderId={screen.binderId}
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
                  onRetake={() => setScreen({ name: 'sealCamera' })}
                  onConfirmSeal={(p) =>
                    setScreen({
                      name: 'pickBinder',
                      photoUri: screen.photoUri,
                      templateId: screen.templateId,
                      dateFormatId: screen.dateFormatId,
                      sealedAtIso: screen.sealedAtIso,
                      compositeUri: p.compositeUri,
                      width: p.width,
                      height: p.height,
                    })
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
                  onCancel={goBinders}
                  onDone={(_cardId, binderId) => {
                    void repo.getBinder(binderId).then((b) => {
                      showToast(`밀봉됨 · ${b?.name ?? '바인더'}`);
                    });
                    setScreen({ name: 'binderDetail', binderId });
                  }}
                />
              )}
              {screen.name === 'settings' && (
                <SettingsScreen
                  onBack={() => {
                    void repo.getSettings().then(setSettings);
                    goBinders();
                  }}
                />
              )}
              {toast && (
                <View style={styles.toast} pointerEvents="none">
                  <Text style={styles.toastText}>{toast}</Text>
                </View>
              )}
            </SafeAreaView>
          )}
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
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: colors.surface2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastText: { color: colors.text, fontSize: 14 },
});
