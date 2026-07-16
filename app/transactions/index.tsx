import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { TRANSACTION_KIND_LABELS } from '@/components/TransactionForm';
import { useTransactionStore, transactionsNet } from '@/store/useTransactionStore';
import { useSettingsStore } from '@/store/useStatsStore';
import type { TransactionKind } from '@/db/schema';
import { formatPnL, formatDateShort } from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';

export default function TransactionsScreen() {
  const transactions = useTransactionStore((s) => s.transactions);
  const currency = useSettingsStore((s) => s.currency);

  const totals = useMemo(() => {
    const net = transactionsNet(transactions);
    const inflow = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const outflow = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    return { net, inflow, outflow };
  }, [transactions]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: 'Transactions' }} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>NET BANKROLL ADJUSTMENT</Text>
          <Text style={[styles.summaryValue, { color: pnlColor(totals.net) }]}>
            {formatPnL(totals.net, currency)}
          </Text>
          <View style={styles.summarySplit}>
            <View>
              <Text style={styles.summaryColLabel}>In</Text>
              <Text style={[styles.summaryColValue, { color: pnlColor(totals.inflow) }]}>
                {formatPnL(totals.inflow, currency)}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryColLabel}>Out</Text>
              <Text style={[styles.summaryColValue, { color: pnlColor(totals.outflow) }]}>
                {formatPnL(totals.outflow, currency)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Deposits, withdrawals, expenses and bonuses move your bankroll without being sessions —
          they never touch your win rate or hourly.
        </Text>

        <PrimaryButton label="+ New transaction" onPress={() => router.push('/transactions/new')} />

        <SectionTitle
          title={transactions.length ? `${transactions.length} transactions` : 'Transactions'}
        />
        {transactions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyBody}>
              Log deposits, withdrawals, expenses and rakeback to keep your bankroll number honest.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {transactions.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/transactions/${t.id}`)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.rowTop}>
                  <View style={[styles.kindBadge, t.amount < 0 && styles.kindBadgeOut]}>
                    <Text style={styles.kindBadgeText}>
                      {(
                        TRANSACTION_KIND_LABELS[t.kind as TransactionKind] ?? t.kind
                      ).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.rowVenue} numberOfLines={1}>
                    {t.venue || t.notes || '—'}
                  </Text>
                  <Text style={[styles.rowAmount, { color: pnlColor(t.amount) }]}>
                    {formatPnL(t.amount, currency)}
                  </Text>
                </View>
                <Text style={styles.rowMeta}>
                  {formatDateShort(t.date)}
                  {t.venue && t.notes ? ` · ${t.notes}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 1,
    fontWeight: '700',
  },
  summaryValue: { fontSize: 34, fontWeight: '800' },
  summarySplit: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xs },
  summaryColLabel: { color: colors.textDim, fontSize: typography.micro, letterSpacing: 0.5 },
  summaryColValue: { fontSize: typography.body, fontWeight: '700', marginTop: 2 },
  disclaimer: { color: colors.textDim, fontSize: typography.small, lineHeight: 18 },
  empty: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
    alignItems: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  emptyBody: { color: colors.textMuted, fontSize: typography.small, textAlign: 'center' },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kindBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  kindBadgeOut: { borderColor: colors.warn, backgroundColor: 'transparent' },
  kindBadgeText: {
    color: colors.text,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rowVenue: { color: colors.text, fontSize: typography.body, fontWeight: '700', flex: 1 },
  rowAmount: { fontSize: typography.body, fontWeight: '800' },
  rowMeta: { color: colors.textMuted, fontSize: typography.small },
});
