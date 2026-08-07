import React, { forwardRef, useMemo, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { formatSealDate } from '../domain/dates';
import { resolveTemplate, type TemplateSpec } from '../domain/templates';
import type { DateFormatId, TemplateId } from '../domain/types';

type Props = {
  /** Still photo for seal preview / capture. Omit when photoSlot is live camera. */
  photoUri?: string;
  /**
   * Live content in the photo window (e.g. CameraView).
   * Must use cover-style fill so it matches Image resizeMode="cover" after capture.
   */
  photoSlot?: ReactNode;
  templateId: TemplateId | string;
  dateFormatId: DateFormatId;
  sealedAtIso: string;
  /** Display width of the card; height derived from template aspect */
  width: number;
  style?: ViewStyle;
  /** Dark stage behind glass cards (preview only; still captured) */
  stageColor?: string;
};

function SprocketRail({ height, side }: { height: number; side: 'left' | 'right' }) {
  const holes = Math.max(6, Math.floor(height / 22));
  return (
    <View style={[styles.sprocketRail, side === 'left' ? { left: 4 } : { right: 4 }]}>
      {Array.from({ length: holes }).map((_, i) => (
        <View key={i} style={styles.sprocketHole} />
      ))}
    </View>
  );
}

function PerforationEdge({ width, top }: { width: number; top: boolean }) {
  const teeth = Math.max(10, Math.floor(width / 10));
  return (
    <View style={[styles.perfRow, top ? { top: -4 } : { bottom: -4 }]}>
      {Array.from({ length: teeth }).map((_, i) => (
        <View key={i} style={styles.perfTooth} />
      ))}
    </View>
  );
}

function GlassLayers({ t, width, height }: { t: TemplateSpec; width: number; height: number }) {
  return (
    <>
      {/* soft gradient simulation */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: t.backgroundAlt ?? 'transparent',
            borderRadius: t.cornerRadius,
          },
        ]}
      />
      {t.glassHighlight && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: height * 0.28,
            borderTopLeftRadius: t.cornerRadius,
            borderTopRightRadius: t.cornerRadius,
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        />
      )}
      {/* specular edge */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 1,
          left: width * 0.08,
          width: width * 0.35,
          height: 2,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.55)',
        }}
      />
    </>
  );
}

/**
 * Visual sealed card. Parent may wrap with ViewShot to capture composite.
 * After seal, only the exported image is stored — this component is for preview + capture.
 */
