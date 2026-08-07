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
  /** Outer stage width; height derived from profile */
  width?: number;
  /** Optional caption under the card (off when parent header already shows name) */
  showCaption?: boolean;
  style?: ViewStyle;
};

/**
 * §14 Presentation Renderer — sealed card as-is.
 * No second black frame / white mat (sealed template is already framed).
 */
export const PresentationStage = forwardRef<View, PresentationStageProps>(
  function PresentationStage(
    {
      imageUri,
      binderName,
      profile = 'screen',
      width: widthProp,
      showCaption,
      style,
    },
    ref,
  ) {
    const screenW = Dimensions.get('window').width;
    const width = widthProp ?? Math.min(screenW, profile === 'widget' ? 300 : screenW - 32);

    const captionOn =
      showCaption ?? (profile === 'share' || profile === 'wallpaper' || profile === 'widget');

    // Height: room for card + optional caption; card uses contain so aspect is free.
    const height =
      profile === 'wallpaper'
        ? width * (19.5 / 9)
        : profile === 'widget'
          ? width * 1.15
          : profile === 'share'
            ? width * 1.2
            : undefined; // screen: hug content

    const pad = profile === 'widget' ? 8 : profile === 'share' ? 16 : 0;
    const captionSize = Math.max(12, width * 0.038);

    const body = (
      <>
        <View style={[styles.artArea, { padding: pad }]}>
          <Image
            source={{ uri: imageUri }}
            style={[
              styles.art,
              profile === 'wallpaper'
                ? { width: width - pad * 2, height: (height ?? width) * 0.72 }
                : profile === 'share' || profile === 'widget'
                  ? {
                      width: width - pad * 2,
                      height: (height ?? width) - pad * 2 - (captionOn ? 36 : 0),
                    }
                  : {
                      width,
                      // Prefer natural card aspect ~0.75–0.85; cap so footer fits
                      maxHeight: Dimensions.get('window').height * 0.48,
                      aspectRatio: 0.78,
                    },
            ]}
            resizeMode="contain"
          />
        </View>
        {captionOn && binderName ? (
          <Text style={[styles.caption, { fontSize: captionSize }]} numberOfLines={1}>
            {binderName}
          </Text>
        ) : null}
      </>
    );

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.stage,
          height != null ? { width, height } : { width },
          {
            backgroundColor:
              profile === 'wallpaper'
                ? '#1A1917'
                : profile === 'share'
                  ? '#0F0F0F'
                  : profile === 'widget'
                    ? '#121212'
                    : 'transparent',
          },
          style,
        ]}
      >
        {body}
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
    alignItems: 'center',
  },
  artArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    // size set inline per profile
  },
  caption: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
});

export const presentationChrome = {
  wallBg: colors.bg,
  frame: 'transparent',
  mat: 'transparent',
  label: colors.text,
};
