import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TemplatePicker } from '../components/TemplatePicker';
import type { DateFormatId, Settings, TemplateId } from '../domain/types';
import { isTemplateId } from '../domain/templates';
import { useI18n } from '../i18n/I18nProvider';
import { WidgetHomePreview } from '../presentation/WidgetHomePreview';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Props = {
  onBack: () => void;
};

export function SettingsScreen({ onBack }: Props) {
  const { t } = useI18n();
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
  },
  rowActive: { borderColor: colors.accent },
  rowText: { color: colors.text, fontSize: 16 },
});
