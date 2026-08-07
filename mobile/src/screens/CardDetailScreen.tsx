import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { formatSealDate } from '../domain/dates';
import { resolveTemplate } from '../domain/templates';
import type { Binder, Card } from '../domain/types';
import { useFocusEffect } from '../hooks/useFocusEffect';
import { useI18n } from '../i18n/I18nProvider';
import { PresentActions } from '../presentation/PresentActions';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Props = {
  cardId: string;
  onBack: () => void;
  onDestroyed: () => void;
};

export function CardDetailScreen({ cardId, onBack, onDestroyed }: Props) {
  const { t, locale } = useI18n();
  const [card, setCard] = useState<Card | null>(null);
  const [binderName, setBinderName] = useState('');
  const [binders, setBinders] = useState<Binder[]>([]);
  const [showMove, setShowMove] = useState(false);

  const reload = useCallback(async () => {
    const c = await repo.getCard(cardId);
    setCard(c);
    if (!c) return;
    if (c.binderId) {
      const b = await repo.getBinder(c.binderId);
      setBinderName(b?.name ?? '');
    } else {
      setBinderName(t('cardDetail.uncategorized'));
    }
    setBinders(await repo.listBinders());
    // locale (not t): t is a stable translate ref; locale change must recompute labels
  }, [cardId, locale, t]);

  useFocusEffect(reload);

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
            onDestroyed();
          })(),
      },
    ]);
  };

  const moveTo = (binderId: string | null) => {
    void (async () => {
      await repo.moveCard(card.id, binderId);
      setShowMove(false);
      await reload();
    })();
  };

  const w = Math.min(Dimensions.get('window').width - space.md * 2, 360);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={styles.link}>← {t('common.back')}</Text>
      </Pressable>

      <Image
        source={{ uri: card.imagePath }}
        style={{ width: w, height: (w * card.height) / card.width, alignSelf: 'center', borderRadius: 4 }}
        resizeMode="contain"
      />

      <Text style={styles.date}>{formatSealDate(card.sealedAt, card.dateFormatId)}</Text>
      <Text style={styles.meta}>
        {binderName} · {resolveTemplate(card.templateId).label}
      </Text>
      <Text style={styles.frozen}>{t('cardDetail.frozen')}</Text>

      <PresentActions card={card} binderName={binderName} />

      <PrimaryButton
        label={t('cardDetail.move')}
        onPress={() => setShowMove((s) => !s)}
        variant="ghost"
        style={{ marginTop: space.md }}
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
        style={{ marginTop: space.sm }}
        accessibilityLabel={t('cardDetail.destroyA11y')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingTop: space.sm, paddingBottom: space.xl },
  link: { color: colors.textMuted, fontSize: 16, marginBottom: space.md },
  date: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: space.md,
    textAlign: 'center',
  },
  meta: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  frozen: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: space.sm,
  },
  moveList: { marginTop: space.sm, gap: space.xs },
  moveRow: {
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moveText: { color: colors.text },
});
