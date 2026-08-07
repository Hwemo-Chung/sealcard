import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { PresentActions } from '../presentation/PresentActions';
import { PresentationStage } from '../presentation/PresentationStage';
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

type Mode = 'grid' | 'wall';

export function BinderDetailScreen({ binderId, onBack, onOpenCard }: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [mode, setMode] = useState<Mode>('grid');
  const [wallIndex, setWallIndex] = useState(0);
  const colW = (Dimensions.get('window').width - space.md * 2 - space.sm) / 2;
  const pageW = Dimensions.get('window').width;
  const listRef = useRef<FlatList<Card>>(null);

  const reload = useCallback(async () => {
    if (binderId === null) {
      setTitle(t('cardDetail.uncategorized'));
    } else {
      const b = await repo.getBinder(binderId);
      setTitle(b?.name ?? t('binderDetail.fallbackTitle'));
    }
    setCards(await repo.listCards(binderId));
  }, [binderId, t]);

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

  const onWallScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / pageW);
    if (i !== wallIndex && i >= 0 && i < cards.length) setWallIndex(i);
  };

  const wallCard = cards[wallIndex];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.link}>← {t('common.back')}</Text>
        </Pressable>
        {binderId !== null && mode === 'grid' && (
          <Pressable onPress={onDeleteBinder} accessibilityRole="button">
            <Text style={styles.danger}>{t('binderDetail.deleteAction')}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {t('binderDetail.meta', { count: cards.length })}
      </Text>

      {/* mode: grid | wall — no lock, no separate tab (E1, E7) */}
      <View style={styles.modeRow}>
        {(['grid', 'wall'] as const).map((m) => {
          const on = mode === m;
          const disabled = m === 'wall' && cards.length === 0;
          const label =
            m === 'grid' ? t('binderDetail.modeGrid') : t('binderDetail.modePresent');
          return (
            <Pressable
              key={m}
              disabled={disabled}
              onPress={() => {
                setMode(m);
                if (m === 'wall') setWallIndex(0);
              }}
              style={[styles.modeChip, on && styles.modeChipOn, disabled && { opacity: 0.35 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled }}
              accessibilityLabel={label}
            >
              <Text style={[styles.modeText, on && styles.modeTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'grid' ? (
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
      ) : (
        <View style={styles.wallRoot}>
          <FlatList
            ref={listRef}
            data={cards}
            keyExtractor={(c) => c.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onWallScroll}
            renderItem={({ item }) => (
              <View style={{ width: pageW, alignItems: 'center', justifyContent: 'center' }}>
                <PresentationStage
                  imageUri={item.imagePath}
                  binderName={title}
                  sealedAtIso={item.sealedAt}
                  dateFormatId={item.dateFormatId}
                  profile="screen"
                  width={Math.min(pageW - 24, 400)}
                />
              </View>
            )}
          />
          {wallCard && (
            <View style={styles.wallFooter}>
              <Text style={styles.wallCount}>
                {wallIndex + 1} / {cards.length}
              </Text>
              <Pressable onPress={() => onOpenCard(wallCard.id)}>
                <Text style={styles.link}>{t('binderDetail.cardDetail')}</Text>
              </Pressable>
              <PresentActions card={wallCard} binderName={title} compact />
            </View>
          )}
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
    marginBottom: space.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.surface2,
  },
  modeText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  modeTextOn: { color: colors.text },
  list: { padding: space.md, paddingBottom: space.xl },
  cols: { justifyContent: 'space-between', marginBottom: space.sm },
  cell: {},
  empty: { color: colors.textMuted, marginTop: space.lg },
  wallRoot: { flex: 1 },
  wallFooter: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  wallCount: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: 4,
    fontSize: 13,
  },
});
