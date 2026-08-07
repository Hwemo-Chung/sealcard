import React, { forwardRef, useMemo, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { formatSealDate } from '../domain/dates';
import { cardLayout } from '../domain/templates';
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
  /** Dark stage behind neon cards (preview only; still captured) */
  stageColor?: string;
  /** Stamp date in the date band (settings.showDate). Default true. */
  showDate?: boolean;
  /** Optional place stamp under/with date (settings.showLocation). */
  locationLabel?: string | null;
  /** Optional binder title stamp (settings.showBinderName). */
  binderLabel?: string | null;
};

/**
 * 35mm cinema film rails (KS-style sprocket geometry, scaled).
 * Real film: rectangular perforations, constant pitch, dark acetate base.
 */
function FilmSprocketRails({
  width,
  height,
  railW,
  holeColor,
}: {
  width: number;
  height: number;
  /** Rail band width (matches photoInset) */
  railW: number;
  holeColor: string;
}) {
  // KS 35mm proportions ≈ hole 2.8×2.0mm, pitch 4.75mm
  const holeW = Math.max(6, railW * 0.52);
  const holeH = Math.max(5, holeW * 0.72);
  const pitch = holeH * 1.72;
  const count = Math.max(7, Math.floor((height - holeH * 1.2) / pitch) + 1);
  const run = (count - 1) * pitch;
  const startY = (height - run) / 2;
  const rx = Math.min(1.5, holeW * 0.12);

  const rail = (side: 'left' | 'right') => {
    const xCenter = side === 'left' ? railW / 2 : width - railW / 2;
    return (
      <React.Fragment key={side}>
        {/* subtle rail gloss */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: railW,
            left: side === 'left' ? 0 : undefined,
            right: side === 'right' ? 0 : undefined,
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.06)',
            borderRightWidth: side === 'left' ? StyleSheet.hairlineWidth : 0,
            borderLeftWidth: side === 'right' ? StyleSheet.hairlineWidth : 0,
          }}
        />
        {Array.from({ length: count }).map((_, i) => {
          const y = startY + i * pitch;
          return (
            <View
              key={`${side}${i}`}
              style={{
                position: 'absolute',
                left: xCenter - holeW / 2,
                top: y - holeH / 2,
                width: holeW,
                height: holeH,
                borderRadius: rx,
                backgroundColor: holeColor,
                // slight inner shadow edge of punched film
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255,255,255,0.12)',
              }}
            />
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {rail('left')}
      {rail('right')}
    </View>
  );
}

/**
 * Cine gate + vertical edge marks on film rails:
 * left rail = date, right rail = location (film-edge style).
 */
/**
 * Cine gate + vertical edge marks on film rails:
 * left = date (+ binder title beside it), right = location.
 */
function FilmFrameChrome({
  inset,
  edgeV,
  photoW,
  photoH,
  dateLabel,
  locationLabel,
  binderLabel,
  showDate,
  width,
}: {
  inset: number;
  edgeV: number;
  photoW: number;
  photoH: number;
  dateLabel: string;
  locationLabel?: string | null;
  binderLabel?: string | null;
  showDate: boolean;
  width: number;
}) {
  // Real film gate is a hairline, not a thick letterbox
  const barH = Math.max(1, Math.round(photoH * 0.005));
  const edgeFs = Math.max(8, width * 0.03);
  // Rotated text needs height ≈ rail width after rotate; width ≈ run length along film
  const runW = photoH * 0.78;

  // Left rail: "date · binder" when both on
  const leftText = [
    showDate ? dateLabel : null,
    binderLabel?.trim() || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const railText = (
    side: 'left' | 'right',
    text: string,
    rotate: '-90deg' | '90deg',
  ) => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: side === 'left' ? 0 : undefined,
        right: side === 'right' ? 0 : undefined,
        top: edgeV + (photoH - runW) / 2,
        width: inset,
        height: runW,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
        overflow: 'visible',
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={{
          color: 'rgba(210,210,210,0.72)',
          fontSize: edgeFs,
          fontWeight: '700',
          letterSpacing: 1.6,
          textAlign: 'center',
          width: runW,
          transform: [{ rotate }],
        }}
      >
        {text}
      </Text>
    </View>
  );

  return (
    <>
      {/* Hairline gate only (not letterbox bars) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: inset,
          top: edgeV,
          width: photoW,
          height: barH,
          backgroundColor: 'rgba(0,0,0,0.75)',
          zIndex: 3,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: inset,
          top: edgeV + photoH - barH,
          width: photoW,
          height: barH,
          backgroundColor: 'rgba(0,0,0,0.75)',
          zIndex: 3,
        }}
      />
      {/* Left: date · binder title (vertical) */}
      {leftText ? railText('left', leftText, '-90deg') : null}
      {/* Right: location (vertical) */}
      {locationLabel ? railText('right', locationLabel, '90deg') : null}
    </>
  );
}

/**
 * Postage-stamp perforation (ref: Korean commemorative stamp).
 * True circles via SVG (View+borderRadius often renders as squares on Android).
 * Centers on the outline; parent overflow:hidden → half-circle scallops.
 */
function PerforationFrame({
  width,
  height,
  diameter,
  holeColor = '#0A0A0A',
}: {
  width: number;
  height: number;
  diameter: number;
  holeColor?: string;
}) {
  const r = diameter / 2;
  // Center-to-center ≈ 1.28×d → short paper bridge between scallops
  const idealStep = diameter * 1.28;

  const along = (span: number) => {
    const n = Math.max(3, Math.round(span / idealStep) + 1);
    const step = span / (n - 1);
    return Array.from({ length: n }, (_, i) => i * step);
  };

  const topXs = along(width);
  const sideYs = along(height);

  // Expand SVG past card bounds so full circles draw, then clip via parent overflow.
  const pad = r + 1;
  const svgW = width + pad * 2;
  const svgH = height + pad * 2;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -pad,
        top: -pad,
        width: svgW,
        height: svgH,
        zIndex: 4,
      }}
    >
      <Svg width={svgW} height={svgH}>
        {topXs.map((x, i) => (
          <Circle
            key={`t${i}`}
            cx={pad + x}
            cy={pad}
            r={r}
            fill={holeColor}
          />
        ))}
        {topXs.map((x, i) => (
          <Circle
            key={`b${i}`}
            cx={pad + x}
            cy={pad + height}
            r={r}
            fill={holeColor}
          />
        ))}
        {sideYs.slice(1, -1).map((y, i) => (
          <Circle
            key={`l${i}`}
            cx={pad}
            cy={pad + y}
            r={r}
            fill={holeColor}
          />
        ))}
        {sideYs.slice(1, -1).map((y, i) => (
          <Circle
            key={`r${i}`}
            cx={pad + width}
            cy={pad + y}
            r={r}
            fill={holeColor}
          />
        ))}
      </Svg>
    </View>
  );
}

