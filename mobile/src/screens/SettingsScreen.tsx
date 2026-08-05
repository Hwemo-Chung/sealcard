import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TEMPLATE_LIST } from '../domain/templates';
import type { DateFormatId, Settings, TemplateId } from '../domain/types';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Props = {
  onBack: () => void;
};

export function SettingsScreen({ onBack }: Props) {
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

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={styles.link}>← 뒤로</Text>
      </Pressable>
      <Text style={styles.title}>설정</Text>

      <Text style={styles.section}>기본 템플릿</Text>
      {TEMPLATE_LIST.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => void patch({ defaultTemplateId: t.id as TemplateId })}
          style={[styles.row, settings.defaultTemplateId === t.id && styles.rowActive]}
        >
          <Text style={styles.rowText}>{t.label}</Text>
        </Pressable>
      ))}

      <Text style={[styles.section, { marginTop: space.lg }]}>날짜 형식</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: space.md,
    paddingTop: space.sm,
  },
  link: { color: colors.textMuted, fontSize: 16, marginBottom: space.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', marginBottom: space.lg },
  section: { color: colors.textMuted, marginBottom: space.sm, fontSize: 13 },
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
