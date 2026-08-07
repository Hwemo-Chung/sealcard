import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  FRAME_OVERLAYS,
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
  style?: StyleProp<ViewStyle>;
};

function MiniFrame({ spec, active }: { spec: TemplateSpec; active: boolean }) {
  const overlay = FRAME_OVERLAYS[spec.id];
  return (
    <View
      style={[
        styles.miniOuter,
        active && styles.miniOuterActive,
        spec.style === 'glass' || spec.style === 'neon'
          ? { backgroundColor: '#1a1f2e' }
          : { backgroundColor: colors.surface2 },
      ]}
    >
      {overlay ? (
        <View style={styles.miniOverlayWrap}>
          <View
            style={[
              styles.miniPhotoBg,
              { backgroundColor: spec.chipFrom },
            ]}
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: spec.chipTo, opacity: 0.45 }]} />
          </View>
          <Image source={overlay} style={styles.miniOverlay} resizeMode="stretch" />
        </View>
      ) : (
        <View
          style={[
            styles.miniCard,
            {
              backgroundColor: spec.background.startsWith('rgba') ? 'transparent' : spec.background,
              borderColor: spec.borderColor,
              borderWidth: Math.min(spec.borderWidth, 2),
              borderRadius: Math.min(spec.cornerRadius, 10),
            },
          ]}
        >
          <View
            style={[
              styles.miniPhoto,
              {
                margin: 5,
                marginBottom: 2,
                borderRadius: Math.min(spec.photoRadius, 6),
                backgroundColor: spec.chipFrom,
              },
            ]}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: 0.55,
                  backgroundColor: spec.chipTo,
                  borderRadius: Math.min(spec.photoRadius, 6),
                },
              ]}
            />
          </View>
          <View style={styles.miniDateLine}>
            <View style={[styles.miniDateBar, { backgroundColor: spec.dateColor, opacity: 0.7 }]} />
          </View>
        </View>
      )}
    </View>
  );
}

export function TemplatePicker({ value, onChange, variant = 'camera', style }: Props) {
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
      contentContainerStyle={styles.catRow}
    >
      <Pressable
        onPress={() => setCategory('all')}
        style={[
          styles.catChip,
          settingsMode && styles.catChipSettings,
          category === 'all' && (settingsMode ? styles.catChipActiveSettings : styles.catChipActive),
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: category === 'all' }}
      >
        <Text
          style={[
            styles.catText,
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
              settingsMode && styles.catChipSettings,
              on && (settingsMode ? styles.catChipActiveSettings : styles.catChipActive),
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text
              style={[
                styles.catText,
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
        contentContainerStyle={styles.cameraRow}
      >
        {items.map((spec) => {
          const active = spec.id === value;
          const label = t(`template.${spec.id}_label`);
          return (
            <Pressable
              key={spec.id}
              onPress={() => onChange(spec.id)}
              style={styles.cameraItem}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <MiniFrame spec={spec} active={active} />
              <Text
                style={[styles.cameraLabel, active && styles.cameraLabelActive]}
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
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.25)',
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
    gap: 12,
    alignItems: 'flex-end',
  },
  cameraItem: {
    width: 76,
    alignItems: 'center',
  },
  cameraLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '500',
  },
  cameraLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  miniOuter: {
    width: 64,
    height: 78,
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  miniOuterActive: {
    borderColor: colors.accent,
  },
  miniOverlayWrap: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  miniPhotoBg: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 14,
    borderRadius: 2,
  },
  miniOverlay: {
    width: '100%',
    height: '100%',
  },
  miniCard: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  miniPhoto: {
    flex: 1,
    overflow: 'hidden',
  },
  miniDateLine: {
    height: 10,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  miniDateBar: {
    height: 2,
    width: '55%',
    borderRadius: 1,
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
