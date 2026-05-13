import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionTitle } from '@/components/SectionTitle';
import { StatCard } from '@/components/StatCard';
import { BankrollChart } from '@/components/BankrollChart';
import { BarChart } from '@/components/BarChart';
import { RoiChart } from '@/components/RoiChart';
import { ProGate } from '@/components/ProGate';
import { useDerivedStats, useSettingsStore } from '@/store/useStatsStore';
import { colors, radius, spacing, typography, pnlColor } from '@/theme/colors';
import { formatHours, formatPercent, formatPnL, formatRate } from '@/utils/formatters';

export default function AnalyticsScreen() {
  const stats = useDerivedStats();
  const currency = useSettingsStore((s) => s.currency);

  const venueBars = stats.venueStats.slice(0, 6).map((v) => ({
    label: v.venue.length > 8 ? `${v.venue.slice(0, 7)}…` : v.venue,
    value: Number(v.rate.toFixed(2)),
  }));

  return (
    <ScreenContainer>
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
