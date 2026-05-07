import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { CashSessionForm } from '@/components/CashSessionForm';
import { HandNoteCard } from '@/components/HandNoteCard';
import { useSessionStore } from '@/store/useSessionStore';
import { useHandStore } from '@/store/useHandStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { colors, spacing, typography } from '@/theme/colors';

export default function EditCashSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessions = useSessionStore((s) => s.sessions);
  const allHands = useHandStore((s) => s.hands);
  const currency = useSettingsStore((s) => s.currency);

  const session = useMemo(
    () => (id ? sessions.find((s) => s.id === id) : undefined),
    [sessions, id],
  );
  const handsForSession = useMemo(
    () => (id ? allHands.filter((h) => h.sessionId === id) : []),
    [allHands, id],
  );

  if (!session) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Session not found</Text>
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

  return <CashSessionForm initial={session} mode="edit" footerContent={linkedHands} />;
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
