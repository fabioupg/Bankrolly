import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({ label, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const bg = disabled
    ? colors.border
    : isDanger
    ? colors.danger
    : isPrimary
    ? colors.accent
    : 'transparent';
  const fg = isPrimary || isDanger ? '#fff' : colors.text;

  return (
    <Pressable
      onPress={() => !disabled && !loading && onPress()}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: pressed && !disabled ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