export const CardFace = forwardRef<View, Props>(function CardFace(
  {
    photoUri,
    photoSlot,
    templateId,
    dateFormatId,
    sealedAtIso,
    width,
    style,
    stageColor,
  },
  ref,
) {
  const t = resolveTemplate(templateId);
  const height = width / t.aspect;
  const inset = width * t.photoInset;
  const dateBandH = height * t.dateBand;
  const photoH = Math.max(1, height - inset * 2 - dateBandH);
  const photoW = Math.max(1, width - inset * 2);
  const dateLabel = formatSealDate(sealedAtIso, dateFormatId);
  const fontSize = Math.max(11, width * (t.style === 'neon' ? 0.042 : 0.04));

  const alignItems =
    t.dateAlign === 'left' ? 'flex-start' : t.dateAlign === 'right' ? 'flex-end' : 'center';

  const needsStage = t.style === 'glass' || t.style === 'neon';
  const stage = stageColor ?? (needsStage ? '#1a1f2e' : 'transparent');

  const outerStyle = useMemo(() => {
    const shadowOpacity = t.shadow;
    // Glass/neon: solid stage as base so view-shot capture isn't transparent void
    const baseBg = needsStage ? stage : t.background;
    return {
      width,
      height,
      backgroundColor: baseBg,
      borderColor: t.borderColor,
      borderWidth: t.borderWidth,
      borderRadius: t.cornerRadius,
      shadowColor: t.style === 'neon' ? t.borderColor : '#000',
      shadowOpacity,
      shadowRadius: 10 + shadowOpacity * 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6 + Math.round(shadowOpacity * 6),
    } as ViewStyle;
  }, [t, width, height, needsStage, stage]);

  return (
    <View ref={ref} collapsable={false} style={[styles.card, outerStyle, style]}>
        {/* Glass frosted overlay */}
        {t.style === 'glass' && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: t.background,
                borderRadius: t.cornerRadius,
              },
            ]}
          />
        )}

        {/* Rim ring */}
        {t.rimColor != null && (t.rimWidth ?? 0) > 0 && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: t.cornerRadius,
                borderWidth: t.rimWidth,
                borderColor: t.rimColor,
              },
            ]}
          />
        )}

        {t.style === 'glass' && <GlassLayers t={t} width={width} height={height} />}

        {/* Matte dual tone top bar */}
        {t.backgroundAlt && t.style === 'matte' && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: inset,
              backgroundColor: t.backgroundAlt,
            }}
          />
        )}

        {t.deco === 'sprocket' && (
          <>
            <SprocketRail height={height} side="left" />
            <SprocketRail height={height} side="right" />
          </>
        )}

        {t.deco === 'perforation' && (
          <>
            <PerforationEdge width={width} top />
            <PerforationEdge width={width} top={false} />
          </>
        )}

        <View style={{ paddingHorizontal: inset, paddingTop: inset, zIndex: 1 }}>
          {/* Ornate double line */}
          {t.style === 'ornate' && t.accentColor && (
            <View
              style={{
                position: 'absolute',
                top: inset - 4,
                left: inset - 4,
                right: inset - 4,
                bottom: -2,
                borderWidth: 1,
                borderColor: t.accentColor,
                opacity: 0.55,
                borderRadius: Math.max(0, t.photoRadius - 1),
              }}
            />
          )}
          <View
            style={{
              width: photoW,
              height: photoH,
              backgroundColor: '#111',
              borderRadius: t.photoRadius,
              overflow: 'hidden',
            }}
          >
            {photoSlot != null ? (
              photoSlot
            ) : photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={{ width: photoW, height: photoH }}
                resizeMode="cover"
              />
            ) : null}
          </View>
        </View>

        {/* Ticket accent strip */}
        {t.style === 'ticket' && t.accentColor && (
          <View
            style={{
              height: 3,
              marginHorizontal: inset,
              backgroundColor: t.accentColor,
              marginTop: 6,
              borderRadius: 1,
            }}
          />
        )}

        <View
          style={[
            styles.dateBand,
            {
              height: dateBandH,
              paddingHorizontal: inset + 4,
              justifyContent: 'center',
              alignItems,
              zIndex: 1,
            },
          ]}
        >
          {t.style === 'ticket' && (
            <Text
              style={{
                color: t.dateColor,
                fontSize: Math.max(9, fontSize * 0.7),
                opacity: 0.55,
                letterSpacing: 2,
                marginBottom: 2,
                fontWeight: '600',
              }}
            >
              SEALED
            </Text>
          )}
          <Text
            style={{
              color: t.dateColor,
              fontSize,
              fontWeight: t.dateWeight,
              letterSpacing: t.dateLetterSpacing,
              textShadowColor:
                t.style === 'glass' || t.style === 'neon'
                  ? 'rgba(0,0,0,0.35)'
                  : 'transparent',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: t.style === 'neon' ? 6 : 0,
            }}
          >
            {dateLabel}
          </Text>
        </View>

        {/* Neon outer glow fake (inner) */}
        {t.style === 'neon' && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: t.cornerRadius,
                borderWidth: 1,
                borderColor: t.rimColor ?? t.borderColor,
                opacity: 0.5,
              },
            ]}
          />
        )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  dateBand: {
    width: '100%',
  },
  sprocketRail: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    width: 14,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    zIndex: 2,
  },
  sprocketHole: {
    width: 8,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#111',
  },
  perfRow: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  perfTooth: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F0F0F',
  },
});
