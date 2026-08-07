import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  TEMPLATE_CATEGORY_IDS,
  templatesInCategory,
  type TemplateCategoryId,
  type TemplateSpec,
} from '../domain/templates';
import type { TemplateId } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { colors, space } from '../theme';

type Props = {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  /** compact chips for camera; cards for settings */
  variant?: 'camera' | 'settings';
  /** smaller camera chips when panel is expanded but height-limited */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Style-based mini card (no stretched PNG overlays — those clipped/broke at chip size).
 * Mirrors CardFace proportions: inset photo + date band.
 */
function MiniFrame({
  spec,
  active,
  compact,
}: {
  spec: TemplateSpec;
  active: boolean;
  compact?: boolean;
}) {
  const outerW = compact ? 48 : 64;
  const outerH = Math.round(outerW / Math.min(Math.max(spec.aspect, 0.55), 0.95));
  const pad = Math.max(3, outerW * 0.08);
  const bandH = Math.max(8, outerH * Math.min(spec.dateBand, 0.2));
  const photoH = Math.max(8, outerH - pad * 2 - bandH);
  const photoR = Math.min(spec.photoRadius, compact ? 4 : 6);
  const cardR = Math.min(spec.cornerRadius, compact ? 8 : 10);
  const isNeon = spec.style === 'neon';
  const bg = isNeon
    ? '#050508'
    : spec.background.startsWith('rgba')
      ? '#2A2A2A'
      : spec.background;

  return (
    <View
      style={[
        styles.miniOuter,
        {
          width: outerW + 8,
          height: outerH + 8,
        },
        active && styles.miniOuterActive,
      ]}
    >
      <View
        style={{
          width: outerW,
          height: outerH,
          borderRadius: cardR,
          backgroundColor: bg,
          borderWidth: Math.min(spec.borderWidth || 1, 2),
          borderColor: spec.borderColor,
          overflow: 'hidden',
        }}
      >
        {isNeon && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: Math.min(spec.borderWidth, 2),
              left: Math.min(spec.borderWidth, 2),
              right: Math.min(spec.borderWidth, 2),
              bottom: Math.min(spec.borderWidth, 2),
              borderRadius: Math.max(0, cardR - Math.min(spec.borderWidth, 2)),
              borderWidth: Math.min(spec.rimWidth ?? 2, 2),
              borderColor: spec.rimColor ?? spec.chipTo,
            }}
          />
        )}
        {/* photo window */}
        <View
          style={{
            marginTop: pad,
            marginHorizontal: pad,
            height: photoH,
            borderRadius: photoR,
            backgroundColor: spec.chipFrom,
            overflow: 'hidden',
          }}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: spec.chipTo, opacity: 0.5 },
            ]}
          />
          {/* fake horizon line so chips look like photos */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '28%',
              height: 1,
              backgroundColor: 'rgba(0,0,0,0.12)',
            }}
          />
        </View>
        {/* date bar */}
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems:
              spec.dateAlign === 'left'
                ? 'flex-start'
                : spec.dateAlign === 'right'
                  ? 'flex-end'
                  : 'center',
            paddingHorizontal: pad,
          }}
        >
          <View
            style={{
              height: 2,
              width: '55%',
              borderRadius: 1,
              backgroundColor: spec.dateColor,
              opacity: 0.75,
            }}
          />
        </View>
        {/* 35mm-style rectangular sprockets */}
        {spec.deco === 'sprocket' && (
          <>
            <View style={[styles.miniSprocket, { left: 2 }]}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.miniSprocketHole} />
              ))}
            </View>
            <View style={[styles.miniSprocket, { right: 2 }]}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.miniSprocketHole} />
              ))}
            </View>
          </>
        )}
        {/* postage scallops — all 4 edges, larger dots on border */}
        {spec.deco === 'perforation' &&
          (() => {
            const d = 7;
            const step = d * 1.28;
            const topN = Math.max(4, Math.round(outerW / step) + 1);
            const sideN = Math.max(4, Math.round(outerH / step) + 1);
            const topXs = Array.from({ length: topN }, (_, i) =>
              (outerW * i) / (topN - 1),
            );
            const sideYs = Array.from({ length: sideN }, (_, i) =>
              (outerH * i) / (sideN - 1),
            );
            const half = d / 2;
            return (
              <>
                {topXs.map((x, i) => (
                  <View
                    key={`pt${i}`}
                    style={[
                      styles.miniPerfDot,
                      { width: d, height: d, borderRadius: half, top: -half, left: x - half },
                    ]}
                  />
                ))}
                {topXs.map((x, i) => (
                  <View
                    key={`pb${i}`}
                    style={[
                      styles.miniPerfDot,
                      {
                        width: d,
                        height: d,
                        borderRadius: half,
                        bottom: -half,
                        left: x - half,
                      },
                    ]}
                  />
                ))}
                {sideYs.slice(1, -1).map((y, i) => (
                  <View
                    key={`pl${i}`}
                    style={[
                      styles.miniPerfDot,
                      {
                        width: d,
                        height: d,
                        borderRadius: half,
                        left: -half,
                        top: y - half,
                      },
                    ]}
                  />
                ))}
                {sideYs.slice(1, -1).map((y, i) => (
                  <View
                    key={`pr${i}`}
                    style={[
                      styles.miniPerfDot,
                      {
                        width: d,
                        height: d,
                        borderRadius: half,
                        right: -half,
                        top: y - half,
                      },
                    ]}
                  />
                ))}
              </>
            );
          })()}
      </View>
    </View>
  );
}

