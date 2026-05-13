import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionTitle } from '@/components/SectionTitle';
import { StatCard } from '@/components/StatCard';
import { SessionCard } from '@/components/SessionCard';
import { useDerivedStats, useSettingsStore } from '@/store/useStatsStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useHandStore } from '@/store/useHandStore';
import { useTripStore } from '@/store/useTripStore';
import { isTripActive, tripSummary } from '@/utils/calculations';
import {
  formatDateShort,
  formatHours,
  formatMoney,
  formatPercent,
  formatPnL,
  formatRate,
} from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';

export default function Dashboard() {
  const stats = useDerivedStats();
  const currency = useSettingsStore((s) => s.currency);
  const trips = useTripStore((s) => s.trips);
  const tripExpenses = useTripStore((s) => s.expenses);
  const cash = useSessionStore((s) => s.sessions);
  const tourneys = useTournamentStore((s) => s.tourneys);
  const [refreshing, setRefreshing] = useState(false);

  const activeTrip = useMemo(() => trips.find((t) => isTripActive(t)), [trips]);
  const activeTripSummary = useMemo(
    () => (activeTrip ? tripSummary(activeTrip, cash, tourneys, tripExpenses) : null),
    [activeTrip, cash, tourneys, tripExpenses],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      useSessionStore.getState().hydrate(),
      useTournamentStore.getState().hydrate(),
      useHandStore.getState().hydrate(),
    ]);
    setRefreshing(false);
  }, []);

  const totalTone = stats.totalProfit > 0 ? 'profit' : stats.totalProfit < 0 ? 'loss' : 'neutral';
  const monthTone = stats.thisMonthProfit > 0 ? 'profit' : stats.thisMonthProfit < 0 ? 'loss' : 'neutral';

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.profit} />}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>BANKROLL</Text>
        <Text style={[styles.heroValue, { color: totalTone === 'profit' ? colors.profit : totalTone === 'loss' ? colors.loss : colors.text }]}>
          {formatPnL(stats.totalProfit, currency)}
        </Text>
        <View style={styles.heroSplit}>
          <View>
            <Text style={styles.heroSubLabel}>Cash</Text>
            <Text style={styles.heroSub}>{formatPnL(stats.cashProfit, currency)}</Text>
          </View>
          <View>
            <Text style={styles.heroSubLabel}>Tournaments</Text>
            <Text style={styles.heroSub}>{formatPnL(stats.tournamentProfit, currency)}</Text>
          </View>
          <View>
            <Text style={styles.heroSubLabel}>Sessions</Text>
            <Text style={styles.heroSub}>{stats.totalSessions}</Text>
          </View>
        </View>
      </View>

      {activeTrip && activeTripSummary ? (
        <Pressable
          onPress={() => router.push(`/trips/${activeTrip.id}`)}
          style={({ pressed }) => [styles.tripCard, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.tripCardHead}>
            <View style={styles.tripBadge}>
              <Text style={styles.tripBadgeText}>● LIVE TRIP</Text>
            </View>
            <Text style={styles.tripDates}>
              {formatDateShort(activeTrip.startDate)} – {formatDateShort(activeTrip.endDate)}
            </Text>
          </View>
          <Text style={styles.tripName}>{activeTrip.name}</Text>
          {activeTrip.destination ? (
            <Text style={styles.tripDest}>{activeTrip.destination}</Text>
          ) : null}
          <View style={styles.tripStats}>
            <View>
              <Text style={styles.tripStatLabel}>Net</Text>
              <Text style={[styles.tripStatValue, { color: pnlColor(activeTripSummary.netResult) }]}>
                {formatPnL(activeTripSummary.netResult, currency)}
              </Text>
            </View>
            <View>
              <Text style={styles.tripStatLabel}>Poker</Text>
              <Text
                style={[styles.tripStatValue, { color: pnlColor(activeTripSummary.totalPokerProfit) }]}
              >
                {formatPnL(activeTripSummary.totalPokerProfit, currency)}
              </Text>
            </View>
            <View>
              <Text style={styles.tripStatLabel}>Expenses</Text>
              <Text style={[styles.tripStatValue, { color: colors.loss }]}>
                {formatPnL(-activeTripSummary.totalExpenses, currency)}
              </Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      {stats.losingStreakWarning ? (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>5-session losing streak</Text>
          <Text style={styles.warningBody}>
            Last 5 sessions all in the red. Consider stepping down stakes or taking a break.
          </Text>
        </View>
      ) : null}

      <View style={styles.statsGrid}>
        <StatCard
          label="This month"
          value={formatPnL(stats.thisMonthProfit, currency)}
          tone={monthTone}
          compact
        />
        <StatCard
          label="Hourly"
          value={formatRate(stats.hourlyRate, currency)}
          sublabel={`${formatHours(stats.totalCashMinutes)} played`}
          tone={stats.hourlyRate > 0 ? 'profit' : stats.hourlyRate < 0 ? 'loss' : 'neutral'}
          compact
        />
        <StatCard
          label="MTT ROI"
          value={formatPercent(stats.tournamentROI)}
          sublabel={`${stats.totalTournaments} tourneys`}
          tone={stats.tournamentROI > 0 ? 'profit' : stats.tournamentROI < 0 ? 'loss' : 'neutral'}
          compact
        />
        <StatCard
          label="ITM %"
          value={formatPercent(stats.itmPercent)}
          sublabel={
            stats.streak.length > 0
              ? `${stats.streak.length} ${stats.streak.direction} streak`
              : 'No streak'
          }
          compact
        />
      </View>

      <View style={styles.recentSection}>
        <SectionTitle
          title="Recent sessions"
          action={
            <Text
              style={styles.linkText}
              onPress={() => router.push('/sessions')}
            >
              See all
            </Text>
          }
        />
        {stats.recent.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Log your first session</Text>
            <Text style={styles.emptyBody}>Tap the + tab to add a cash game or tournament.</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {stats.recent.map((entry) => (
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

      <View style={styles.footerHints}>
        <Text style={styles.hintText}>
          Tournament buy-ins: {formatMoney(stats.totalTournamentInvested, currency)} • Returns: {formatMoney(stats.totalTournamentReturn, currency)}
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  heroLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 1,
    fontWeight: '700',
  },
  heroValue: {
    fontSize: 38,
    fontWeight: '800',
  },
  heroSplit: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  heroSubLabel: {
    color: colors.textDim,
    fontSize: typography.micro,
    letterSpacing: 0.5,
  },
  heroSub: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
    marginTop: 2,
  },
  warning: {
    backgroundColor: '#3b1418',
    borderColor: colors.loss,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  warningTitle: {
    color: colors.loss,
    fontWeight: '700',
    fontSize: typography.body,
  },
  warningBody: {
    color: colors.text,
    fontSize: typography.small,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  recentSection: {
    gap: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  linkText: {
    color: colors.profit,
    fontSize: typography.small,
    fontWeight: '600',
  },
  footerHints: {
    paddingTop: spacing.sm,
  },
  hintText: {
    color: colors.textDim,
    fontSize: typography.micro,
  },
  tripCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.lg,
    gap: 6,
  },
  tripCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  tripBadgeText: {
    color: '#fff',
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  tripDates: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  tripName: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
    marginTop: 4,
  },
  tripDest: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  tripStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  tripStatLabel: {
    color: colors.textDim,
    fontSize: typography.micro,
    letterSpacing: 0.5,
  },
  tripStatValue: {
    fontSize: typography.body,
    fontWeight: '800',
    marginTop: 2,
  },
});
