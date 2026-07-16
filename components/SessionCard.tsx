import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography, pnlColor } from '@/theme/colors';
import { formatDateShort, formatDuration, formatPnL } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';
import type { SessionEntry } from '@/utils/calculations';

interface Props {
  entry: SessionEntry;
  currency: Currency;
  onPress?: () => void;
  onLongPress?: () => void;
  compact?: boolean;
}

export function SessionCard({ entry, currency, onPress, onLongPress, compact }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        compact && styles.compactRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                entry.type === 'cash'
                  ? colors.accentSoft
                  : entry.type === 'online'
                  ? '#0e3a44'
                  : '#3a2a1f',
            },
          ]}
        >
          <Text style={styles.badgeText}>
            {entry.type === 'cash' ? 'CASH' : entry.type === 'online' ? 'ONLINE' : 'MTT'}
          </Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>{entry.label}</Text>
          <Text style={styles.sub}>
            {formatDateShort(entry.date)}
            {entry.durationMinutes ? ` • ${formatDuration(entry.durationMinutes)}` : ''}
          </Text>
        </View>
      </View>
      <Text style={[styles.profit, { color: pnlColor(entry.profit) }]}>
        {formatPnL(entry.profit, currency)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  compactRow: {
    padding: spacing.md,
  },
  pressed: {
    backgroundColor: colors.cardHover,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  meta: {
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  badgeText: {
    color: colors.text,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  sub: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  profit: {
    fontSize: typography.heading,
    fontWeight: '700',
  },
});
