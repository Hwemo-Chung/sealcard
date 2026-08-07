import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { CardFace } from '../components/CardFace';
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
  showDate: boolean;
  locationLabel: string | null;
  showBinderName: boolean;
  onDone: (cardId: string, binderId: string) => void;
  onCancel: () => void;
};

export function PickBinderScreen({
  photoUri,
  templateId,
  dateFormatId,
  sealedAtIso,
  compositeUri,
  width,
  height,
  showDate,
  locationLabel,
  showBinderName,
  onDone,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const [binders, setBinders] = useState<Binder[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);
  const selectedName =
    binders.find((b) => b.id === selected)?.name ?? null;

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
      let finalUri = compositeUri;
      let finalW = width;
      let finalH = height;

      // Binder title is only known here — re-capture chrome with real name.
      if (showBinderName && cardRef.current) {
        // Let layout paint selected binder label
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        await new Promise((r) => setTimeout(r, 50));
        finalUri = await captureRef(cardRef, {
          format: 'jpg',
          quality: 0.92,
          result: 'tmpfile',
        });
        finalW = Math.round(width);
        finalH = Math.round(height);
      }

      const card = await repo.sealCard({
        binderId: selected,
        templateId,
        dateFormatId,
        compositeUri: finalUri,
        width: finalW,
        height: finalH,
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

      {/* Off-screen final composite when binder name stamp is on */}
      {showBinderName ? (
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
          <CardFace
            ref={cardRef}
            photoUri={photoUri}
            templateId={templateId}
            dateFormatId={dateFormatId}
            sealedAtIso={sealedAtIso}
            width={width}
            showDate={showDate}
            locationLabel={locationLabel}
            binderLabel={selectedName}
          />
        </View>
      ) : null}
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
  offscreen: {
    position: 'absolute',
    left: -4000,
    top: 0,
  },
});
