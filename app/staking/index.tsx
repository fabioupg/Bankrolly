import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { useStakingStore } from '@/store/useStakingStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { settleStaking, stakingTotals } from '@/utils/staking';
import { formatMoney, formatPnL, formatDateShort } from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';

export default function StakingScreen() {
  const deals = useStakingStore((s) => s.deals);
  const currency = useSettingsStore((s) => s.currency);

  const totals = useMemo(
    () =>
      stakingTotals(
        deals.map((d) => ({
          direction: d.direction as 'backed' | 'backing',
          buyIn: d.buyIn,
          percent: d.percent,
          markup: d.markup,
          makeupBefore: d.makeupBefore,
          result: d.result,
          settled: !!d.settled,
        })),
      ),
    [deals],
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: 'Staking' }} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>NET STAKING RESULT</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: pnlColor(totals.settledResult + totals.openResult) },
            ]}
          >
            {formatPnL(totals.settledResult + totals.openResult, currency)}
          </Text>
          <View style={styles.summarySplit}>
            <View>
              <Text style={styles.summaryColLabel}>Settled</Text>
              <Text style={[styles.summaryColValue, { color: pnlColor(totals.settledResult) }]}>
                {formatPnL(totals.settledResult, currency)}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryColLabel}>Open</Text>
              <Text style={[styles.summaryColValue, { color: pnlColor(totals.openResult) }]}>
                {formatPnL(totals.openResult, currency)}
              </Text>
            </View>
          </View>
          {totals.makeupYouOwe > 0 || totals.makeupOwedToYou > 0 ? (
            <View style={styles.makeupRow}>
              {totals.makeupYouOwe > 0 ? (
                <Text style={styles.makeupText}>
                  You owe {formatMoney(totals.makeupYouOwe, currency)} makeup
                </Text>
              ) : null}
              {totals.makeupOwedToYou > 0 ? (
                <Text style={styles.makeupText}>
                  {formatMoney(totals.makeupOwedToYou, currency)} makeup owed to you
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <Text style={styles.disclaimer}>
          Staking is tracked on its own here. It is not deducted from your session results or your
          bankroll total, so nothing is double-counted.
        </Text>

        <PrimaryButton label="+ New staking deal" onPress={() => router.push('/staking/new')} />

        <SectionTitle title={deals.length ? `${deals.length} deals` : 'Deals'} />
        {deals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No staking deals yet</Text>
            <Text style={styles.emptyBody}>
              Track backers who put you in action, or players you invest in — with markup and
              makeup.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {deals.map((d) => {
              const s = settleStaking({
                direction: d.direction as 'backed' | 'backing',
                buyIn: d.buyIn,
                percent: d.percent,
                markup: d.markup,
                makeupBefore: d.makeupBefore,
                result: d.result,
              });
              return (
                <Pressable
                  key={d.id}
                  onPress={() => router.push(`/staking/${d.id}`)}
                  style={({ pressed }) => [styles.deal, pressed && { opacity: 0.9 }]}
                >
                  <View style={styles.dealTop}>
                    <View
                      style={[styles.dirBadge, d.direction === 'backing' && styles.dirBadgeBacking]}
                    >
                      <Text style={styles.dirBadgeText}>
                        {d.direction === 'backed' ? 'BACKED' : 'BACKING'}
                      </Text>
                    </View>
                    <Text style={styles.dealName} numberOfLines={1}>
                      {d.counterparty || 'Unnamed'}
                    </Text>
                    {d.settled ? (
                      <Text style={styles.settledTag}>settled</Text>
                    ) : (
                      <Text style={styles.openTag}>open</Text>
                    )}
                  </View>
                  <View style={styles.dealBottom}>
                    <Text style={styles.dealMeta}>
                      {formatDateShort(d.date)} · {d.percent}%
                      {d.markup > 1 ? ` @ ${d.markup}×` : ''}
                    </Text>
                    <Text style={[styles.dealResult, { color: pnlColor(s.yourResult) }]}>
                      {formatPnL(s.yourResult, currency)}
                    </Text>
                  </View>
                  {s.makeupAfter > 0 && !d.settled ? (
                    <Text style={styles.dealMakeup}>
                      Makeup outstanding: {formatMoney(s.makeupAfter, currency)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
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
  makeupRow: { gap: 2, marginTop: spacing.xs },
  makeupText: { color: colors.warn, fontSize: typography.small, fontWeight: '600' },
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
  deal: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  dealTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dirBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  dirBadgeBacking: { borderColor: colors.warn, backgroundColor: 'transparent' },
  dirBadgeText: {
    color: colors.text,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dealName: { color: colors.text, fontSize: typography.body, fontWeight: '700', flex: 1 },
  settledTag: { color: colors.textDim, fontSize: typography.micro, fontWeight: '700' },
  openTag: { color: colors.profit, fontSize: typography.micro, fontWeight: '700' },
  dealBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dealMeta: { color: colors.textMuted, fontSize: typography.small },
  dealResult: { fontSize: typography.body, fontWeight: '800' },
  dealMakeup: { color: colors.warn, fontSize: typography.micro },
});
