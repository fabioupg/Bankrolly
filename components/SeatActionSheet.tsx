import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardSelectField } from '@/components/CardSelectField';
import { Chip } from '@/components/Chip';
import { ACTIONS, type ActionType, type Street } from '@/db/schema';
import { ACTION_NEEDS_SIZE, type TableState } from '@/utils/table';
import { parseCards } from '@/utils/cards';
import type { Player } from '@/db/schema';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  visible: boolean;
  seatIndex: number | null;
  state: TableState;
  /** Street the added actions are recorded against (driven by the form). */
  street: Street;
  /** Hero hole cards (single source of truth, lives in the form). */
  heroCards: string;
  /** Community cards, used to grey out already-dealt cards. */
  board: string;
  /** Hole cards per seat: 2 (Hold'em) or 4/5/6 (Omaha). Defaults to 2. */
  holeCardMax?: number;
  players: Player[];
  onClose: () => void;
  onAssignPlayer: (seatIndex: number, player: Player | null) => void;
  onSetHero: (seatIndex: number) => void;
  onSetButton: (seatIndex: number) => void;
  onSetCards: (seatIndex: number, value: string) => void;
  onSetHeroCards: (value: string) => void;
  onAddAction: (seatIndex: number, action: ActionType, size: string) => void;
  onClearActions: (seatIndex: number) => void;
}

/**
 * Bottom sheet to configure a single seat: assign a saved player or the hero,
 * set the dealer button, and append actions for the active street.
 */
export function SeatActionSheet({
  visible,
  seatIndex,
  state,
  street,
  heroCards,
  board,
  holeCardMax = 2,
  players,
  onClose,
  onAssignPlayer,
  onSetHero,
  onSetButton,
  onSetCards,
  onSetHeroCards,
  onAddAction,
  onClearActions,
}: Props) {
  const [action, setAction] = useState<ActionType>('fold');
  const [size, setSize] = useState('');

  const seat = seatIndex != null ? state.seats[seatIndex] : null;
  if (seatIndex == null || !seat) return null;

  const isButton = state.buttonSeat === seatIndex;
  const streetActions = seat.actions.filter((a) => a.street === street);

  // Cards already dealt elsewhere (board + every other seat) are greyed out so
  // the same card can't be assigned twice.
  const usedElsewhere = [
    ...parseCards(board),
    ...state.seats.flatMap((s) =>
      s.index === seatIndex ? [] : s.isHero ? parseCards(heroCards) : parseCards(s.cards),
    ),
  ];
  const seatCardsValue = seat.isHero ? heroCards : seat.cards;
  const setSeatCards = (value: string) =>
    seat.isHero ? onSetHeroCards(value) : onSetCards(seatIndex, value);

  const add = () => {
    onAddAction(seatIndex, action, ACTION_NEEDS_SIZE[action] ? size.trim() : '');
    setSize('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Seat {seatIndex + 1}</Text>
              <Text style={styles.sub}>
                {seat.position}
                {seat.isHero ? ' · Hero' : seat.name ? ` · ${seat.name}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Player assignment */}
            <Text style={styles.label}>Player</Text>
            <View style={styles.row}>
              <Chip
                label="★ Hero"
                tone="accent"
                active={seat.isHero}
                onPress={() => onSetHero(seatIndex)}
              />
              <Chip
                label="Empty"
                active={!seat.isHero && !seat.playerId}
                onPress={() => onAssignPlayer(seatIndex, null)}
              />
            </View>
            {players.length > 0 ? (
              <View style={styles.row}>
                {players.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.nickname || p.name}
                    tone="accent"
                    active={seat.playerId === p.id}
                    onPress={() => onAssignPlayer(seatIndex, p)}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>No saved players yet — add them under Players.</Text>
            )}

            {/* Hole cards */}
            <CardSelectField
              label={seat.isHero ? 'Hero hole cards' : 'Hole cards'}
              value={seatCardsValue}
              onChange={setSeatCards}
              max={holeCardMax}
              disabledCards={usedElsewhere}
              hint="Tap to deal this seat its cards"
            />

            {/* Dealer button */}
            <Text style={styles.label}>Dealer button</Text>
            <View style={styles.row}>
              <Chip
                label={isButton ? '● On this seat' : 'Set as dealer'}
                tone="accent"
                active={isButton}
                onPress={() => onSetButton(seatIndex)}
              />
            </View>

            {/* Actions */}
            <Text style={styles.label}>Action · {street}</Text>
            <View style={styles.row}>
              {ACTIONS.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  tone="accent"
                  active={action === a}
                  onPress={() => {
                    setAction(a);
                    if (!ACTION_NEEDS_SIZE[a]) setSize('');
                  }}
                />
              ))}
            </View>

            {ACTION_NEEDS_SIZE[action] ? (
              <TextInput
                value={size}
                onChangeText={setSize}
                keyboardType="decimal-pad"
                placeholder="Size (e.g. 3 or 2.5bb)"
                placeholderTextColor={colors.textDim}
                style={styles.sizeInput}
              />
            ) : null}

            <Pressable onPress={add} style={styles.addBtn}>
              <Text style={styles.addLabel}>+ Add action</Text>
            </Pressable>

            {streetActions.length > 0 ? (
              <View style={styles.added}>
                <View style={styles.addedHeader}>
                  <Text style={styles.addedLabel}>
                    {streetActions.length} action{streetActions.length === 1 ? '' : 's'} on {street}
                  </Text>
                  <Pressable onPress={() => onClearActions(seatIndex)} hitSlop={8}>
                    <Text style={styles.clear}>Clear</Text>
                  </Pressable>
                </View>
                {streetActions.map((a, i) => (
                  <Text key={`${a.seq}-${i}`} style={styles.addedItem}>
                    • {a.action}
                    {a.size ? ` ${a.size}` : ''}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  sub: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  done: {
    color: colors.profit,
    fontSize: typography.body,
    fontWeight: '700',
  },
  body: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.small,
  },
  sizeInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: typography.body,
    marginTop: spacing.xs,
  },
  addBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addLabel: { color: '#fff', fontWeight: '700', fontSize: typography.small },
  added: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
  },
  addedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addedLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  clear: {
    color: colors.loss,
    fontSize: typography.small,
    fontWeight: '700',
  },
  addedItem: {
    color: colors.text,
    fontSize: typography.small,
  },
});
