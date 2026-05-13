import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { SessionCard } from '@/components/SessionCard';
import { TripForm } from '@/components/TripForm';
import { useTripStore } from '@/store/useTripStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useSettingsStore } from '@/store/useStatsStore';
import {
  EXPENSE_CATEGORY_LABELS,
  isTripActive,
  tripSummary,
  unifySessions,
} from '@/utils/calculations';
import { formatHours, formatPnL } from '@/utils/formatters';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/db/schema';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';

const CATEGORY_GLYPHS: Record<ExpenseCategory, string> = {
  hotel: '🏨',
  food: '🍽',
  drinks: '🍺',
  transport: '🚖',
  entrance: '🎟',
  tips: '💵',
  shopping: '🛍',
  other: '·',
};

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trips = useTripStore((s) => s.trips);
  const allExpenses = useTripStore((s) => s.expenses);
  const addExpense = useTripStore((s) => s.addExpense);
  const removeExpense = useTripStore((s) => s.removeExpense);
  const cash = useSessionStore((s) => s.sessions);
  const tourneys = useTournamentStore((s) => s.tourneys);
  const currency = useSettingsStore((s) => s.currency);

  const trip = useMemo(() => (id ? trips.find((t) => t.id === id) : undefined), [trips, id]);

  const summary = useMemo(
    () => (trip ? tripSummary(trip, cash, tourneys, allExpenses) : null),
    [trip, cash, tourneys, allExpenses],
  );

  const linkedSessions = useMemo(() => {
    if (!summary) return [];
    return unifySessions(summary.cashSessions, summary.tournaments);
  }, [summary]);

  const [draftCategory, setDraftCategory] = useState<ExpenseCategory>('food');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [draftDate, setDraftDate] = useState(new Date());
  const [submittingExpense, setSubmittingExpense] = useState(false);

  if (!trip || !summary) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Trip not found</Text>
      </View>
    );
  }

  const onAddExpense = async () => {
    const amt = Number(draftAmount);
    if (!isFinite(amt) || amt <= 0) {
      Alert.alert('Amount required', 'Enter a positive number.');
      return;
    }
    setSubmittingExpense(true);
    try {
      await addExpense({
        tripId: trip.id,
        category: draftCategory,
        description: draftDescription.trim(),
        amount: amt,
        date: draftDate.toISOString(),
      });
      setDraftDescription('');
      setDraftAmount('');
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const onRemoveExpense = (expId: string) => {
    Alert.alert('Delete expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeExpense(expId) },
    ]);
  };

  const overview = (
    <View style={styles.overviewBlock}>
      <View style={styles.bigCard}>
        <Text style={styles.bigCardLabel}>NET RESULT</Text>
        <Text style={[styles.bigCardValue, { color: pnlColor(summary.netResult) }]}>
          {formatPnL(summary.netResult, currency)}
        </Text>
        <Text style={styles.bigCardHint}>
          Poker {formatPnL(summary.totalPokerProfit, currency)} − expenses{' '}
          {formatPnL(-summary.totalExpenses, currency)}
        </Text>
        {isTripActive(trip) ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>● Live · day {dayOfTrip(trip.startDate)} of {summary.daysSpan}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsGrid}>
        <StatTile
          label="Cash"
          value={formatPnL(summary.totalCashProfit, currency)}
          tone={summary.totalCashProfit}
          sub={`${summary.cashSessions.length} sess. • ${formatHours(summary.totalCashMinutes)}`}
        />
        <StatTile
          label="Tournaments"
          value={formatPnL(summary.totalTournamentProfit, currency)}
          tone={summary.totalTournamentProfit}
          sub={`${summary.tournaments.length} entries`}
        />
        <StatTile
          label="Expenses"
          value={formatPnL(-summary.totalExpenses, currency)}
          tone={-1}
          sub={`${summary.expenses.length} items`}
        />
        <StatTile
          label="Invested"
          value={formatPnL(summary.totalInvested, currency)}
          tone={0}
          sub="Buy-ins total"
        />
      </View>
    </View>
  );

  const expensesBlock = (
    <View style={styles.section}>
      <SectionTitle title={`Expenses (${summary.expenses.length})`} />

      <View style={styles.draftCard}>
        <Text style={styles.draftLabel}>Add expense</Text>
        <View style={styles.chips}>
          {EXPENSE_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={`${CATEGORY_GLYPHS[c]} ${EXPENSE_CATEGORY_LABELS[c]}`}
              tone="accent"
              active={draftCategory === c}
              onPress={() => setDraftCategory(c)}
            />
          ))}
        </View>
        <View style={styles.row}>
          <View style={{ flex: 2 }}>
            <FormField
              label="Description"
              placeholder="Hotel night 3, Steakhouse..."
              value={draftDescription}
              onChangeText={setDraftDescription}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Amount"
              placeholder="120"
              keyboardType="decimal-pad"
              value={draftAmount}
              onChangeText={setDraftAmount}
            />
          </View>
        </View>
        <DateField label="Date" value={draftDate} onChange={setDraftDate} />
        <PrimaryButton label="Add expense" onPress={onAddExpense} loading={submittingExpense} />
      </View>

      {Object.keys(summary.expensesByCategory).length > 0 ? (
        <View style={styles.byCatCard}>
          <Text style={styles.byCatTitle}>By category</Text>
          {Object.entries(summary.expensesByCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amt]) => (
              <View key={cat} style={styles.byCatRow}>
                <Text style={styles.byCatLabel}>
                  {CATEGORY_GLYPHS[cat as ExpenseCategory] ?? '·'}{' '}
                  {EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] ?? cat}
                </Text>
                <Text style={styles.byCatValue}>{formatPnL(-amt, currency)}</Text>
              </View>
            ))}
        </View>
      ) : null}

      {summary.expenses.map((e) => (
        <Pressable
          key={e.id}
          onLongPress={() => onRemoveExpense(e.id)}
          style={({ pressed }) => [styles.expenseRow, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.expenseGlyph}>{CATEGORY_GLYPHS[e.category as ExpenseCategory] ?? '·'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.expenseDesc} numberOfLines={1}>
              {e.description || EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] || e.category}
            </Text>
            <Text style={styles.expenseSub}>
              {EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category}
            </Text>
          </View>
          <Text style={[styles.expenseAmount, { color: colors.loss }]}>
            {formatPnL(-e.amount, currency)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const sessionsBlock = (
    <View style={styles.section}>
      <SectionTitle title={`Sessions (${linkedSessions.length})`} />
      {linkedSessions.length === 0 ? (
        <View style={styles.emptyMini}>
          <Text style={styles.emptyMiniText}>
            No sessions linked yet. Add a cash session or tournament and select this trip.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {linkedSessions.map((entry) => (
            <SessionCard
              key={entry.id}
              entry={entry}
              currency={currency}
              onPress={() => {
                if (entry.type === 'cash') router.push(`/cash/${entry.id}`);
                else router.push(`/tournament/${entry.id}`);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <TripForm
      initial={trip}
      mode="edit"
      footerContent={
        <View>
          {overview}
          {sessionsBlock}
          {expensesBlock}
        </View>
      }
    />
  );
}

function StatTile({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: number;
  sub: string;
}) {
  const color = tone > 0 ? colors.profit : tone < 0 ? colors.loss : colors.text;
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
}

function dayOfTrip(startIso: string) {
  const start = new Date(startIso);
  const today = new Date();
  start.setHours(12, 0, 0, 0);
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  notFoundTitle: { color: colors.text, fontSize: typography.heading, fontWeight: '700' },
  overviewBlock: { marginTop: spacing.lg, gap: spacing.md },
  bigCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  bigCardLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 1,
    fontWeight: '700',
  },
  bigCardValue: { fontSize: 36, fontWeight: '800' },
  bigCardHint: { color: colors.textMuted, fontSize: typography.small, marginTop: 2 },
  liveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  liveBadgeText: { color: colors.profit, fontWeight: '700', fontSize: typography.micro },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tileLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tileValue: { fontSize: typography.heading, fontWeight: '800', marginTop: 4 },
  tileSub: { color: colors.textDim, fontSize: typography.micro, marginTop: 2 },
  section: { marginTop: spacing.lg, gap: spacing.md },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  byCatCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  byCatTitle: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    fontWeight: '700',
    marginBottom: 4,
  },
  byCatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  byCatLabel: { color: colors.text, fontSize: typography.small },
  byCatValue: { color: colors.loss, fontSize: typography.small, fontWeight: '700' },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  expenseGlyph: { fontSize: 22 },
  expenseDesc: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  expenseSub: { color: colors.textMuted, fontSize: typography.micro, marginTop: 2 },
  expenseAmount: { fontSize: typography.body, fontWeight: '700' },
  emptyMini: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyMiniText: {
    color: colors.textMuted,
    fontSize: typography.small,
    textAlign: 'center',
  },
});
