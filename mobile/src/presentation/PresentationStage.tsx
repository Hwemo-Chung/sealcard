import React, { forwardRef } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import type { Card, DateFormatId, PresentationProfile } from '../domain/types';
import { colors } from '../theme';

export type PresentationStageProps = {
  /** Sealed composite — never rewritten by presentation */
  imageUri: string;
  binderName: string;
  sealedAtIso: string;
  dateFormatId: DateFormatId;
  profile?: PresentationProfile;
  /** Outer stage width; height fills proportionally */
  width?: number;
  style?: ViewStyle;
};

/**
 * §14 Presentation Renderer — sealed card as-is on a soft wall.
 * No second black frame / white mat (avoids double-framing the sealed template).
 */
export const PresentationStage = forwardRef<View, PresentationStageProps>(
  function PresentationStage(
    {
      imageUri,
      binderName,
      profile = 'screen',
      width: widthProp,
      style,
    },
    ref,
  ) {
    const screenW = Dimensions.get('window').width;
    const width = widthProp ?? Math.min(screenW, profile === 'widget' ? 320 : screenW);
    const height =
      profile === 'wallpaper'
        ? width * (19.5 / 9)
        : profile === 'widget'
          ? width * 1.2
          : width * 1.22;

    const padX = width * (profile === 'widget' ? 0.06 : 0.08);
    const padTop = height * (profile === 'wallpaper' ? 0.12 : 0.1);
    const captionH = Math.max(28, height * 0.07);
    const artMaxH = height - padTop - captionH - height * 0.08;
    const artMaxW = width - padX * 2;
    const titleSize = Math.max(12, width * 0.04);

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.stage,
          {
            width,
            height,
            backgroundColor:
              profile === 'wallpaper' ? '#1A1917' : profile === 'widget' ? '#121212' : '#141414',
          },
          style,
        ]}
      >
        <View
          style={[
            styles.artArea,
            {
              marginTop: padTop,
              marginHorizontal: padX,
              maxHeight: artMaxH,
              height: artMaxH,
            },
          ]}
        >
          <Image
            source={{ uri: imageUri }}
            style={[styles.art, { maxWidth: artMaxW, maxHeight: artMaxH }]}
            resizeMode="contain"
          />
        </View>
        {binderName ? (
          <Text
            style={[styles.caption, { fontSize: titleSize }]}
            numberOfLines={1}
          >
            {binderName}
          </Text>
        ) : null}
      </View>
    );
  },
);

/** Build props from a sealed Card row */
export function stagePropsFromCard(
  card: Card,
  binderName: string,
  profile: PresentationProfile = 'screen',
  width?: number,
): PresentationStageProps {
  return {
    imageUri: card.imagePath,
    binderName,
    sealedAtIso: card.sealedAt,
    dateFormatId: card.dateFormatId,
    profile,
    width,
  };
}

const styles = StyleSheet.create({
  stage: {
    overflow: 'hidden',
    alignSelf: 'center',
  },
  artArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: '100%',
    height: '100%',
  },
  caption: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
  },
});

export const presentationChrome = {
  wallBg: '#141414',
  frame: 'transparent',
  mat: 'transparent',
  label: colors.text,
};
