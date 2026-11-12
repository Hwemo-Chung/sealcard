import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { FLYOUT_PADDING, moveFlyoutLayout } from '../domain/flyout';
import { colors, space } from '../theme';
import {
  IconBinder,
  IconFolder,
  IconShare,
  IconTrash,
} from './NavIcons';

export type CardActionNavItem = 'share' | 'move' | 'destroy';

export type MoveOption = {
  id: string | null;
  label: string;
};

type Props = {
  labels: {
    share: string;
    move: string;
    destroy: string;
  };
  a11y: {
    share: string;
    move: string;
    destroy: string;
  };
  moveOptions: MoveOption[];
  shareBusy?: boolean;
  onShare: () => void;
  onDestroy: () => void;
  onMove: (binderId: string | null) => void;
};

/**
 * CollectUI-style floating pill action bar:
 * - idle: icon-only chips in a soft pill
 * - active: selected chip expands (icon + label)
 * - move: flyout menu above the bar (icon + label rows)
 * Dark-theme adaptation of https://collectui.com/.../bf71a0fa-...
 */
export function CardActionNav({
  labels,
  a11y,
  moveOptions,
  shareBusy = false,
  onShare,
  onDestroy,
  onMove,
}: Props) {
  const [active, setActive] = useState<CardActionNavItem | null>(null);
  const [flyout, setFlyout] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const { height: windowHeight } = useWindowDimensions();
  // Cap the menu so many binders never push the pill off-screen (PRD U6).
  const flyoutLayout = moveFlyoutLayout(moveOptions.length, windowHeight);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: flyout ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [flyout, fade]);

  const closeFlyout = () => {
    setFlyout(false);
    if (active === 'move') setActive(null);
  };

  const select = (item: CardActionNavItem) => {
    if (item === 'share') {
      setFlyout(false);
      setActive('share');
      onShare();
      // collapse label after short beat (share is one-shot)
      setTimeout(() => setActive((a) => (a === 'share' ? null : a)), 900);
      return;
    }
    if (item === 'destroy') {
      setFlyout(false);
      setActive('destroy');
      onDestroy();
      setTimeout(() => setActive((a) => (a === 'destroy' ? null : a)), 400);
      return;
    }
    // move toggles flyout
    if (active === 'move' && flyout) {
      closeFlyout();
      return;
    }
    setActive('move');
    setFlyout(true);
  };

  const pickMove = (id: string | null) => {
    onMove(id);
    closeFlyout();
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      {flyout && (
        <Animated.View
          style={[
            styles.flyout,
            {
              opacity: fade,
              transform: [
                {
                  translateY: fade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView
            // flyout container adds FLYOUT_PADDING; rows get the rest of the cap
            style={{ maxHeight: flyoutLayout.maxHeight - FLYOUT_PADDING }}
            showsVerticalScrollIndicator={flyoutLayout.scrollable}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
          {moveOptions.map((opt) => (
            <Pressable
              key={opt.id ?? '__uncat'}
              onPress={() => pickMove(opt.id)}
              style={({ pressed }) => [
                styles.flyoutRow,
                pressed && styles.flyoutRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              <IconBinder size={17} color={colors.textMuted} />
              <Text style={styles.flyoutLabel} numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
          </ScrollView>
        </Animated.View>
      )}

      <View style={styles.pill}>
        <NavChip
          expanded={active === 'share'}
          label={labels.share}
          a11y={a11y.share}
          busy={shareBusy}
          onPress={() => select('share')}
          icon={(c) => <IconShare size={19} color={c} />}
        />
        <NavChip
          expanded={active === 'move'}
          label={labels.move}
          a11y={a11y.move}
          onPress={() => select('move')}
          icon={(c) => <IconFolder size={19} color={c} />}
        />
        <NavChip
          expanded={active === 'destroy'}
          label={labels.destroy}
          a11y={a11y.destroy}
          danger
          onPress={() => select('destroy')}
          icon={(c) => <IconTrash size={19} color={c} />}
        />
      </View>
    </View>
  );
}

function NavChip({
  expanded,
  label,
  a11y,
  icon,
  onPress,
  busy,
  danger,
}: {
  expanded: boolean;
  label: string;
  a11y: string;
  icon: (color: string) => React.ReactNode;
  onPress: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  const idleColor = danger ? colors.danger : colors.textMuted;
  const activeColor = danger ? '#fff' : colors.primaryText;
  const color = expanded ? activeColor : idleColor;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: expanded, busy: !!busy }}
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.chip,
        expanded && (danger ? styles.chipExpandedDanger : styles.chipExpanded),
        pressed && styles.chipPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          {icon(color)}
          {expanded ? (
            <Text
              style={[styles.chipLabel, danger && styles.chipLabelDanger]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  flyout: {
    minWidth: 200,
    maxWidth: 280,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 6,
    // soft elevation (CollectUI card float)
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  flyoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  flyoutRowPressed: {
    backgroundColor: colors.surface2,
  },
  flyoutLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  chip: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  chipExpanded: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
  },
  chipExpandedDanger: {
    backgroundColor: colors.danger,
    paddingHorizontal: 14,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipLabel: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelDanger: {
    color: '#fff',
  },
});
