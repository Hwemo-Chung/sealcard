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
import { useI18n } from '../i18n/I18nProvider';
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
  const { t } = useI18n();
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
    const b = await repo.createBinder(newName.trim() || t('pickBinder.defaultName'));
    setBinders((prev) => [b, ...prev]);
    setSelected(b.id);
    setNewName('');
  };

  const seal = async () => {
    if (!selected || busy) {
      if (!selected) Alert.alert(t('pickBinder.needSelect'));
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
      Alert.alert(t('pickBinder.failTitle'), t('pickBinder.failBody'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('pickBinder.title')}</Text>
      <FlatList
        data={binders}
        keyExtractor={(b) => b.id}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('pickBinder.empty')}</Text>
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
          placeholder={t('pickBinder.placeholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <PrimaryButton
          label={t('pickBinder.newBinder')}
          onPress={() => void createAndSelect()}
          variant="ghost"
        />
      </View>
      <View style={styles.actions}>
        <PrimaryButton
          label={t('common.cancel')}
          onPress={onCancel}
          variant="ghost"
          style={styles.btn}
        />
        <PrimaryButton
          label={t('pickBinder.finish')}
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
