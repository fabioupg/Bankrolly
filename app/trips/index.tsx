import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTripStore } from '@/store/useTripStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { isTripActive, isTripUpcoming, tripSummary } from '@/utils/calculations';
import { formatDateShort, formatPnL } from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';
import type { Trip } from '@/db/schema';

export default function TripsList() {
  const trips = useTripStore((s) => s.trips);
  const expenses = useTripStore((s) => s.expenses);
  const cash = useSessionStore((s) => s.sessions);
  const tourneys = useTournamentStore((s) => s.tourneys);
  const currency = useSettingsStore((s) => s.currency);

  const summaries = useMemo(
    () =>
      trips.map((t) => ({
        trip: t,
        summary: tripSummary(t, cash, tourneys, expenses),
        active: isTripActive(t),
        upcoming: isTripUpcoming(t),
      })),
    [trips, cash, tourneys, expenses],
  );

  const active = summaries.find((s) => s.active);
  const upcoming = summaries.filter((s) => s.upcoming).sort((a, b) =>
    a.trip.startDate.localeCompare(b.trip.startDate),
  );
  const past = summaries.filter((s) => !s.active && !s.upcoming);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trips</Text>
          <Text style={styles.subtitle}>
            {trips.length} total{active ? ' • 1 active' : ''}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/trips/new')} style={styles.addBtn}>
          <Text style={styles.addLabel}>+ New trip</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        data={[
          ...(active ? [{ kind: 'header', label: 'Active' }, { kind: 'item', data: active }] : []),
          ...(upcoming.length
            ? [{ kind: 'header', label: 'Upcoming' }, ...upcoming.map((u) => ({ kind: 'item', data: u }))]
            : []),
          ...(past.length
            ? [{ kind: 'header', label: 'Past' }, ...past.map((p) => ({ kind: 'item', data: p }))]
            : []),
        ]}
        keyExtractor={(item, idx) =>
          item.kind === 'header' ? `h-${item.label}` : (item.data as { trip: Trip }).trip.id + idx
        }
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <Text style={styles.sectionLabel}>{(item as { label: string }).label.toUpperCase()}</Text>
          ) : (
            <TripRow
              trip={(item.data as ReturnType<typeof Object>).trip}
              netResult={(item.data as ReturnType<typeof Object>).summary.netResult}
              totalExpenses={(item.data as ReturnType<typeof Object>).summary.totalExpenses}
              activeBadge={(item.data as ReturnType<typeof Object>).active}
              currency={currency}
            />
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptyBody}>
              Track WSOP, EPT, festivals — buy-ins, hotel, food, drinks, all in one place.
            </Text>
            <Pressable onPress={() => router.push('/trips/new')} style={styles.bigAddBtn}>
              <Text style={styles.bigAddLabel}>+ Plan your first trip</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

interface RowProps {
  trip: Trip;
  netResult: number;
  totalExpenses: number;
  activeBadge: boolean;
  currency: string;
}

function TripRow({ trip, netResult, totalExpenses, activeBadge, currency }: RowProps) {
  return (
    <Pressable
      onPress={() => router.push(`/trips/${trip.id}`)}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.cardHover }]}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
            {activeBadge ? (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>LIVE</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tripMeta} numberOfLines={1}>
            {trip.destination ? `${trip.destination} • ` : ''}
            {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
          </Text>
        </View>
        <Text style={[styles.net, { color: pnlColor(netResult) }]}>{formatPnL(netResult, currency)}</Text>
      </View>
      <View style={styles.cardFoot}>
        <Text style={styles.footLabel}>
          Expenses: {formatPnL(-totalExpenses, currency)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: typography.small, marginTop: 2 },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  addLabel: { color: '#fff', fontWeight: '700' },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  tripName: { color: colors.text, fontSize: typography.heading, fontWeight: '800', flexShrink: 1 },
  activeBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tripMeta: { color: colors.textMuted, fontSize: typography.small, marginTop: 2 },
  net: { fontSize: typography.title, fontWeight: '800' },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  footLabel: { color: colors.textMuted, fontSize: typography.small },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontWeight: '700', fontSize: typography.body },
  emptyBody: { color: colors.textMuted, textAlign: 'center', fontSize: typography.small },
  bigAddBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  bigAddLabel: { color: '#fff', fontWeight: '700' },
});
