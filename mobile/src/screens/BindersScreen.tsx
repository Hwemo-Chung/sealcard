import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '../hooks/useFocusEffect';

import { PrimaryButton } from '../components/PrimaryButton';
import type { Binder } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Row = {
  id: string | null;
  name: string;
  count: number;
  thumb: string | null;
};

type Props = {
  onOpenBinder: (binderId: string | null) => void;
  onSeal: () => void;
  onSettings: () => void;
};

export function BindersScreen({ onOpenBinder, onSeal, onSettings }: Props) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const binders = await repo.listBinders();
    const mapped: Row[] = await Promise.all(
      binders.map(async (b: Binder) => ({
        id: b.id,
        name: b.name,
        count: await repo.countCardsInBinder(b.id),
        thumb: await repo.latestThumbInBinder(b.id),
      })),
    );
    const uncatCount = await repo.countCardsInBinder(null);
    if (uncatCount > 0) {
      mapped.push({
        id: null,
        name: t('cardDetail.uncategorized'),
        count: uncatCount,
        thumb: await repo.latestThumbInBinder(null),
      });
    }
    setRows(mapped);
    setLoading(false);
  }, [t]);

  useFocusEffect(reload);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('binders.title')}</Text>
        <Pressable
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel={t('binders.settingsA11y')}
        >
          <Text style={styles.link}>{t('binders.settings')}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{t('binders.hint')}</Text>

      {rows.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('binders.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('binders.emptyBody')}</Text>
          <PrimaryButton
            label={t('binders.seal')}
            onPress={onSeal}
            style={{ marginTop: space.lg }}
          />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id ?? 'uncategorized'}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => onOpenBinder(item.id)}
              accessibilityRole="button"
              accessibilityLabel={t('binders.rowA11y', {
                name: item.name,
                count: item.count,
              })}
            >
              <View style={styles.thumbWrap}>
                {item.thumb ? (
                  <Image source={{ uri: item.thumb }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]} />
                )}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {t('binders.cardCount', { count: item.count })}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {rows.length > 0 && (
        <View style={styles.fabBar}>
          <PrimaryButton
            label={t('binders.sealPlus')}
            onPress={onSeal}
            accessibilityLabel={t('binders.sealStartA11y')}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  link: { color: colors.textMuted, fontSize: 16 },
  hint: {
    color: colors.textMuted,
    paddingHorizontal: space.md,
    marginTop: space.xs,
    marginBottom: space.md,
  },
  list: { padding: space.md, paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: space.sm,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbWrap: { marginRight: space.md },
  thumb: { width: 64, height: 80, borderRadius: 6, backgroundColor: colors.surface2 },
  thumbEmpty: { borderWidth: 1, borderColor: colors.border },
  rowText: { flex: 1, justifyContent: 'center' },
  rowName: { color: colors.text, fontSize: 17, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, marginTop: 4 },
  empty: {
    flex: 1,
    padding: space.lg,
    justifyContent: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  emptyBody: { color: colors.textMuted, marginTop: space.sm, lineHeight: 22 },
  fabBar: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.lg,
  },
});
