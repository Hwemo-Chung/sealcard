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

import { CardActionNav } from '../components/CardActionNav';
import type { ActionNavPosition, Binder, Card } from '../domain/types';
import { useFocusEffect } from '../hooks/useFocusEffect';
import { useI18n } from '../i18n/I18nProvider';
import {
  PresentActions,
  type PresentActionsHandle,
} from '../presentation/PresentActions';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Props = {
  cardId: string;
  /** Binder context for sibling swipe (null = uncategorized). */
  binderId?: string | null;
  /** Floating action pill dock — from settings. */
  actionNavPosition?: ActionNavPosition;
  onBack: () => void;
  onDestroyed: () => void;
};

export function CardDetailScreen({
  cardId: initialCardId,
  binderId: binderIdProp,
  actionNavPosition = 'bottom',
  onBack,
  onDestroyed,
}: Props) {
  const { t, locale } = useI18n();
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [binderName, setBinderName] = useState('');
  const [binders, setBinders] = useState<Binder[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const listRef = useRef<FlatList<Card>>(null);
  const presentRef = useRef<PresentActionsHandle>(null);
  const pageW = Dimensions.get('window').width;
  const imgW = Math.min(pageW - space.md * 2, 340);
  const navTop = actionNavPosition === 'top';

  const reload = useCallback(async () => {
    const seed = await repo.getCard(initialCardId);
    if (!seed) {
      setCards([]);
      return;
    }
    const binderId =
      binderIdProp !== undefined ? binderIdProp : seed.binderId;
    const list = await repo.listCards(binderId);
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
      await reload();
    })();
  };

  const moveOptions = [
    ...binders.map((b) => ({ id: b.id as string | null, label: b.name })),
    { id: null as string | null, label: t('cardDetail.uncategorized') },
  ];

  const actionNav = (
    <CardActionNav
      labels={{
        share: t('cardDetail.navShare'),
        move: t('cardDetail.navMove'),
        destroy: t('cardDetail.navDestroy'),
      }}
      a11y={{
        share: t('present.shareA11y'),
        move: t('cardDetail.moveA11y'),
        destroy: t('cardDetail.destroyA11y'),
      }}
      moveOptions={moveOptions}
      shareBusy={shareBusy}
      onShare={() => presentRef.current?.share()}
      onDestroy={destroy}
      onMove={moveTo}
    />
  );

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

      {navTop ? <View style={styles.navTopSlot}>{actionNav}</View> : null}

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
            Dimensions.get('window').height * 0.48,
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
        style={styles.gallery}
      />

      {/* Date/binder/template already on sealed image — no duplicate meta above actions */}
      <View style={styles.footer}>
        <PresentActions
          ref={presentRef}
          card={card}
          binderName={binderName}
          hideButton
          onBusyChange={setShareBusy}
        />

        {!navTop ? actionNav : null}
      </View>
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
  navTopSlot: {
    paddingHorizontal: space.sm,
  },
  gallery: { flex: 1 },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  footer: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    paddingTop: 4,
  },
  meta: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    fontSize: 13,
  },
});
