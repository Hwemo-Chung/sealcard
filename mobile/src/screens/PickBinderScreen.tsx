import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import type { Binder, DateFormatId, TemplateId } from '../domain/types';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Props = {
  photoUri: string;
  templateId: TemplateId;
  dateFormatId: DateFormatId;
  sealedAtIso: string;
  compositeUri: string;
  width: number;
  height: number;
  onDone: (cardId: string, binderId: string) => void;
  onCancel: () => void;
};

export function PickBinderScreen({
  templateId,
  dateFormatId,
  sealedAtIso,
  compositeUri,
  width,
  height,
  onDone,
  onCancel,
}: Props) {
  const [binders, setBinders] = useState<Binder[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await repo.listBinders();
      setBinders(list);
      if (list[0]) setSelected(list[0].id);
    })();
  }, []);

  const createAndSelect = async () => {
    const b = await repo.createBinder(newName || '나의 첫 시리즈');
    setBinders((prev) => [b, ...prev]);
    setSelected(b.id);
    setNewName('');
  };

  const seal = async () => {
    if (!selected || busy) {
      if (!selected) Alert.alert('시리즈를 선택하세요');
      return;
    }
    setBusy(true);
    try {
      const card = await repo.sealCard({
        binderId: selected,
        templateId,
        dateFormatId,
        compositeUri,
        width,
        height,
        sealedAt: sealedAtIso,
      });
      onDone(card.id, selected);
    } catch {
      Alert.alert('밀봉하지 못했습니다', '다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>어느 시리즈에 꽂을까?</Text>
      <FlatList
        data={binders}
        keyExtractor={(b) => b.id}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>시리즈가 없습니다. 아래에서 만드세요.</Text>
        }
        renderItem={({ item }) => {
          const active = item.id === selected;
          return (
            <Pressable
              onPress={() => setSelected(item.id)}
              style={[styles.row, active && styles.rowActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={styles.rowText}>{item.name}</Text>
            </Pressable>
          );
        }}
      />
      <View style={styles.create}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="시리즈 이름"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <PrimaryButton label="새 바인더" onPress={() => void createAndSelect()} variant="ghost" />
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="취소" onPress={onCancel} variant="ghost" style={styles.btn} />
        <PrimaryButton
          label="꽂고 밀봉 완료"
          onPress={() => void seal()}
          loading={busy}
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    marginBottom: space.md,
  },
  list: { flex: 1, paddingHorizontal: space.md },
  empty: { color: colors.textMuted, marginBottom: space.md },
  row: {
    padding: space.md,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.sm,
  },
  rowActive: {
    borderColor: colors.accent,
  },
  rowText: { color: colors.text, fontSize: 16 },
  create: {
    padding: space.md,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    paddingBottom: space.lg,
  },
  btn: { flex: 1 },
});
