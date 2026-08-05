import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { formatSealDate } from '../domain/dates';
import { TEMPLATES } from '../domain/templates';
import type { DateFormatId, TemplateId } from '../domain/types';

type Props = {
  photoUri: string;
  templateId: TemplateId;
  dateFormatId: DateFormatId;
  sealedAtIso: string;
  /** Display width of the card; height derived from template aspect */
  width: number;
  style?: ViewStyle;
};

/**
 * Visual sealed card. Parent may wrap with ViewShot to capture composite.
 * After seal, only the exported image is stored — this component is for preview + capture.
 */
export const CardFace = forwardRef<View, Props>(function CardFace(
  { photoUri, templateId, dateFormatId, sealedAtIso, width, style },
  ref,
) {
  const t = TEMPLATES[templateId];
  const height = width / t.aspect;
  const inset = width * t.photoInset;
  const dateBandH = height * t.dateBand;
  const photoH = height - inset * 2 - dateBandH;
  const photoW = width - inset * 2;
  const dateLabel = formatSealDate(sealedAtIso, dateFormatId);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.card,
        {
          width,
          height,
          backgroundColor: t.background,
          borderColor: t.borderColor,
          borderWidth: t.borderWidth,
        },
        style,
      ]}
    >
      <View style={{ paddingHorizontal: inset, paddingTop: inset }}>
        <Image
          source={{ uri: photoUri }}
          style={{ width: photoW, height: photoH, backgroundColor: '#000' }}
          resizeMode="cover"
        />
      </View>
      <View
        style={[
          styles.dateBand,
          {
            height: dateBandH,
            paddingHorizontal: inset + 4,
            justifyContent: 'center',
            alignItems:
              t.dateAlign === 'left'
                ? 'flex-start'
                : t.dateAlign === 'right'
                  ? 'flex-end'
                  : 'center',
          },
        ]}
      >
        <Text style={[styles.date, { color: t.dateColor, fontSize: Math.max(12, width * 0.045) }]}>
          {dateLabel}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dateBand: {
    width: '100%',
  },
  date: {
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
