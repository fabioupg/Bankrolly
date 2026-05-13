import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { PlayerForm } from '@/components/PlayerForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { usePlayerStore } from '@/store/usePlayerStore';
import { PLAYER_HAND_RESULTS, type PlayerHandResult } from '@/db/schema';
import { colors, radius, spacing, typography } from '@/theme/colors';
import { formatDateShort } from '@/utils/formatters';

const RESULT_LABELS: Record<PlayerHandResult, string> = {
  hero_won: 'Hero won',
  villain_won: 'Villain won',
  split: 'Split',
  unknown: 'Unknown',
};

const RESULT_COLORS: Record<PlayerHandResult, string> = {
  hero_won: colors.profit,
  villain_won: colors.loss,
  split: colors.warn,
  unknown: colors.textMuted,
};

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const players = usePlayerStore((s) => s.players);
  const hands = usePlayerStore((s) => s.hands);
  const addHand = usePlayerStore((s) => s.addHand);
  const removeHand = usePlayerStore((s) => s.removeHand);

  const player = useMemo(
    () => (id ? players.find((p) => p.id === id) : undefined),
    [players, id],
  );
  const playerHands = useMemo(
    () => (id ? hands.filter((h) => h.playerId === id) : []),
    [hands, id],
  );

  const [draftDescription, setDraftDescription] = useState('');
  const [draftStakes, setDraftStakes] = useState('');
  const [draftResult, setDraftResult] = useState<PlayerHandResult>('unknown');
  const [submitting, setSubmitting] = useState(false);

  if (!player) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Player not found</Text>
      </View>
    );
  }

  const onAddHand = async () => {
    if (!draftDescription.trim()) {
      Alert.alert('Empty hand', 'Add a description.');
      return;
    }
    setSubmitting(true);
    try {
      await addHand({
        playerId: player.id,
        description: draftDescription.trim(),
        stakes: draftStakes.trim(),
        result: draftResult,
      });
      setDraftDescription('');
      setDraftStakes('');
      setDraftResult('unknown');
    } catch (err) {
      Alert.alert('Save failed', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onRemoveHand = (handId: string) => {
    Alert.alert('Delete hand?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeHand(handId) },
    ]);
  };

  const handsBlock = (
    <View style={styles.handsSection}>
      <SectionTitle title={`Hands (${playerHands.length})`} />

      <View style={styles.draftCard}>
        <Text style={styles.draftLabel}>Add a hand</Text>
        <FormField
          label="Description"
          placeholder="UTG opens 3bb, hero 3-bets KK from BTN, villain calls. Flop Js9h2c villain check, hero bets 60%, villain calls. Turn Th villain check, hero bets, villain raises..."
          value={draftDescription}
          onChangeText={setDraftDescription}
          multiline
          style={styles.multi}
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Stakes"
              placeholder="2/5"
              value={draftStakes}
              onChangeText={setDraftStakes}
            />
          </View>
        </View>
        <Text style={styles.fieldLabel}>Result</Text>
        <View style={styles.chips}>
          {PLAYER_HAND_RESULTS.map((r) => (
            <Chip
              key={r}
              label={RESULT_LABELS[r]}
              tone="accent"
              active={draftResult === r}
              onPress={() => setDraftResult(r)}
            />
          ))}
        </View>
        <PrimaryButton label="Save hand" onPress={onAddHand} loading={submitting} />
      </View>

      {playerHands.map((h) => {
        const result = (h.result as PlayerHandResult) ?? 'unknown';
        return (
          <Pressable
            key={h.id}
            onLongPress={() => onRemoveHand(h.id)}
            style={({ pressed }) => [styles.handCard, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.handHeader}>
              <View style={[styles.resultBadge, { backgroundColor: RESULT_COLORS[result] }]}>
                <Text style={styles.resultText}>{RESULT_LABELS[result]}</Text>
              </View>
              {h.stakes ? <Text style={styles.handStakes}>{h.stakes}</Text> : null}
              <Text style={styles.handDate}>{formatDateShort(h.createdAt)}</Text>
            </View>
            <Text style={styles.handDescription}>{h.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return <PlayerForm initial={player} mode="edit" footerContent={handsBlock} />;
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  notFoundTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  handsSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  draftCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  draftLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  multi: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  handCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  handHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  resultText: {
    color: '#0b0f0d',
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  handStakes: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  handDate: {
    color: colors.textDim,
    fontSize: typography.micro,
    marginLeft: 'auto',
  },
  handDescription: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 20,
  },
});