/**
 * Magnific/Freepik-style circular rubber postmark (SVG).
 * Ref: monochrome retro postage stamps — double ring, mid bar, date, stars, cancel waves.
 * https://www.magnific.com/kr/free-photos-vectors/우표도장
 */
function PostmarkStamp({
  dateLabel,
  topLabel = 'SEALCARD',
  size,
  ink = '#8B1E1E',
}: {
  dateLabel: string;
  topLabel?: string;
  size: number;
  ink?: string;
}) {
  const r = size / 2;
  const stroke = Math.max(1.4, size * 0.026);
  const strokeThin = Math.max(1, size * 0.016);
  // Double CDS rings (Buenos Aires / Barcelona style)
  const outerR = r - size * 0.04;
  const midR = r - size * 0.09;
  const innerR = r - size * 0.14;
  const label = topLabel.toUpperCase().slice(0, 16);
  const topFs = Math.max(7, size * 0.085);
  const midFs = Math.max(8, size * 0.1);
  const dateFs = Math.max(8, size * 0.11);
  // Room for natural S-curve cancel waves to the right of the ring
  const waveW = size * 0.38;
  const totalW = size + waveW;
  const amp = size * 0.055; // wave amplitude
  const x0 = size * 0.88;
  const x1 = totalW - size * 0.03;
  const c1 = x0 + (x1 - x0) * 0.33;
  const c2 = x0 + (x1 - x0) * 0.66;

  /** Soft cubic S-curve cancel line (not a straight slash). */
  const wavePath = (y: number, phase: number) => {
    const a = amp * (1 + phase * 0.12);
    return `M ${x0} ${y} C ${c1} ${y - a} ${c2} ${y + a} ${x1} ${y}`;
  };

  return (
    <View
      pointerEvents="none"
      style={{
        width: totalW,
        height: size,
        opacity: 0.92,
        transform: [{ rotate: '-12deg' }],
      }}
    >
      <Svg width={totalW} height={size}>
        {/* Ink ghost offsets — rubber-stamp imperfect press */}
        <Circle
          cx={r + 0.8}
          cy={r + 0.6}
          r={outerR}
          fill="none"
          stroke={ink}
          strokeWidth={stroke}
          opacity={0.22}
        />
        {/* Outer ring */}
        <Circle
          cx={r}
          cy={r}
          r={outerR}
          fill="none"
          stroke={ink}
          strokeWidth={stroke}
        />
        {/* Dashed ring (perforation-like texture between rings) */}
        <Circle
          cx={r}
          cy={r}
          r={midR}
          fill="none"
          stroke={ink}
          strokeWidth={strokeThin}
          strokeDasharray={`${Math.max(2, size * 0.025)} ${Math.max(2.5, size * 0.03)}`}
          opacity={0.85}
        />
        {/* Inner ring */}
        <Circle
          cx={r}
          cy={r}
          r={innerR}
          fill="none"
          stroke={ink}
          strokeWidth={strokeThin}
        />
        {/* Horizontal mid bar (classic city name band) */}
        <Line
          x1={r - innerR * 0.92}
          y1={r - size * 0.02}
          x2={r + innerR * 0.92}
          y2={r - size * 0.02}
          stroke={ink}
          strokeWidth={Math.max(1.2, size * 0.022)}
        />
        <Line
          x1={r - innerR * 0.92}
          y1={r + size * 0.08}
          x2={r + innerR * 0.92}
          y2={r + size * 0.08}
          stroke={ink}
          strokeWidth={Math.max(1.2, size * 0.022)}
        />
        {/* Decorative stars (bottom arc, Magnific stamp motif) */}
        {[
          [r - size * 0.14, r + size * 0.28],
          [r, r + size * 0.32],
          [r + size * 0.14, r + size * 0.28],
        ].map(([sx, sy], i) => (
          <Circle
            key={`star${i}`}
            cx={sx}
            cy={sy}
            r={Math.max(1.2, size * 0.018)}
            fill={ink}
            opacity={0.9}
          />
        ))}
        {/* Natural wavy cancel curves (US-style, cubic S-paths) */}
        {[0, 1, 2, 3].map((i) => {
          const y = r - size * 0.2 + i * size * 0.105;
          return (
            <Path
              key={`w${i}`}
              d={wavePath(y, i)}
              fill="none"
              stroke={ink}
              strokeWidth={Math.max(1.1, size * 0.02)}
              strokeLinecap="round"
              opacity={0.72 + i * 0.04}
            />
          );
        })}
      </Svg>
      {/* Typography — Magnific CDS layout: top label · mid bar name · date */}
      <View style={[styles.postmarkTextWrap, { width: size }]} pointerEvents="none">
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            color: ink,
            fontSize: topFs,
            fontWeight: '700',
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            marginTop: size * 0.16,
          }}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
          style={{
            color: ink,
            fontSize: midFs,
            fontWeight: '800',
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginTop: size * 0.1,
          }}
        >
          SEALED
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            color: ink,
            fontSize: dateFs,
            fontWeight: '700',
            letterSpacing: 0.6,
            marginTop: size * 0.055,
          }}
        >
          {dateLabel}
        </Text>
      </View>
    </View>
  );
}

