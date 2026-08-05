import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { TEMPLATE_LIST, type TemplateSpec } from '../domain/templates';
import type { TemplateId } from '../domain/types';
import { colors, space } from '../theme';

type Props = {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  /** compact chips for camera; cards for settings */
  variant?: 'camera' | 'settings';
  style?: StyleProp<ViewStyle>;
};

function MiniFrame({ t, active }: { t: TemplateSpec; active: boolean }) {
  return (
    <View
      style={[
        styles.miniOuter,
        active && styles.miniOuterActive,
        t.style === 'glass' || t.style === 'neon'
          ? { backgroundColor: '#1a1f2e' }
          : { backgroundColor: colors.surface2 },
      ]}
    >
      <View
        style={[
          styles.miniCard,
          {
            backgroundColor: t.background.startsWith('rgba') ? 'transparent' : t.background,
            borderColor: t.borderColor,
            borderWidth: Math.min(t.borderWidth, 2),
            borderRadius: Math.min(t.cornerRadius, 10),
          },
        ]}
      >
        {/* fake photo */}
        <View
          style={[
            styles.miniPhoto,
            {
              margin: 5,
              marginBottom: 2,
              borderRadius: Math.min(t.photoRadius, 6),
              backgroundColor: t.chipFrom,
            },
          ]}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: 0.55,
                backgroundColor: t.chipTo,
                borderRadius: Math.min(t.photoRadius, 6),
              },
            ]}
          />
        </View>
        <View style={styles.miniDateLine}>
          <View style={[styles.miniDateBar, { backgroundColor: t.dateColor, opacity: 0.7 }]} />
        </View>
      </View>
      {t.style === 'glass' && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              backgroundColor: 'rgba(255,255,255,0.06)',
            },
          ]}
        />
      )}
    </View>
  );
}

export function TemplatePicker({ value, onChange, variant = 'camera', style }: Props) {
  if (variant === 'settings') {
    return (
      <View style={style}>
        {TEMPLATE_LIST.map((t) => {
          const active = t.id === value;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.id)}
              style={[styles.settingsRow, active && styles.settingsRowActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <MiniFrame t={t} active={active} />
              <View style={styles.settingsText}>
                <Text style={styles.settingsLabel}>{t.label}</Text>
                <Text style={styles.settingsSub}>{t.subtitle}</Text>
              </View>
              {active && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cameraRow}
      style={style}
    >
      {TEMPLATE_LIST.map((t) => {
        const active = t.id === value;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={styles.cameraItem}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.label}
          >
            <MiniFrame t={t} active={active} />
            <Text style={[styles.cameraLabel, active && styles.cameraLabelActive]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cameraRow: {
    paddingHorizontal: space.md,
    gap: 12,
    alignItems: 'flex-end',
  },
  cameraItem: {
    width: 72,
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
    padding: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  miniOuterActive: {
    borderColor: colors.accent,
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
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.sm,
    marginBottom: space.sm,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  settingsRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surface2,
  },
  settingsText: { flex: 1 },
  settingsLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  settingsSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  check: { color: colors.accent, fontSize: 18, fontWeight: '700', marginRight: 4 },
});
