import React, { forwardRef } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { formatSealDate } from '../domain/dates';
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
 * §14 Presentation Renderer — single pipeline for wall / share / wallpaper / widget.
 * Places sealed imagePath whole inside black frame + white mat. No re-bake of seal template.
 */
export const PresentationStage = forwardRef<View, PresentationStageProps>(
  function PresentationStage(
    {
      imageUri,
      binderName,
      sealedAtIso,
      dateFormatId,
      profile = 'screen',
      width: widthProp,
      style,
    },
    ref,
  ) {
    const screenW = Dimensions.get('window').width;
    const width = widthProp ?? Math.min(screenW, profile === 'widget' ? 320 : screenW);
    // Gallery room aspect ~ 3:4 stage
    const height =
      profile === 'wallpaper'
        ? width * (19.5 / 9)
        : profile === 'widget'
          ? width * 1.15
          : width * 1.28;

    const frame = Math.max(6, width * 0.028);
    const mat = Math.max(14, width * (profile === 'widget' ? 0.055 : 0.075));
    const labelH = Math.max(36, height * (profile === 'widget' ? 0.1 : 0.08));
    const artTop = frame + mat;
    const artBottom = height - frame - mat - labelH;
    const artLeft = frame + mat;
    const artRight = width - frame - mat;
    const artW = artRight - artLeft;
    const artH = artBottom - artTop;

    const dateLabel = formatSealDate(sealedAtIso, dateFormatId);
    const titleSize = Math.max(11, width * 0.038);
    const dateSize = Math.max(10, width * 0.032);

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.stage,
          {
            width,
            height,
            backgroundColor: profile === 'wallpaper' ? '#C9C2B4' : '#D9D3C7',
          },
          style,
        ]}
      >
        {/* Soft top light (E5: no particles) */}
        <View style={styles.spot} pointerEvents="none" />

        {/* Black frame + white mat + artwork */}
        <View
          style={[
            styles.frameOuter,
            {
              top: height * 0.08,
              left: width * 0.1,
              right: width * 0.1,
              bottom: height * 0.1,
            },
          ]}
        >
          <View style={styles.blackFrame}>
            <View style={styles.whiteMat}>
              <View style={styles.artWrap}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.art}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.wallLabel}>
                <Text style={[styles.title, { fontSize: titleSize }]} numberOfLines={1}>
                  {binderName}
                </Text>
                <Text style={[styles.date, { fontSize: dateSize }]} numberOfLines={1}>
                  {dateLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Keep layout numbers for capture sizing consumers */}
        <View style={{ display: 'none', width: artW, height: artH }} />
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
  spot: {
    position: 'absolute',
    top: -40,
    left: '15%',
    right: '15%',
    height: '45%',
    borderRadius: 200,
    backgroundColor: 'rgba(255,252,245,0.55)',
  },
  frameOuter: {
    position: 'absolute',
  },
  blackFrame: {
    flex: 1,
    backgroundColor: '#141414',
    padding: 7,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  whiteMat: {
    flex: 1,
    backgroundColor: '#F7F4EE',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  artWrap: {
    flex: 1,
    backgroundColor: '#EDEAE3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  art: {
    width: '100%',
    height: '100%',
  },
  wallLabel: {
    marginTop: 10,
    paddingHorizontal: 2,
    minHeight: 36,
    justifyContent: 'center',
  },
  title: {
    color: '#2A2620',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  date: {
    color: '#6B6560',
    marginTop: 2,
    fontWeight: '400',
    letterSpacing: 0.6,
  },
});

export const presentationChrome = {
  wallBg: '#D9D3C7',
  frame: '#141414',
  mat: '#F7F4EE',
  label: colors.text,
};
