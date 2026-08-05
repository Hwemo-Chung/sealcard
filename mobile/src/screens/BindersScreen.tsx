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
import { UNCATEGORIZED_LABEL } from '../domain/types';
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
        name: UNCATEGORIZED_LABEL,
        count: uncatCount,
        thumb: await repo.latestThumbInBinder(null),
      });
    }
    setRows(mapped);
    setLoading(false);
  }, []);

  useFocusEffect(reload);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>바인더</Text>
        <Pressable onPress={onSettings} accessibilityRole="button" accessibilityLabel="설정">
          <Text style={styles.link}>설정</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>시리즈로 밀봉한 카드를 보관합니다.</Text>

      {rows.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>첫 시리즈를 만드세요</Text>
          <Text style={styles.emptyBody}>
            밀봉하면 바인더에 꽂힙니다. 수정할 수 없습니다.
          </Text>
          <PrimaryButton label="밀봉하기" onPress={onSeal} style={{ marginTop: space.lg }} />
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
              accessibilityLabel={`${item.name}, ${item.count}장`}
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
                <Text style={styles.rowMeta}>{item.count}장</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {rows.length > 0 && (
        <View style={styles.fabBar}>
          <PrimaryButton label="밀봉+" onPress={onSeal} accessibilityLabel="밀봉 시작" />
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
