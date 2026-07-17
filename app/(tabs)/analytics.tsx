import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionTitle } from '@/components/SectionTitle';
import { StatCard } from '@/components/StatCard';
import { BankrollChart } from '@/components/BankrollChart';
import { BarChart } from '@/components/BarChart';
import { Chip } from '@/components/Chip';
import { RoiChart } from '@/components/RoiChart';
import { ProGate } from '@/components/ProGate';
import { useDerivedStats, useSettingsStore } from '@/store/useStatsStore';
import { useTransactionStore, transactionsNet } from '@/store/useTransactionStore';
import { colors, radius, spacing, typography, pnlColor } from '@/theme/colors';
import { formatHours, formatMoney, formatPercent, formatPnL, formatRate } from '@/utils/formatters';

const RANGES = [
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: null },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

export default function AnalyticsScreen() {
  const [range, setRange] = useState<RangeKey>('all');
  const sinceIso = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r?.days) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - r.days);
    return d.toISOString().slice(0, 10);
  }, [range]);

  const stats = useDerivedStats(sinceIso);
  const allStats = useDerivedStats();
  const transactions = useTransactionStore((s) => s.transactions);
  const currency = useSettingsStore((s) => s.currency);

  // Buy-in coverage uses the all-time bankroll, not the filtered range.
  const bankroll = allStats.totalProfit + transactionsNet(transactions);
  const buyInsCovered =
    allStats.avgCashBuyIn > 0 && bankroll > 0 ? bankroll / allStats.avgCashBuyIn : 0;

  const venueBars = stats.venueStats.slice(0, 6).map((v) => ({
    label: v.venue.length > 8 ? `${v.venue.slice(0, 7)}…` : v.venue,
    value: Number(v.rate.toFixed(2)),
  }));

  const stakesBars = stats.stakesStats.slice(0, 6).map((s) => ({
    label: s.stakes.length > 8 ? `${s.stakes.slice(0, 7)}…` : s.stakes,
    value: Number(s.rate.toFixed(2)),
  }));

  const weekdayBars = stats.weekdayProfit.map((d) => ({
    label: d.label,
    value: Number(d.profit.toFixed(2)),
  }));
  const hasWeekdayData = stats.weekdayProfit.some((d) => d.sessions > 0);

  return (
    <ScreenContainer>
      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <Chip
            key={r.key}
            label={r.label}
            active={range === r.key}
            tone="accent"
            onPress={() => setRange(r.key)}
          />
        ))}
      </View>
      <View style={styles.statsGrid}>
        <StatCard
          label="Total ROI"
          value={formatPercent(stats.tournamentROI)}
          tone={stats.tournamentROI > 0 ? 'profit' : stats.tournamentROI < 0 ? 'loss' : 'neutral'}
          compact
        />
        <StatCard
          label="ITM"
          value={formatPercent(stats.itmPercent)}
          sublabel={`${stats.totalTournaments} tourneys`}
          compact
        />
        <StatCard
          label="Hourly cash"
          value={formatRate(stats.hourlyRate, currency)}
          sublabel={formatHours(stats.totalCashMinutes)}
          tone={stats.hourlyRate > 0 ? 'profit' : stats.hourlyRate < 0 ? 'loss' : 'neutral'}
          compact
        />
        <StatCard
          label="Hourly MTT"
          value={
            stats.totalTournamentMinutes > 0 ? formatRate(stats.mttHourlyRate, currency) : '—'
          }
          sublabel={
            stats.totalTournamentMinutes > 0
              ? formatHours(stats.totalTournamentMinutes)
              : 'Log tourney durations'
          }
          tone={
            stats.totalTournamentMinutes === 0
              ? 'neutral'
              : stats.mttHourlyRate > 0
              ? 'profit'
              : stats.mttHourlyRate < 0
              ? 'loss'
              : 'neutral'
          }
          compact
        />
        <StatCard
          label="Streak"
          value={
            stats.streak.length > 0
              ? `${stats.streak.length} ${stats.streak.direction === 'win' ? 'W' : 'L'}`
              : '—'
          }
          tone={stats.streak.direction === 'win' ? 'profit' : stats.streak.direction === 'loss' ? 'loss' : 'neutral'}
          compact
        />
      </View>

      <View style={styles.card}>
        <SectionTitle title="Bankroll over time" />
        <ProGate
          fallbackTitle="Unlock bankroll chart"
          fallbackBody="Pro shows your cumulative bankroll with a 20-session moving average."
          minHeight={240}
        >
          <BankrollChart data={stats.bankrollSeries} currency={currency} movingWindow={20} />
        </ProGate>
      </View>

      <View style={styles.card}>
        <SectionTitle title="Hourly rate by venue" />
        <ProGate
          fallbackTitle="Unlock venue stats"
          fallbackBody="Pro breaks down your hourly rate per casino, club or online site."
          minHeight={240}
        >
          <BarChart data={venueBars} currency={currency} emptyText="No cash sessions yet" />
          {stats.venueStats.length > 0 ? (
            <View style={styles.venueList}>
              {stats.venueStats.slice(0, 6).map((v) => (
                <View key={v.venue} style={styles.venueRow}>
                  <Text style={styles.venueName} numberOfLines={1}>{v.venue}</Text>
                  <Text style={styles.venueMeta}>
                    {formatHours(v.hours * 60)} • {v.sessions} sess.
                  </Text>
                  <Text style={[styles.venueRate, { color: pnlColor(v.rate) }]}>
                    {formatRate(v.rate, currency)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </ProGate>
      </View>

      <View style={styles.card}>
        <SectionTitle title="Hourly rate by stakes" />
        <ProGate
          fallbackTitle="Unlock stakes stats"
          fallbackBody="Pro shows your hourly rate per stakes level — see where you actually win."
          minHeight={200}
        >
          <BarChart data={stakesBars} currency={currency} emptyText="No cash sessions yet" />
          {stats.stakesStats.length > 0 ? (
            <View style={styles.venueList}>
              {stats.stakesStats.slice(0, 6).map((s) => (
                <View key={s.stakes} style={styles.venueRow}>
                  <Text style={styles.venueName} numberOfLines={1}>{s.stakes}</Text>
                  <Text style={styles.venueMeta}>
                    {formatHours(s.hours * 60)} • {s.sessions} sess.
                  </Text>
                  <Text style={[styles.venueRate, { color: pnlColor(s.rate) }]}>
                    {formatRate(s.rate, currency)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </ProGate>
      </View>

      <View style={styles.card}>
        <SectionTitle title="Profit by weekday" />
        <ProGate
          fallbackTitle="Unlock weekday stats"
          fallbackBody="Pro shows which days of the week make you money — and which cost you."
          minHeight={220}
        >
          {hasWeekdayData ? (
            <BarChart data={weekdayBars} currency={currency} />
          ) : (
            <BarChart data={[]} currency={currency} emptyText="No sessions yet" />
          )}
        </ProGate>
      </View>

      <View style={styles.card}>
        <SectionTitle title="Variance & bankroll" />
        <ProGate
          fallbackTitle="Unlock variance stats"
          fallbackBody="Pro shows your swing size, worst downswing and how many buy-ins your bankroll covers."
          minHeight={180}
        >
          <View style={styles.smallRow}>
            <Text style={styles.smallLabel}>Std deviation / session</Text>
            <Text style={styles.smallValue}>
              {stats.profitStdDev > 0 ? formatMoney(stats.profitStdDev, currency) : '—'}
            </Text>
          </View>
          <View style={styles.smallRow}>
            <Text style={styles.smallLabel}>Biggest downswing</Text>
            <Text style={[styles.smallValue, { color: stats.maxDrawdown > 0 ? colors.loss : colors.text }]}>
              {stats.maxDrawdown > 0 ? formatPnL(-stats.maxDrawdown, currency) : '—'}
            </Text>
          </View>
          <View style={styles.smallRow}>
            <Text style={styles.smallLabel}>Avg cash buy-in</Text>
            <Text style={styles.smallValue}>
              {allStats.avgCashBuyIn > 0 ? formatMoney(allStats.avgCashBuyIn, currency) : '—'}
            </Text>
          </View>
          <View style={styles.smallRow}>
            <Text style={styles.smallLabel}>Bankroll covers</Text>
            <Text style={styles.smallValue}>
              {buyInsCovered > 0 ? `${buyInsCovered.toFixed(1)} buy-ins` : '—'}
            </Text>
          </View>
          <Text style={styles.varianceHint}>
            {buyInsCovered > 0
              ? buyInsCovered >= 40
                ? 'Comfortable: a common cash-game guideline is 20–40 buy-ins, and you are above it.'
                : buyInsCovered >= 20
                ? 'Solid: you are inside the common 20–40 buy-in guideline for cash games.'
                : 'Thin: a common cash-game guideline is 20–40 buy-ins. Consider lower stakes or topping up.'
              : 'Log cash sessions (and deposits) to see how many buy-ins your bankroll covers.'}
          </Text>
        </ProGate>
      </View>

      <View style={styles.card}>
        <SectionTitle title="MTT ROI over time" />
        <ProGate
          fallbackTitle="Unlock ROI trend"
          fallbackBody="Pro charts your cumulative MTT ROI over time."
          minHeight={220}
        >
          <RoiChart data={stats.roiOverTime} />
        </ProGate>
      </View>

      <View style={styles.twoCol}>
        <View style={[styles.card, styles.flex]}>
          <Text style={styles.cardLabel}>Biggest wins</Text>
          {stats.biggestWins.filter((e) => e.profit > 0).length === 0 ? (
            <Text style={styles.placeholder}>No wins yet</Text>
          ) : (
            stats.biggestWins
              .filter((e) => e.profit > 0)
              .slice(0, 3)
              .map((e) => (
                <View key={e.id} style={styles.smallRow}>
                  <Text style={styles.smallLabel} numberOfLines={1}>{e.label}</Text>
                  <Text style={[styles.smallValue, { color: colors.profit }]}>
                    {formatPnL(e.profit, currency)}
                  </Text>
                </View>
              ))
          )}
        </View>
        <View style={[styles.card, styles.flex]}>
          <Text style={styles.cardLabel}>Biggest losses</Text>
          {stats.biggestLosses.filter((e) => e.profit < 0).length === 0 ? (
            <Text style={styles.placeholder}>No losses yet</Text>
          ) : (
            stats.biggestLosses
              .filter((e) => e.profit < 0)
              .slice(0, 3)
              .map((e) => (
                <View key={e.id} style={styles.smallRow}>
                  <Text style={styles.smallLabel} numberOfLines={1}>{e.label}</Text>
                  <Text style={[styles.smallValue, { color: colors.loss }]}>
                    {formatPnL(e.profit, currency)}
                  </Text>
                </View>
              ))
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  varianceHint: {
    color: colors.textDim,
    fontSize: typography.micro,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  smallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: spacing.sm,
  },
  smallLabel: {
    color: colors.text,
    fontSize: typography.small,
    flexShrink: 1,
  },
  smallValue: {
    fontWeight: '700',
    fontSize: typography.small,
  },
  placeholder: {
    color: colors.textDim,
    fontSize: typography.small,
    paddingVertical: spacing.sm,
  },
  venueList: {
    marginTop: spacing.sm,
    gap: 6,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  venueName: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '600',
    flex: 1,
  },
  venueMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
  },
  venueRate: {
    fontWeight: '700',
    fontSize: typography.small,
    minWidth: 80,
    textAlign: 'right',
  },
});
