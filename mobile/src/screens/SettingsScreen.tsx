import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TemplatePicker } from '../components/TemplatePicker';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '../config';
import type {
  ActionNavPosition,
  DateFormatId,
  LocalePreference,
  Settings,
  TemplateId,
} from '../domain/types';
import { isTemplateId } from '../domain/templates';
import { useI18n } from '../i18n/I18nProvider';
import { WidgetHomePreview } from '../presentation/WidgetHomePreview';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Props = {
  onBack: () => void;
};

const LANGS: { id: LocalePreference; labelKey: 'settings.languageSystem' | 'settings.languageKo' | 'settings.languageJa' | 'settings.languageEn' }[] = [
  { id: 'system', labelKey: 'settings.languageSystem' },
  { id: 'ko', labelKey: 'settings.languageKo' },
  { id: 'ja', labelKey: 'settings.languageJa' },
  { id: 'en', labelKey: 'settings.languageEn' },
];

export function SettingsScreen({ onBack }: Props) {
  const { t, preference, setPreference } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    void repo.getSettings().then(setSettings);
  }, []);

  const patch = async (p: Partial<Settings>) => {
    const next = await repo.updateSettings(p);
    setSettings(next);
  };

  if (!settings) {
    return <View style={styles.root} />;
  }

  const templateId: TemplateId = isTemplateId(settings.defaultTemplateId)
    ? settings.defaultTemplateId
    : 'polaroid';

  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  const widgetStatus = settings.widgetCardId
    ? t('settings.widgetCard', { id: settings.widgetCardId.slice(0, 10) })
    : settings.widgetBinderId
      ? t('settings.widgetBinder', { id: settings.widgetBinderId.slice(0, 10) })
      : t('settings.widgetUnset');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={styles.link}>← {t('common.back')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <Text style={styles.section}>{t('settings.defaultFrame')}</Text>
      <Text style={styles.sectionHint}>{t('settings.defaultFrameHint')}</Text>
      <TemplatePicker
        value={templateId}
        onChange={(id) => void patch({ defaultTemplateId: id })}
        variant="settings"
      />

      <Text style={[styles.section, { marginTop: space.lg }]}>
        {t('settings.dateFormat')}
      </Text>
      {(
        [
          { id: 'dot' as DateFormatId, label: 'YYYY.MM.DD' },
          { id: 'ko' as DateFormatId, label: 'YYYY년 M월 D일' },
        ] as const
      ).map((f) => (
        <Pressable
          key={f.id}
          onPress={() => void patch({ dateFormatId: f.id })}
          style={[styles.row, settings.dateFormatId === f.id && styles.rowActive]}
        >
          <Text style={styles.rowText}>{f.label}</Text>
        </Pressable>
      ))}

      <Text style={[styles.section, { marginTop: space.lg }]}>
        {t('settings.stampSection')}
      </Text>
      <Text style={styles.sectionHint}>{t('settings.stampHint')}</Text>
      <Pressable
        onPress={() => void patch({ showDate: !settings.showDate })}
        style={[styles.row, settings.showDate !== false && styles.rowActive]}
        accessibilityRole="switch"
        accessibilityState={{ checked: settings.showDate !== false }}
      >
        <Text style={styles.rowText}>{t('settings.showDate')}</Text>
        <Text style={styles.rowSide}>
          {settings.showDate !== false ? t('settings.on') : t('settings.off')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => void patch({ showLocation: !settings.showLocation })}
        style={[styles.row, !!settings.showLocation && styles.rowActive]}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!settings.showLocation }}
      >
        <Text style={styles.rowText}>{t('settings.showLocation')}</Text>
        <Text style={styles.rowSide}>
          {settings.showLocation ? t('settings.on') : t('settings.off')}
        </Text>
      </Pressable>
      <Text style={styles.sectionHint}>{t('settings.showLocationHint')}</Text>
      <Pressable
        onPress={() => void patch({ showBinderName: !settings.showBinderName })}
        style={[styles.row, !!settings.showBinderName && styles.rowActive]}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!settings.showBinderName }}
      >
        <Text style={styles.rowText}>{t('settings.showBinderName')}</Text>
        <Text style={styles.rowSide}>
          {settings.showBinderName ? t('settings.on') : t('settings.off')}
        </Text>
      </Pressable>
      <Text style={styles.sectionHint}>{t('settings.showBinderNameHint')}</Text>

      <Text style={[styles.section, { marginTop: space.lg }]}>
        {t('settings.actionNavSection')}
      </Text>
      <Text style={styles.sectionHint}>{t('settings.actionNavHint')}</Text>
      {(
        [
          { id: 'bottom' as ActionNavPosition, labelKey: 'settings.actionNavBottom' as const },
          { id: 'top' as ActionNavPosition, labelKey: 'settings.actionNavTop' as const },
        ] as const
      ).map((opt) => (
        <Pressable
          key={opt.id}
          onPress={() => void patch({ actionNavPosition: opt.id })}
          style={[
            styles.row,
            (settings.actionNavPosition ?? 'bottom') === opt.id && styles.rowActive,
          ]}
          accessibilityRole="button"
          accessibilityState={{
            selected: (settings.actionNavPosition ?? 'bottom') === opt.id,
          }}
        >
          <Text style={styles.rowText}>{t(opt.labelKey)}</Text>
        </Pressable>
      ))}

      <Text style={[styles.section, { marginTop: space.lg }]}>
        {t('settings.language')}
      </Text>
      {LANGS.map((lang) => (
        <Pressable
          key={lang.id}
          onPress={() => void setPreference(lang.id)}
          style={[styles.row, preference === lang.id && styles.rowActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: preference === lang.id }}
        >
          <Text style={styles.rowText}>{t(lang.labelKey)}</Text>
        </Pressable>
      ))}

      <Text style={[styles.section, { marginTop: space.lg }]}>
        {t('settings.widgetSection')}
      </Text>
      <Text style={styles.sectionHint}>{t('settings.widgetHint')}</Text>
      <View style={styles.row}>
        <Text style={styles.rowText}>{widgetStatus}</Text>
      </View>
      {(settings.widgetBinderId || settings.widgetCardId) && (
        <Pressable
          onPress={() =>
            void patch({ widgetBinderId: null, widgetCardId: null })
          }
          style={[styles.row, { marginTop: space.sm }]}
        >
          <Text style={[styles.rowText, { color: colors.danger }]}>
            {t('settings.widgetClear')}
          </Text>
        </Pressable>
      )}
      <WidgetHomePreview
        key={`${settings.widgetBinderId ?? ''}-${settings.widgetCardId ?? ''}`}
      />

      <Text style={[styles.section, { marginTop: space.lg }]}>
        {t('settings.about')}
      </Text>
      <View style={styles.row}>
        <Text style={styles.rowText}>
          {t('settings.version', { version })}
        </Text>
      </View>
      <Pressable
        onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        style={styles.row}
        accessibilityRole="link"
      >
        <Text style={styles.rowText}>{t('settings.privacy')}</Text>
      </Pressable>
      <Pressable
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        style={styles.row}
        accessibilityRole="link"
      >
        <Text style={styles.rowText}>{t('settings.contact')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xl,
  },
  link: { color: colors.textMuted, fontSize: 16, marginBottom: space.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', marginBottom: space.lg },
  section: { color: colors.textMuted, marginBottom: 4, fontSize: 13, fontWeight: '600' },
  sectionHint: { color: colors.textMuted, marginBottom: space.sm, fontSize: 12, opacity: 0.8 },
  row: {
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  rowActive: { borderColor: colors.accent },
  rowText: { color: colors.text, fontSize: 16, flex: 1 },
  rowSide: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
