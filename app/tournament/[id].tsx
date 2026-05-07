import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { TournamentForm } from '@/components/TournamentForm';
import { HandNoteCard } from '@/components/HandNoteCard';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useHandStore } from '@/store/useHandStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { colors, spacing, typography } from '@/theme/colors';

export default function EditTournament() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tourneys = useTournamentStore((s) => s.tourneys);
  const allHands = useHandStore((s) => s.hands);
  const currency = useSettingsStore((s) => s.currency);

  const tournament = useMemo(
    () => (id ? tourneys.find((t) => t.id === id) : undefined),
    [tourneys, id],
  );
  const handsForSession = useMemo(
    () => (id ? allHands.filter((h) => h.sessionId === id) : []),
    [allHands, id],
  );

  if (!tournament) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Tournament not found</Text>
        <Text style={styles.notFoundBody}>It may have been deleted.</Text>
      </View>
    );
  }

  const linkedHands = handsForSession.length ? (
    <View style={styles.handsBlock}>
      <Text style={styles.handsTitle}>Linked hands ({handsForSession.length})</Text>
      <View style={{ gap: spacing.sm }}>
        {handsForSession.map((h) => (
          <HandNoteCard key={h.id} hand={h} currency={currency} />
        ))}
      </View>
    </View>
  ) : null;

  return <TournamentForm initial={tournament} mode="edit" footerContent={linkedHands} />;
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  notFoundTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  notFoundBody: {
    color: colors.textMuted,
  },
  handsBlock: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  handsTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: typography.body,
  },
});