/**
 * Visual sealed card. Parent may wrap with ViewShot to capture composite.
 * Layout: fixed outer aspect; photo flexes; stamp band min-height from template
 * with adaptive type so multi-line stamps never overlap the photo.
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
    showDate = true,
    locationLabel = null,
    binderLabel = null,
  },
  ref,
) {
  // Single source of truth with camera (includes 1:1 square photo for minimal).
  const {
    t,
    height,
    inset,
    dateBandH,
    photoW,
    photoH,
    edgeV,
  } = cardLayout(templateId, width);

  const stampCount =
    (showDate ? 1 : 0) +
    (locationLabel ? 1 : 0) +
    (binderLabel ? 1 : 0) +
    (t.style === 'ticket' && (showDate || locationLabel || binderLabel) ? 1 : 0);

  // Fit stamp lines in date band; minimal gets extra vertical air under the square photo.
  const stampPadV =
    t.id === 'minimal'
      ? Math.max(10, dateBandH * 0.22)
      : Math.max(4, dateBandH * 0.12);
  const usableStampH = Math.max(10, dateBandH - stampPadV * 2);
  const perLine = stampCount > 0 ? usableStampH / stampCount : usableStampH;
  const baseFont = Math.max(10, width * (t.style === 'neon' ? 0.038 : 0.036));
  const fontSize = Math.min(baseFont, Math.max(9, perLine * 0.72));
  const subFont = Math.min(fontSize * 0.86, Math.max(8, perLine * 0.62));
  const ticketFont = Math.min(fontSize * 0.7, Math.max(7, perLine * 0.5));
  const dateLabel = formatSealDate(sealedAtIso, dateFormatId);
  const hasStamp = stampCount > 0;

  const alignItems =
    t.dateAlign === 'left' ? 'flex-start' : t.dateAlign === 'right' ? 'flex-end' : 'center';

  const needsStage = t.style === 'neon';
  const stage = stageColor ?? (needsStage ? '#050508' : 'transparent');

  const outerStyle = useMemo(() => {
    const shadowOpacity = t.shadow;
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

  const stampTextShadow =
    t.style === 'neon'
      ? {
          textShadowColor: 'rgba(0,0,0,0.4)',
          textShadowOffset: { width: 0, height: 1 } as const,
          textShadowRadius: 5,
        }
      : {};

  return (
    <View ref={ref} collapsable={false} style={[styles.card, outerStyle, style]}>
      {t.rimColor != null && (t.rimWidth ?? 0) > 0 && (
        <View
          pointerEvents="none"
          style={
            t.style === 'neon'
              ? {
                  // Concentric ring: inset by outer stroke so cyan/pink share
                  // the same geometric radius family (no mid-corner gap).
                  position: 'absolute' as const,
                  top: t.borderWidth,
                  left: t.borderWidth,
                  right: t.borderWidth,
                  bottom: t.borderWidth,
                  borderRadius: Math.max(0, t.cornerRadius - t.borderWidth),
                  borderWidth: t.rimWidth,
                  borderColor: t.rimColor,
                }
              : [
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: t.cornerRadius,
                    borderWidth: t.rimWidth,
                    borderColor: t.rimColor,
                  },
                ]
          }
        />
      )}

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
        <FilmSprocketRails
          width={width}
          height={height}
          railW={inset}
          holeColor={
            stageColor && stageColor !== 'transparent' ? stageColor : '#2A2A2A'
          }
        />
      )}

      {t.style === 'film' && (showDate || locationLabel || binderLabel) ? (
        <FilmFrameChrome
          inset={inset}
          edgeV={edgeV}
          photoW={photoW}
          photoH={photoH}
          dateLabel={dateLabel}
          locationLabel={locationLabel}
          binderLabel={binderLabel}
          showDate={showDate}
          width={width}
        />
      ) : null}

      {t.deco === 'perforation' && (
        <PerforationFrame
          width={width}
          height={height}
          // ~ stamp ref: scallop ≈ 1/13 of width
          diameter={Math.max(12, Math.round(width * 0.078))}
          // Punch color = outside stage (never transparent or scallops vanish)
          holeColor={
            stageColor && stageColor !== 'transparent'
              ? stageColor
              : '#0A0A0A'
          }
        />
      )}

      {/* Photo block — fixed geometry matches cardLayout / camera */}
      <View
        style={{
          paddingHorizontal: inset,
          // Film uses tiny edgeV (side rails only); others use full inset top
          paddingTop: edgeV,
          zIndex: 1,
        }}
      >
        {t.style === 'ornate' && t.accentColor && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: inset - 3,
              left: inset - 3,
              width: photoW + 6,
              height: photoH + 6,
              borderWidth: 1,
              borderColor: t.accentColor,
              opacity: 0.5,
              borderRadius: Math.max(0, t.photoRadius),
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

      {/* Postage postmark: spans photo bottom + white paper (not photo-only) */}
      {t.style === 'postage' && showDate
        ? (() => {
            const stampSize = Math.min(photoW, photoH) * 0.42;
            return (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  // Left on paper margin; vertically half on photo / half on white band
                  left: Math.max(2, inset * 0.25),
                  top: inset + photoH - stampSize * 0.48,
                  zIndex: 6,
                }}
              >
                <PostmarkStamp
                  dateLabel={dateLabel}
                  topLabel={binderLabel?.trim() || 'SEALCARD'}
                  size={stampSize}
                  ink="#8B1E1E"
                />
              </View>
            );
          })()
        : null}

      {t.style === 'ticket' && t.accentColor && (
        <View
          style={{
            height: 2,
            marginHorizontal: inset,
            marginTop: Math.max(3, inset * 0.15),
            backgroundColor: t.accentColor,
            borderRadius: 1,
            zIndex: 1,
          }}
        />
      )}

      {/* Stamp band — postage date lives in postmark; band only for extra lines */}
      <View
        style={[
          styles.dateBand,
          {
            height: dateBandH,
            paddingHorizontal: inset + 2,
            paddingVertical: stampPadV,
            // Minimal: text sits with breathing room under square photo
            justifyContent: t.id === 'minimal' ? 'flex-start' : 'center',
            alignItems,
            zIndex: 1,
            overflow: 'hidden',
          },
        ]}
      >
        {hasStamp && t.style === 'ticket' && (
          <Text
            numberOfLines={1}
            style={{
              color: t.dateColor,
              fontSize: ticketFont,
              opacity: 0.55,
              letterSpacing: 1.5,
              marginBottom: 1,
              fontWeight: '600',
              ...stampTextShadow,
            }}
          >
            SEALED
          </Text>
        )}
        {/* Plain band: date + binder on one row; skip postage/film special layouts */}
        {t.style !== 'postage' && t.style !== 'film' ? (
          <>
            {(showDate || binderLabel) && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent:
                    alignItems === 'flex-start'
                      ? 'flex-start'
                      : alignItems === 'flex-end'
                        ? 'flex-end'
                        : 'center',
                  gap: Math.max(6, width * 0.02),
                  maxWidth: '100%',
                }}
              >
                {showDate ? (
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    style={{
                      color: t.dateColor,
                      fontSize,
                      fontWeight: t.dateWeight,
                      letterSpacing: t.dateLetterSpacing * 0.85,
                      lineHeight: fontSize * 1.15,
                      flexShrink: 1,
                      ...stampTextShadow,
                    }}
                  >
                    {dateLabel}
                  </Text>
                ) : null}
                {binderLabel ? (
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={{
                      color: t.dateColor,
                      fontSize: subFont,
                      fontWeight: '600',
                      opacity: 0.9,
                      lineHeight: subFont * 1.15,
                      flexShrink: 1,
                      maxWidth: showDate ? '48%' : '100%',
                      ...stampTextShadow,
                    }}
                  >
                    {showDate ? `· ${binderLabel}` : binderLabel}
                  </Text>
                ) : null}
              </View>
            )}
            {locationLabel ? (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{
                  color: t.dateColor,
                  fontSize: subFont,
                  fontWeight: '500',
                  opacity: 0.88,
                  marginTop: showDate || binderLabel ? 2 : 0,
                  lineHeight: subFont * 1.15,
                  ...stampTextShadow,
                }}
              >
                {locationLabel}
              </Text>
            ) : null}
          </>
        ) : null}
        {/* Postage + binder but no date: show binder plain in band */}
        {t.style === 'postage' && !showDate && binderLabel ? (
          <Text
            numberOfLines={1}
            style={{
              color: t.dateColor,
              fontSize: subFont,
              fontWeight: '600',
              ...stampTextShadow,
            }}
          >
            {binderLabel}
          </Text>
        ) : null}
      </View>

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
  postmarkTextWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: '14%',
  },
});
