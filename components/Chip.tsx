import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'accent' | 'danger';
}

export function Chip({ label, active, onPress, tone = 'default' }: Props) {
  const activeBg =
    tone === 'accent' ? colors.accent : tone === 'danger' ? colors.danger : colors.borderStrong;
  const activeFg = tone === 'default' ? colors.text : '#fff';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: activeBg, borderColor: activeBg },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.label, active && { color: activeFg, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
});
