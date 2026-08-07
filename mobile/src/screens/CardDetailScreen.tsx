import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { formatSealDate } from '../domain/dates';
import type { Binder, Card } from '../domain/types';
import { useFocusEffect } from '../hooks/useFocusEffect';
import { useI18n } from '../i18n/I18nProvider';
import { PresentActions } from '../presentation/PresentActions';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Props = {
  cardId: string;
  /** Binder context for sibling swipe (null = uncategorized). */
  binderId?: string | null;
  onBack: () => void;
  onDestroyed: () => void;
};

export function CardDetailScreen({
  cardId: initialCardId,
  binderId: binderIdProp,
  onBack,
  onDestroyed,
}: Props) {
  const { t, locale } = useI18n();
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [binderName, setBinderName] = useState('');
  const [binders, setBinders] = useState<Binder[]>([]);
  const [showMove, setShowMove] = useState(false);
  const listRef = useRef<FlatList<Card>>(null);
  const pageW = Dimensions.get('window').width;
  const imgW = Math.min(pageW - space.md * 2, 340);

  const reload = useCallback(async () => {
    const seed = await repo.getCard(initialCardId);
    if (!seed) {
      setCards([]);
      return;
    }
    const binderId =
      binderIdProp !== undefined ? binderIdProp : seed.binderId;
    const list = await repo.listCards(binderId);
    // Ensure current card is in list (edge: race)
    const ids = new Set(list.map((c) => c.id));
    const full = ids.has(seed.id) ? list : [seed, ...list];
    setCards(full);
    const i = Math.max(
      0,
      full.findIndex((c) => c.id === initialCardId),
    );
    setIndex(i);
    if (seed.binderId) {
      const b = await repo.getBinder(seed.binderId);
      setBinderName(b?.name ?? '');
    } else {
      setBinderName(t('cardDetail.uncategorized'));
    }
    setBinders(await repo.listBinders());
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: i, animated: false });
    });
  }, [initialCardId, binderIdProp, locale, t]);

  useFocusEffect(reload);

  useEffect(() => {
    setShowMove(false);
  }, [index]);

  const card = cards[index] ?? null;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / pageW);
    if (i >= 0 && i < cards.length && i !== index) setIndex(i);
  };

  if (!card) {
    return (
      <View style={styles.root}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← {t('common.back')}</Text>
        </Pressable>
        <Text style={styles.meta}>{t('cardDetail.notFound')}</Text>
      </View>
    );
  }

  const destroy = () => {
    Alert.alert(t('cardDetail.destroyTitle'), t('cardDetail.destroyBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('cardDetail.destroy'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            await repo.destroyCard(card.id);
            if (cards.length <= 1) {
              onDestroyed();
              return;
            }
            const next = cards.filter((c) => c.id !== card.id);
            setCards(next);
            const ni = Math.min(index, next.length - 1);
            setIndex(ni);
            requestAnimationFrame(() => {
              listRef.current?.scrollToIndex({ index: ni, animated: false });
            });
          })(),
      },
    ]);
  };

  const moveTo = (binderId: string | null) => {
    void (async () => {
      await repo.moveCard(card.id, binderId);
      setShowMove(false);
      // Leave to binder list of destination is heavy; refresh siblings in current binder
      await reload();
    })();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.link}>← {t('common.back')}</Text>
        </Pressable>
        {cards.length > 1 ? (
          <Text style={styles.counter}>
            {index + 1} / {cards.length}
          </Text>
        ) : (
          <View />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={cards}
        keyExtractor={(c) => c.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({
          length: pageW,
          offset: pageW * i,
          index: i,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          }, 50);
        }}
        renderItem={({ item }) => {
          const h = Math.min(
            (imgW * (item.height || 1)) / (item.width || 1),
            Dimensions.get('window').height * 0.42,
          );
          return (
            <View style={[styles.page, { width: pageW }]}>
              <Image
                source={{ uri: item.imagePath }}
                style={{ width: imgW, height: h, borderRadius: 4 }}
                resizeMode="contain"
              />
            </View>
          );
        }}
      />

      <ScrollView
        style={styles.actionsScroll}
        contentContainerStyle={styles.actionsContent}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.date}>
          {formatSealDate(card.sealedAt, card.dateFormatId)}
        </Text>
        <Text style={styles.meta}>
          {binderName} · {t(`template.${card.templateId}_label`)}
        </Text>
        <Text style={styles.frozen}>{t('cardDetail.frozen')}</Text>

        <PresentActions card={card} binderName={binderName} compact />

        <PrimaryButton
          label={t('cardDetail.move')}
          onPress={() => setShowMove((s) => !s)}
          variant="ghost"
          size="sm"
          style={{ marginTop: space.sm }}
        />
        {showMove && (
          <View style={styles.moveList}>
            {binders.map((b) => (
              <Pressable key={b.id} onPress={() => moveTo(b.id)} style={styles.moveRow}>
                <Text style={styles.moveText}>{b.name}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => moveTo(null)} style={styles.moveRow}>
              <Text style={styles.moveText}>{t('cardDetail.uncategorized')}</Text>
            </Pressable>
          </View>
        )}

        <PrimaryButton
          label={t('cardDetail.destroy')}
          onPress={destroy}
          variant="danger"
          size="sm"
          style={{ marginTop: 6 }}
          accessibilityLabel={t('cardDetail.destroyA11y')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  link: { color: colors.textMuted, fontSize: 15 },
  counter: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  actionsScroll: { flexGrow: 0, maxHeight: '42%' },
  actionsContent: {
    paddingHorizontal: space.md,
    paddingBottom: space.lg,
    paddingTop: 4,
  },
  date: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  meta: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    fontSize: 13,
  },
  frozen: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  moveList: { marginTop: 6, gap: 4 },
  moveRow: {
    paddingVertical: 10,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moveText: { color: colors.text, fontSize: 13 },
});
