import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionBuilder } from '@/components/ActionBuilder';
import { CardSelectField } from '@/components/CardSelectField';
import { Chip } from '@/components/Chip';
import { EquityCalculator } from '@/components/EquityCalculator';
import { FormField } from '@/components/FormField';
import { HandShareButton } from '@/components/HandShareButton';
import { PokerTable } from '@/components/PokerTable';
import { SeatActionSheet } from '@/components/SeatActionSheet';
import {
  GAME_VARIANTS,
  VARIANT_HOLE_CARDS,
  VARIANT_LABELS,
  parseCards,
  serializeCards,
  variantForCardCount,
  type GameVariant,
} from '@/utils/cards';
import {
  createTableState,
  tableToActionLine,
  withButton,
  withHeroSeat,
  MIN_PLAYERS,
  MAX_PLAYERS,
  type TableState,
} from '@/utils/table';
import { PrimaryButton } from '@/components/PrimaryButton';
import { promptUpgrade } from '@/components/UpgradePrompt';
import { useCanAdd } from '@/hooks/useCanAdd';
import { useHandStore } from '@/store/useHandStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import {
  HAND_TAGS,
  POSITIONS,
  STREETS,
  type ActionType,
  type HandTag,
  type Player,
  type Position,
  type SessionType,
  type Street,
} from '@/db/schema';
import { TAG_LABELS } from '@/components/HandNoteCard';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface FormState {
  sessionType: SessionType;
  street: Street;
  position: Position;
  heroCards: string;
  board: string;
  villainRangeNotes: string;
  actionLine: string;
  result: string;
  tag: HandTag;
  notes: string;
}

const PLAYER_COUNTS = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, i) => i + MIN_PLAYERS,
);

/** Rebuild table state from a saved JSON snapshot, or start a fresh 6-max table. */
function parseTableState(raw: string | null | undefined): TableState {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.seats) && typeof parsed.playerCount === 'number') {
        return parsed as TableState;
      }
    } catch {
      // Corrupt/legacy value — fall through to a fresh table.
    }
  }
  return createTableState(6);
}