export function TemplatePicker({
  value,
  onChange,
  variant = 'camera',
  compact = false,
  style,
}: Props) {
  const { t } = useI18n();
  const activeCat = useMemo(() => {
    const list = templatesInCategory('all');
    return list.find((spec) => spec.id === value)?.category ?? 'instant';
  }, [value]);

  const [category, setCategory] = useState<TemplateCategoryId | 'all'>(activeCat);
  const items = templatesInCategory(category === 'all' ? 'all' : category);

  const settingsMode = variant === 'settings';
  const catChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.catRow, compact && styles.catRowCompact]}
    >
      <Pressable
        onPress={() => setCategory('all')}
        style={[
          styles.catChip,
          compact && styles.catChipCompact,
          settingsMode && styles.catChipSettings,
          category === 'all' && (settingsMode ? styles.catChipActiveSettings : styles.catChipActive),
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: category === 'all' }}
      >
        <Text
          style={[
            styles.catText,
            compact && styles.catTextCompact,
            settingsMode && styles.catTextSettings,
            category === 'all' && (settingsMode ? styles.catTextActiveSettings : styles.catTextActive),
          ]}
        >
          {t('category.all')}
        </Text>
      </Pressable>
      {TEMPLATE_CATEGORY_IDS.map((id) => {
        const on = category === id;
        return (
          <Pressable
            key={id}
            onPress={() => setCategory(id)}
            style={[
              styles.catChip,
              compact && styles.catChipCompact,
              settingsMode && styles.catChipSettings,
              on && (settingsMode ? styles.catChipActiveSettings : styles.catChipActive),
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text
              style={[
                styles.catText,
                compact && styles.catTextCompact,
                settingsMode && styles.catTextSettings,
                on && (settingsMode ? styles.catTextActiveSettings : styles.catTextActive),
              ]}
            >
              {t(`category.${id}`)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  if (variant === 'settings') {
    return (
      <View style={style}>
        {catChips}
        <View style={styles.settingsGrid}>
          {items.map((spec) => {
            const active = spec.id === value;
            const label = t(`template.${spec.id}_label`);
            const sub = t(`template.${spec.id}_sub`);
            return (
              <Pressable
                key={spec.id}
                onPress={() => onChange(spec.id)}
                style={[styles.settingsCell, active && styles.settingsCellActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <MiniFrame spec={spec} active={active} />
                <Text style={styles.settingsLabel} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.settingsSub} numberOfLines={1}>
                  {sub}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={style}>
      {catChips}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.cameraRow, compact && styles.cameraRowCompact]}
      >
        {items.map((spec) => {
          const active = spec.id === value;
          const label = t(`template.${spec.id}_label`);
          return (
            <Pressable
              key={spec.id}
              onPress={() => onChange(spec.id)}
              style={[styles.cameraItem, compact && styles.cameraItemCompact]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <MiniFrame spec={spec} active={active} compact={compact} />
              <Text
                style={[
                  styles.cameraLabel,
                  compact && styles.cameraLabelCompact,
                  active && styles.cameraLabelActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  catRow: {
    paddingHorizontal: space.md,
    gap: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  catRowCompact: {
    paddingBottom: 4,
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  catChipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  catChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(232,226,217,0.18)',
  },
  catChipSettings: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  catChipActiveSettings: {
    borderColor: colors.accent,
    backgroundColor: colors.surface2,
  },
  catText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  catTextCompact: {
    fontSize: 11,
  },
  catTextActive: {
    color: '#fff',
  },
  catTextSettings: {
    color: colors.textMuted,
  },
  catTextActiveSettings: {
    color: colors.text,
  },
  cameraRow: {
    paddingHorizontal: space.md,
    gap: 10,
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  cameraRowCompact: {
    gap: 8,
  },
  cameraItem: {
    width: 78,
    alignItems: 'center',
  },
  cameraItemCompact: {
    width: 58,
  },
  cameraLabel: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 76,
    textAlign: 'center',
  },
  cameraLabelCompact: {
    marginTop: 3,
    fontSize: 10,
    maxWidth: 56,
  },
  cameraLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  miniOuter: {
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface2,
  },
  miniOuterActive: {
    borderColor: colors.accent,
  },
  miniSprocket: {
    position: 'absolute',
    top: '12%',
    bottom: '18%',
    width: 5,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  miniSprocketHole: {
    width: 4,
    height: 3,
    borderRadius: 0.5,
    backgroundColor: '#3A3A3A',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  miniPerfDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    zIndex: 3,
  },
  settingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
  settingsCell: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '48%',
    padding: space.sm,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  settingsCellActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surface2,
  },
  settingsLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  settingsSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
});
