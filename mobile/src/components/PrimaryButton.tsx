import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

import { colors, space } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  /** Compact height for secondary toolbars (card detail actions). */
  size?: 'md' | 'sm';
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  size = 'md',
  style,
  accessibilityLabel,
}: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const sm = size === 'sm';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        sm && styles.baseSm,
        isPrimary && styles.primary,
        variant === 'ghost' && styles.ghost,
        isDanger && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={isPrimary ? colors.primaryText : colors.text}
          size={sm ? 'small' : 'small'}
        />
      ) : (
        <Text
          style={[
            styles.label,
            sm && styles.labelSm,
            isPrimary && styles.labelPrimary,
            isDanger && styles.labelDanger,
            variant === 'ghost' && styles.labelGhost,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseSm: {
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: 8,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelPrimary: {
    color: colors.primaryText,
  },
  labelGhost: {
    color: colors.text,
  },
  labelDanger: {
    color: '#fff',
  },
});