export default function NewHandNote() {
  const { sessionId, sessionType: typeParam, id } = useLocalSearchParams<{
    sessionId?: string;
    sessionType?: SessionType;
    id?: string;
  }>();
  const editing = Boolean(id);
  const existing = useHandStore((s) => (id ? s.hands.find((h) => h.id === id) ?? null : null));
  const initialType: SessionType = typeParam === 'tournament' ? 'tournament' : 'cash';
  // Prefill from the existing note when editing; useState initializer runs once,
  // so later store updates don't clobber the user's in-progress edits.
  const [form, setForm] = useState<FormState>(() => ({
    sessionType: (existing?.sessionType as SessionType) ?? initialType,
    street: (existing?.street as Street) ?? 'preflop',
    position: (existing?.position as Position) ?? 'BTN',
    heroCards: existing?.heroCards ?? '',
    board: existing?.board ?? '',
    villainRangeNotes: existing?.villainRangeNotes ?? '',
    actionLine: existing?.actionLine ?? '',
    result: existing?.result != null ? String(existing.result) : '',
    tag: (existing?.tag as HandTag) ?? 'review',
    notes: existing?.notes ?? '',
  }));
  // Hold'em vs Omaha picker; inferred from the saved hero-card count when
  // editing so a stored PLO hand re-opens with the right limit.
  const [variant, setVariant] = useState<GameVariant>(() =>
    variantForCardCount(parseCards(existing?.heroCards ?? '').length),
  );
  const heroMax = VARIANT_HOLE_CARDS[variant];
  const [submitting, setSubmitting] = useState(false);
  const add = useHandStore((s) => s.add);
  const update = useHandStore((s) => s.update);
  const limit = useCanAdd('hand');
  const players = usePlayerStore((s) => s.players);

  // Visual table builder state (mirrored into actionLine + saved as JSON).
  const [table, setTable] = useState<TableState>(() => parseTableState(existing?.tableState));
  const [seatSheet, setSeatSheet] = useState<number | null>(null);
  // Monotonic counter for action ordering; seed past the highest saved seq.
  const seqRef = useRef(
    Math.max(0, ...table.seats.flatMap((s) => s.actions.map((a) => a.seq))) + 1,
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const setPlayerCount = (count: number) => setTable((t) => createTableState(count, t));

  /** Switch game variant; trim hero cards that no longer fit the new limit. */
  const setVariantAndTrim = (v: GameVariant) => {
    setVariant(v);
    const max = VARIANT_HOLE_CARDS[v];
    const cards = parseCards(form.heroCards);
    if (cards.length > max) set('heroCards', serializeCards(cards.slice(0, max)));
  };

  const assignPlayer = (seatIndex: number, player: Player | null) =>
    setTable((t) => ({
      ...t,
      seats: t.seats.map((s) =>
        s.index === seatIndex
          ? {
              ...s,
              playerId: player?.id ?? null,
              name: player ? player.nickname || player.name : s.isHero ? 'Hero' : '',
            }
          : s,
      ),
    }));

  const setHeroSeat = (seatIndex: number) => setTable((t) => withHeroSeat(t, seatIndex));
  const setButtonSeat = (seatIndex: number) => setTable((t) => withButton(t, seatIndex));

  const setSeatCards = (seatIndex: number, value: string) =>
    setTable((t) => ({
      ...t,
      seats: t.seats.map((s) => (s.index === seatIndex ? { ...s, cards: value } : s)),
    }));

  const addSeatAction = (seatIndex: number, action: ActionType, size: string) =>
    setTable((t) => ({
      ...t,
      seats: t.seats.map((s) =>
        s.index === seatIndex
          ? {
              ...s,
              actions: [...s.actions, { street: form.street, action, size, seq: seqRef.current++ }],
            }
          : s,
      ),
    }));

  const clearSeatActions = (seatIndex: number) =>
    setTable((t) => ({
      ...t,
      seats: t.seats.map((s) =>
        s.index === seatIndex
          ? { ...s, actions: s.actions.filter((a) => a.street !== form.street) }
          : s,
      ),
    }));

  const applyTableToActionLine = () => {
    const text = tableToActionLine(table);
    if (!text.trim()) {
      Alert.alert('Empty table', 'Assign at least one action on the table first.');
      return;
    }
    set('actionLine', form.actionLine.trim() ? `${form.actionLine.trim()}\n${text}` : text);
    // Sync the hero's seat position into the form when it maps to a known chip.
    const heroPos = table.seats.find((s) => s.isHero)?.position as Position | undefined;
    if (heroPos && POSITIONS.includes(heroPos)) set('position', heroPos);
  };

  const onSave = async () => {
    if (!form.actionLine.trim() && !form.notes.trim() && !form.heroCards.trim()) {
      Alert.alert('Empty hand', 'Add at least hero cards, action line, or notes.');
      return;
    }
    // Editing an existing note never adds a new one, so the plan limit only
    // gates fresh creates.
    if (!editing && !limit.canAdd) {
      promptUpgrade('hand', limit.current, limit.limit);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        sessionType: form.sessionType,
        street: form.street,
        position: form.position,
        heroCards: form.heroCards.trim(),
        board: form.board.trim(),
        villainRangeNotes: form.villainRangeNotes.trim(),
        actionLine: form.actionLine.trim(),
        result: Number(form.result) || 0,
        tag: form.tag,
        notes: form.notes.trim(),
        tableState: JSON.stringify(table),
      };
      if (editing && id) {
        await update(id, payload);
      } else {
        await add({ sessionId: sessionId ?? null, ...payload });
      }
      router.back();
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: editing ? 'Edit hand' : 'New hand' }} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {sessionId ? (
          <View style={styles.banner}>
            <Text style={styles.bannerLabel}>Linked to {form.sessionType} session</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.fieldLabel}>Session type</Text>
            <View style={styles.chips}>
              <Chip
                label="Cash"
                tone="accent"
                active={form.sessionType === 'cash'}
                onPress={() => set('sessionType', 'cash')}
              />
              <Chip
                label="Tournament"
                tone="accent"
                active={form.sessionType === 'tournament'}
                onPress={() => set('sessionType', 'tournament')}
              />
            </View>
          </View>
        )}

        <View>
          <Text style={styles.fieldLabel}>Game</Text>
          <View style={styles.chips}>
            {GAME_VARIANTS.map((v) => (
              <Chip
                key={v}
                label={VARIANT_LABELS[v]}
                tone="accent"
                active={variant === v}
                onPress={() => setVariantAndTrim(v)}
              />
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Street</Text>
          <View style={styles.chips}>
            {STREETS.map((s) => (
              <Chip
                key={s}
                label={s}
                tone="accent"
                active={form.street === s}
                onPress={() => set('street', s)}
              />
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Position</Text>
          <View style={styles.chips}>
            {POSITIONS.map((p) => (
              <Chip
                key={p}
                label={p}
                tone="accent"
                active={form.position === p}
                onPress={() => set('position', p)}
              />
            ))}
          </View>
        </View>

        <View style={styles.tableSection}>
          <View style={styles.tableHeader}>
            <Text style={styles.fieldLabel}>Table</Text>
            <Text style={styles.tableHint}>Tap a seat to set player & action</Text>
          </View>
          <View style={styles.chips}>
            {PLAYER_COUNTS.map((n) => (
              <Chip
                key={n}
                label={`${n}`}
                tone="accent"
                active={table.playerCount === n}
                onPress={() => setPlayerCount(n)}
              />
            ))}
          </View>
          <PokerTable state={table} heroCards={form.heroCards} onSeatPress={setSeatSheet} />
          <Pressable onPress={applyTableToActionLine} style={styles.tableApply}>
            <Text style={styles.tableApplyLabel}>↓ Insert table into action line</Text>
          </Pressable>
        </View>

        <CardSelectField
          label="Hero cards"
          value={form.heroCards}
          onChange={(v) => set('heroCards', v)}
          max={heroMax}
          disabledCards={parseCards(form.board)}
          hint={
            variant === 'NLH'
              ? 'Tap to pick your hole cards'
              : `Tap to pick your ${heroMax} ${VARIANT_LABELS[variant]} hole cards`
          }
        />
        <CardSelectField
          label="Board"
          value={form.board}
          onChange={(v) => set('board', v)}
          max={5}
          disabledCards={parseCards(form.heroCards)}
          hint="Flop, turn and river"
        />
        <FormField
          label="Villain range notes"
          placeholder="Tight reg, 3-bet 6%..."
          value={form.villainRangeNotes}
          onChangeText={(v) => set('villainRangeNotes', v)}
          multiline
          style={styles.multi}
        />
        <ActionBuilder
          onApply={(text) => {
            set('actionLine', form.actionLine.trim() ? `${form.actionLine.trim()}\n${text}` : text);
          }}
        />
        <FormField
          label="Action line"
          placeholder="UTG opens 3bb, Hero 3bets 9bb, BB calls..."
          value={form.actionLine}
          onChangeText={(v) => set('actionLine', v)}
          multiline
          style={styles.multi}
          hint="Build above with the structured picker, or type freely here."
        />

        <EquityCalculator heroCards={form.heroCards} board={form.board} holeCount={heroMax} />

        <FormField
          label="Result (chips / $)"
          placeholder="+250 or -120"
          keyboardType="numbers-and-punctuation"
          value={form.result}
          onChangeText={(v) => set('result', v)}
        />

        <View>
          <Text style={styles.fieldLabel}>Tag</Text>
          <View style={styles.chips}>
            {HAND_TAGS.map((t) => (
              <Chip
                key={t}
                label={TAG_LABELS[t]}
                tone="accent"
                active={form.tag === t}
                onPress={() => set('tag', t)}
              />
            ))}
          </View>
        </View>

        <FormField
          label="Notes"
          placeholder="Why I made this play..."
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          multiline
          style={styles.multi}
        />

        <HandShareButton
          heroCards={form.heroCards}
          board={form.board}
          position={form.position}
          street={form.street}
          result={Number(form.result) || 0}
          actionLine={form.actionLine}
        />

        <PrimaryButton label={editing ? 'Save changes' : 'Save hand'} onPress={onSave} loading={submitting} />
      </ScrollView>

      <SeatActionSheet
        visible={seatSheet != null}
        seatIndex={seatSheet}
        state={table}
        street={form.street}
        heroCards={form.heroCards}
        board={form.board}
        holeCardMax={heroMax}
        players={players}
        onClose={() => setSeatSheet(null)}
        onAssignPlayer={assignPlayer}
        onSetHero={setHeroSeat}
        onSetButton={setButtonSeat}
        onSetCards={setSeatCards}
        onSetHeroCards={(v) => set('heroCards', v)}
        onAddAction={addSeatAction}
        onClearActions={clearSeatActions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
    marginBottom: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  multi: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  tableSection: {
    gap: spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  tableHint: {
    color: colors.textDim,
    fontSize: typography.micro,
  },
  tableApply: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: spacing.xs,
  },
  tableApplyLabel: {
    color: colors.profit,
    fontSize: typography.small,
    fontWeight: '700',
  },
  banner: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerLabel: {
    color: colors.profit,
    fontWeight: '700',
    fontSize: typography.small,
  },
});
