import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography, pnlColor } from '@/theme/colors';
import { formatDateShort, formatPnL } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';
import type { HandNote, HandTag } from '@/db/schema';

const TAG_COLORS: Record<HandTag, string> = {
  hero_call: '#7c5cff',
  fold_spot: '#94a3b8',
  bluff: '#fb923c',
  value: '#22c55e',
  mistake: '#ef4444',
  review: '#38bdf8',
};

const TAG_LABELS: Record<HandTag, string> = {
  hero_call: 'Hero Call',
  fold_spot: 'Fold Spot',
  bluff: 'Bluff',
  value: 'Value',
  mistake: 'Mistake',
  review: 'Review',
};

interface Props {
  hand: HandNote;
  currency: Currency;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function HandNoteCard({ hand, currency, onPress, onLongPress }: Props) {
  const tag = (hand.tag as HandTag) ?? 'review';
  const tagColor = TAG_COLORS[tag] ?? colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.tagBadge, { backgroundColor: tagColor }]}>
            <Text style={styles.tagText}>{TAG_LABELS[tag]}</Text>
          </View>
          <Text style={styles.position}>{hand.position}</Text>
          <Text style={styles.street}>{hand.street.toUpperCase()}</Text>
        </View>
        <Text style={[styles.result, { color: pnlColor(hand.result) }]}>
          {formatPnL(hand.result, currency)}
        </Text>
      </View>

      <View style={styles.cards}>
        <Text style={styles.heroCards}>{hand.heroCards || '— —'}</Text>
        {hand.board ? <Text style={styles.board}>vs {hand.board}</Text> : null}
      </View>

      {hand.actionLine ? (
        <Text style={styles.action} numberOfLines={3}>{hand.actionLine}</Text>
      ) : null}

      <Text style={styles.footer}>
        {formatDateShort(hand.createdAt)} • {hand.sessionType}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.cardHover,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexShrink: 1,
  },
  tagBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  tagText: {
    color: '#0b0f0d',
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  position: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  street: {
    color: colors.textDim,
    fontSize: typography.micro,
    letterSpacing: 0.6,
  },
  result: {
    fontWeight: '700',
    fontSize: typography.body,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  heroCards: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'],
  },
  board: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  action: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 19,
  },
  footer: {
    color: colors.textDim,
    fontSize: typography.micro,
    marginTop: 2,
  },
});

export { TAG_COLORS, TAG_LABELS };
