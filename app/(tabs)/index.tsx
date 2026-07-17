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
import { useOnlineSessionStore } from '@/store/useOnlineSessionStore';
import { useHandStore } from '@/store/useHandStore';
import { useLiveSessionStore } from '@/store/useLiveSessionStore';
import { useTripStore } from '@/store/useTripStore';
import { useStakingStore } from '@/store/useStakingStore';
import { useTransactionStore, transactionsNet } from '@/store/useTransactionStore';
import { isTripActive, tripSummary } from '@/utils/calculations';
import { stakingTotals } from '@/utils/staking';
import { activeElapsedMs, formatDuration, liveProfit } from '@/utils/liveSession';
import {
  formatDateShort,
  formatHours,
  formatMoney,
  formatPercent,
  formatPnL,
  formatRate,
  startOfMonthISO,
} from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';

export default function Dashboard() {
  const stats = useDerivedStats();
  const currency = useSettingsStore((s) => s.currency);
  const profitTarget = useSettingsStore((s) => s.monthlyProfitTarget);
  const hoursTarget = useSettingsStore((s) => s.monthlyHoursTarget);
  const trips = useTripStore((s) => s.trips);
  const tripExpenses = useTripStore((s) => s.expenses);
  const cash = useSessionStore((s) => s.sessions);
  const tourneys = useTournamentStore((s) => s.tourneys);
  const live = useLiveSessionStore((s) => s.active);
  const stakingDeals = useStakingStore((s) => s.deals);
  const transactions = useTransactionStore((s) => s.transactions);
  const [refreshing, setRefreshing] = useState(false);

  const txNet = useMemo(() => transactionsNet(transactions), [transactions]);

  const staking = useMemo(
    () =>
      stakingTotals(
        stakingDeals.map((d) => ({
          direction: d.direction as 'backed' | 'backing',
          buyIn: d.buyIn,
          percent: d.percent,
          markup: d.markup,
          makeupBefore: d.makeupBefore,
          result: d.result,
          settled: !!d.settled,
        })),
      ),
    [stakingDeals],
  );

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
      useOnlineSessionStore.getState().hydrate(),
      useLiveSessionStore.getState().hydrate(),
      useStakingStore.getState().hydrate(),
      useTransactionStore.getState().hydrate(),
    ]);
    setRefreshing(false);
  }, []);

  const bankroll = stats.totalProfit + txNet;
  const totalTone = bankroll > 0 ? 'profit' : bankroll < 0 ? 'loss' : 'neutral';

  // Minutes played this month across cash and timed tournaments. monthStart is
  // a dependency so the card rolls over to the new month on the next render.
  const monthStart = startOfMonthISO();
  const monthMinutes = useMemo(
    () =>
      stats.unified
        .filter((e) => e.date >= monthStart)
        .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0),
    [stats.unified, monthStart],
  );
  const monthTone = stats.thisMonthProfit > 0 ? 'profit' : stats.thisMonthProfit < 0 ? 'loss' : 'neutral';

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.profit} />}
    >
      {live ? (
        <Pressable
          onPress={() => router.push('/live')}
          style={({ pressed }) => [
            styles.liveBanner,
            live.status === 'paused' && styles.liveBannerPaused,
            pressed && { opacity: 0.9 },
          ]}
        >
          <View style={styles.liveRow}>
            <View
              style={[
                styles.liveDot,
                { backgroundColor: live.status === 'running' ? colors.profit : colors.warn },
              ]}
            />
            <Text style={styles.liveLabel}>
              {live.status === 'running' ? 'LIVE SESSION' : 'SESSION PAUSED'}
            </Text>
            <Text style={styles.liveDuration}>{formatDuration(activeElapsedMs(live))}</Text>
          </View>
          <View style={styles.liveRow}>
            <Text style={[styles.liveProfit, { color: pnlColor(liveProfit(live)) }]}>
              {formatPnL(liveProfit(live), currency)}
            </Text>
            <Text style={styles.liveMeta}>
              {live.venue || live.stakes || 'Live'} · Stack {formatMoney(live.currentStack, currency)}
            </Text>
            <Text style={styles.liveChev}>›</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>BANKROLL</Text>
        <Text style={[styles.heroValue, { color: totalTone === 'profit' ? colors.profit : totalTone === 'loss' ? colors.loss : colors.text }]}>
          {formatPnL(bankroll, currency)}
        </Text>
        <View style={styles.heroSplit}>
          <View>
            <Text style={styles.heroSubLabel}>Cash</Text>
            <Text style={styles.heroSub}>{formatPnL(stats.cashProfit, currency)}</Text>
          </View>
          <View>
            <Text style={styles.heroSubLabel}>Live MTT</Text>
            <Text style={styles.heroSub}>{formatPnL(stats.tournamentProfit, currency)}</Text>
          </View>
          <View>
            <Text style={styles.heroSubLabel}>Online</Text>
            <Text style={styles.heroSub}>{formatPnL(stats.onlineProfit, currency)}</Text>
          </View>
          {txNet !== 0 ? (
            <Pressable onPress={() => router.push('/transactions')}>
              <Text style={styles.heroSubLabel}>Deposits & more</Text>
              <Text style={styles.heroSub}>{formatPnL(txNet, currency)}</Text>
            </Pressable>
          ) : null}
          <View>
            <Text style={styles.heroSubLabel}>Sessions</Text>
            <Text style={styles.heroSub}>{stats.totalSessions}</Text>
          </View>
        </View>
      </View>

      {stakingDeals.length > 0 ? (
        <Pressable
          onPress={() => router.push('/staking')}
          style={({ pressed }) => [styles.stakingCard, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.stakingHead}>
            <Text style={styles.stakingLabel}>STAKING</Text>
            <Text style={styles.liveChev}>›</Text>
          </View>
          <Text
            style={[
              styles.stakingValue,
              { color: pnlColor(staking.settledResult + staking.openResult) },
            ]}
          >
            {formatPnL(staking.settledResult + staking.openResult, currency)}
          </Text>
          <Text style={styles.stakingMeta}>
            {staking.makeupYouOwe > 0
              ? `You owe ${formatMoney(staking.makeupYouOwe, currency)} makeup`
              : staking.makeupOwedToYou > 0
              ? `${formatMoney(staking.makeupOwedToYou, currency)} makeup owed to you`
              : `${stakingDeals.length} deal${stakingDeals.length === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      ) : null}

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

      {profitTarget > 0 || hoursTarget > 0 ? (
        <View style={styles.goalsCard}>
          <Text style={styles.goalsTitle}>MONTHLY GOALS</Text>
          {profitTarget > 0 ? (
            <GoalRow
              label="Profit"
              current={formatPnL(stats.thisMonthProfit, currency)}
              target={formatMoney(profitTarget, currency)}
              pct={Math.max(0, Math.min(1, stats.thisMonthProfit / profitTarget))}
            />
          ) : null}
          {hoursTarget > 0 ? (
            <GoalRow
              label="Hours"
              current={formatHours(monthMinutes)}
              target={formatHours(hoursTarget * 60)}
              pct={Math.max(0, Math.min(1, monthMinutes / (hoursTarget * 60)))}
            />
          ) : null}
        </View>
      ) : null}

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
                  else if (entry.type === 'online') router.push(`/online/${entry.id}`);
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

function GoalRow({
  label,
  current,
  target,
  pct,
}: {
  label: string;
  current: string;
  target: string;
  pct: number;
}) {
  return (
    <View style={styles.goalRow}>
      <View style={styles.goalHead}>
        <Text style={styles.goalLabel}>{label}</Text>
        <Text style={styles.goalValue}>
          {current} / {target} · {Math.round(pct * 100)}%
        </Text>
      </View>
      <View style={styles.goalTrack}>
        <View
          style={[
            styles.goalFill,
            {
              width: `${pct * 100}%`,
              backgroundColor: pct >= 1 ? colors.profit : colors.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  liveBanner: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.profit,
    padding: spacing.md,
    gap: spacing.xs,
  },
  liveBannerPaused: {
    borderColor: colors.warn,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 1,
    flex: 1,
  },
  liveDuration: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  liveProfit: {
    fontSize: typography.heading,
    fontWeight: '800',
  },
  liveMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
    flex: 1,
  },
  liveChev: {
    color: colors.textDim,
    fontSize: 22,
  },
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
  goalsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  goalsTitle: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 1,
    fontWeight: '700',
  },
  goalRow: {
    gap: 6,
  },
  goalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  goalValue: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontVariant: ['tabular-nums'],
  },
  goalTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: 4,
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
  stakingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  stakingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stakingLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 1,
    fontWeight: '700',
  },
  stakingValue: {
    fontSize: typography.title,
    fontWeight: '800',
  },
  stakingMeta: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
});
