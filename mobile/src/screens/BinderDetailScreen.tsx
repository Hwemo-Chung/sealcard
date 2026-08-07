import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFocusEffect } from '../hooks/useFocusEffect';
import type { Card } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Props = {
  binderId: string | null;
  onBack: () => void;
  onOpenCard: (cardId: string) => void;
};

export function BinderDetailScreen({ binderId, onBack, onOpenCard }: Props) {
  const { t, locale } = useI18n();
  const [title, setTitle] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const colW = (Dimensions.get('window').width - space.md * 2 - space.sm) / 2;

  const reload = useCallback(async () => {
    if (binderId === null) {
      setTitle(t('cardDetail.uncategorized'));
    } else {
      const b = await repo.getBinder(binderId);
      setTitle(b?.name ?? t('binderDetail.fallbackTitle'));
    }
    setCards(await repo.listCards(binderId));
  }, [binderId, locale, t]);

  useFocusEffect(reload);

  const onDeleteBinder = () => {
    if (binderId === null) return;
    Alert.alert(t('binderDetail.deleteTitle'), t('binderDetail.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('binderDetail.deleteAction'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            await repo.deleteBinder(binderId);
            onBack();
          })(),
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.link}>← {t('common.back')}</Text>
        </Pressable>
        {binderId !== null && (
          <Pressable onPress={onDeleteBinder} accessibilityRole="button">
            <Text style={styles.danger}>{t('binderDetail.deleteAction')}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {t('binderDetail.meta', { count: cards.length })}
      </Text>

      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        numColumns={2}
        columnWrapperStyle={styles.cols}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('binderDetail.empty')}</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onOpenCard(item.id)}
            style={[styles.cell, { width: colW }]}
            accessibilityRole="button"
          >
            <Image
              source={{ uri: item.imagePath }}
              style={{ width: colW, height: colW * 1.25, borderRadius: 6 }}
              resizeMode="cover"
            />
          </Pressable>
        )}
      />
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
  },
  link: { color: colors.textMuted, fontSize: 16 },
  danger: { color: colors.danger, fontSize: 14 },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    paddingHorizontal: space.md,
    marginTop: space.sm,
  },
  meta: {
    color: colors.textMuted,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  list: { padding: space.md, paddingBottom: space.xl },
  cols: { justifyContent: 'space-between', marginBottom: space.sm },
  cell: {},
  empty: { color: colors.textMuted, marginTop: space.lg },
});
