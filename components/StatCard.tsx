import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'profit' | 'loss' | 'neutral' | 'warn';
  style?: ViewStyle;
  compact?: boolean;
}

export function StatCard({ label, value, sublabel, tone = 'neutral', style, compact }: Props) {
  const valueColor =
    tone === 'profit' ? colors.profit
      : tone === 'loss' ? colors.loss
      : tone === 'warn' ? colors.warn
      : colors.text;

  return (
    <View style={[styles.card, compact && styles.compact, style]}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, { color: valueColor }, compact && styles.valueCompact]}>
        {value}
      </Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexGrow: 1,
    minWidth: 140,
  },
  compact: {
    padding: spacing.md,
    minWidth: 110,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  value: {
    fontSize: typography.title,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  valueCompact: {
    fontSize: typography.heading,
  },
  sublabel: {
    color: colors.textDim,
    fontSize: typography.small,
    marginTop: 2,
  },
});
