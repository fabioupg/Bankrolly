import { useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlayingCard } from '@/components/PlayingCard';
import { CARD_ASPECT, RANKS, SUITS, parseCards, serializeCards } from '@/utils/cards';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  label: string;
  /** Space-separated card string, e.g. "Ah Kd". */
  value: string;
  onChange: (value: string) => void;
  /** Max selectable cards (2 for hero, 5 for board). */
  max: number;
  /** Cards already used elsewhere (greyed out / not selectable). */
  disabledCards?: string[];
  hint?: string;
}

const GRID_PAD = spacing.md;
const GRID_GAP = 4;

export function CardSelectField({ label, value, onChange, max, disabledCards = [], hint }: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseCards(value);
  const disabled = new Set(disabledCards);

  const toggle = (card: string) => {
    const idx = selected.indexOf(card);
    if (idx >= 0) {
      const next = selected.slice();
      next.splice(idx, 1);
      onChange(serializeCards(next));
      return;
    }
    if (disabled.has(card) || selected.length >= max) return;
    onChange(serializeCards([...selected, card]));
  };

  const screenW = Dimensions.get('window').width;
  const cardW = (screenW - GRID_PAD * 2 - GRID_GAP * (RANKS.length - 1)) / RANKS.length;
  const cardH = cardW / CARD_ASPECT;

  return (
    <View>
      <Text style={styles.label}>
        {label}
        <Text style={styles.count}>  {selected.length}/{max}</Text>
      </Text>

      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        {selected.length === 0 ? (
          <Text style={styles.placeholder}>Tap to select cards</Text>
        ) : (
          <View style={styles.selectedRow}>
            {selected.map((c) => (
              <PlayingCard key={c} card={c} height={44} />
            ))}
          </View>
        )}
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Text style={styles.sheetSub}>{selected.length}/{max} selected</Text>
              </View>
              <Pressable onPress={() => onChange('')} hitSlop={10}>
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.grid}>
              {SUITS.map((suit) => (
                <View key={suit} style={styles.gridRow}>
                  {RANKS.map((rank) => {
                    const card = `${rank}${suit}`;
                    const isSel = selected.includes(card);
                    const isDis = disabled.has(card) && !isSel;
                    return (
                      <Pressable
                        key={card}
                        onPress={() => toggle(card)}
                        disabled={isDis}
                        style={{ opacity: isDis ? 0.22 : 1, marginRight: GRID_GAP, marginBottom: GRID_GAP }}
                      >
                        <PlayingCard
                          card={card}
                          height={cardH}
                          style={isSel ? styles.selectedCard : styles.unselectedCard}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            <Pressable style={styles.done} onPress={() => setOpen(false)}>
              <Text style={styles.doneLabel}>Done</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
    marginBottom: 6,
  },
  count: {
    color: colors.textDim,
    fontSize: typography.micro,
    fontWeight: '600',
  },
  field: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
    justifyContent: 'center',
  },
  placeholder: {
    color: colors.textDim,
    fontSize: typography.body,
  },
  selectedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.micro,
    marginTop: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: GRID_PAD,
    paddingTop: spacing.lg,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  sheetSub: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  clear: {
    color: colors.loss,
    fontSize: typography.body,
    fontWeight: '700',
  },
  grid: {
    paddingBottom: spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: colors.profit,
  },
  unselectedCard: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  done: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  doneLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: typography.body,
  },
});
