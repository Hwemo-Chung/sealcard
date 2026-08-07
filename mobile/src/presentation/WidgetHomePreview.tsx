import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Card } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';
import { PresentationStage } from './PresentationStage';

/**
 * In-app preview of the P3 home widget cell.
 * Native Android App Widget still needs a dev-client module; this is the same renderer.
 */
export function WidgetHomePreview() {
  const { t } = useI18n();
  const [card, setCard] = useState<Card | null>(null);
  const [binderName, setBinderName] = useState(() => t('cardDetail.uncategorized'));

  useEffect(() => {
    void (async () => {
      const c = await repo.resolveWidgetCard();
      setCard(c);
      if (!c) return;
      if (c.binderId) {
        const b = await repo.getBinder(c.binderId);
        setBinderName(b?.name ?? t('cardDetail.uncategorized'));
      } else {
        setBinderName(t('cardDetail.uncategorized'));
      }
    })();
  }, [t]);

  if (!card) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('present.widgetPreviewEmpty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>{t('present.widgetPreviewCaption')}</Text>
      <PresentationStage
        imageUri={card.imagePath}
        binderName={binderName}
        sealedAtIso={card.sealedAt}
        dateFormatId={card.dateFormatId}
        profile="widget"
        width={280}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: space.md },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: space.sm,
    alignSelf: 'flex-start',
  },
  empty: {
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: space.sm,
  },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
