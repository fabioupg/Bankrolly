import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SessionCard } from '@/components/SessionCard';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useTripStore } from '@/store/useTripStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { useCanAdd } from '@/hooks/useCanAdd';
import { promptUpgrade } from '@/components/UpgradePrompt';
import { isTripActive, tripSummary, unifySessions, type SessionEntry } from '@/utils/calculations';
import { formatDateShort, formatPnL } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';
import type { Trip } from '@/db/schema';

type Tab = 'cash' | 'tournament' | 'trip';

export default function SessionsScreen() {
  const cash = useSessionStore((s) => s.sessions);
  const tourneys = useTournamentStore((s) => s.tourneys);
  const trips = useTripStore((s) => s.trips);
  const tripExpenses = useTripStore((s) => s.expenses);
  const removeCash = useSessionStore((s) => s.remove);
  const removeTourney = useTournamentStore((s) => s.remove);
  const removeTrip = useTripStore((s) => s.removeTrip);
  const currency = useSettingsStore((s) => s.currency);
  const tripLimit = useCanAdd('trip');
  const [tab, setTab] = useState<Tab>('cash');

  const handleNewTrip = () => {
    if (!tripLimit.canAdd) {
      promptUpgrade('trip', tripLimit.current, tripLimit.limit);
      return;
    }
    router.push('/trips/new');
  };

  const sessionEntries = useMemo<SessionEntry[]>(() => {
    if (tab === 'cash') return unifySessions(cash, []);
    if (tab === 'tournament') return unifySessions([], tourneys);
    return [];
  }, [tab, cash, tourneys]);

  const tripCards = useMemo(() => {
    return trips.map((t) => ({
      trip: t,
      summary: tripSummary(t, cash, tourneys, tripExpenses),
      active: isTripActive(t),
    }));
  }, [trips, cash, tourneys, tripExpenses]);

  const sortedTrips = useMemo(
    () =>
      [...tripCards].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return b.trip.startDate.localeCompare(a.trip.startDate);
      }),
    [tripCards],
  );

  const confirmDeleteSession = (entry: SessionEntry) => {
    Alert.alert('Delete session?', 'This will permanently remove the entry.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (entry.type === 'cash') await removeCash(entry.id);
          else await removeTourney(entry.id);
        },
      },
    ]);
  };

  const confirmDeleteTrip = (trip: Trip) => {
    Alert.alert(
      'Delete trip?',
      'Expenses will be deleted. Linked sessions stay but lose their trip link.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeTrip(trip.id) },
      ],
    );
  };

  return (
    <ScreenContainer scroll={false} contentStyle={styles.container}>
      <View style={styles.tabs}>
        <TabBtn label={`Cash (${cash.length})`} active={tab === 'cash'} onPress={() => setTab('cash')} />
        <TabBtn
          label={`Tournaments (${tourneys.length})`}
          active={tab === 'tournament'}
          onPress={() => setTab('tournament')}
        />
        <TabBtn label={`Trips (${trips.length})`} active={tab === 'trip'} onPress={() => setTab('trip')} />
      </View>

      {tab === 'trip' ? (
        <FlatList
          data={sortedTrips}
          keyExtractor={(t) => t.trip.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <View style={styles.tripHeader}>
              <Pressable
                onPress={handleNewTrip}
                style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.newBtnLabel}>+ New trip</Text>
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptyBody}>
                Track WSOP, EPT, festivals — buy-ins, hotel, food, drinks, all in one place.
              </Text>
              <Pressable onPress={handleNewTrip} style={styles.bigAddBtn}>
                <Text style={styles.bigAddLabel}>+ Plan your first trip</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <TripRow
              trip={item.trip}
              netResult={item.summary.netResult}
              pokerProfit={item.summary.totalPokerProfit}
              totalExpenses={item.summary.totalExpenses}
              cashCount={item.summary.cashSessions.length}
              tourneyCount={item.summary.tournaments.length}
              active={item.active}
              currency={currency}
              onPress={() => router.push(`/trips/${item.trip.id}`)}
              onLongPress={() => confirmDeleteTrip(item.trip)}
            />
          )}
        />
      ) : (
        <FlatList
          data={sessionEntries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No {tab === 'cash' ? 'cash games' : 'tournaments'} yet
              </Text>
              <Text style={styles.emptyBody}>Tap the + tab to add one.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <SessionCard
              entry={item}
              currency={currency}
              onPress={() => {
                if (item.type === 'cash') router.push(`/cash/${item.id}`);
                else router.push(`/tournament/${item.id}`);
              }}
              onLongPress={() => confirmDeleteSession(item)}
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && { opacity: 0.85 }]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

interface TripRowProps {
  trip: Trip;
  netResult: number;
  pokerProfit: number;
  totalExpenses: number;
  cashCount: number;
  tourneyCount: number;
  active: boolean;
  currency: Currency;
  onPress: () => void;
  onLongPress: () => void;
}

function TripRow({
  trip,
  netResult,
  pokerProfit,
  totalExpenses,
  cashCount,
  tourneyCount,
  active,
  currency,
  onPress,
  onLongPress,
}: TripRowProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.cardActive,
        pressed && { backgroundColor: colors.cardHover },
      ]}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
            {active ? (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tripMeta} numberOfLines={1}>
            {trip.destination ? `${trip.destination} · ` : ''}
            {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
          </Text>
        </View>
        <Text style={[styles.tripNet, { color: pnlColor(netResult) }]}>
          {formatPnL(netResult, currency)}
        </Text>
      </View>
      <View style={styles.cardFoot}>
        <FootStat label="Poker" value={formatPnL(pokerProfit, currency)} color={pnlColor(pokerProfit)} />
        <FootStat
          label="Expenses"
          value={formatPnL(-totalExpenses, currency)}
          color={totalExpenses > 0 ? colors.loss : colors.textMuted}
        />
        <FootStat label="Sessions" value={`${cashCount + tourneyCount}`} color={colors.text} />
      </View>
    </Pressable>
  );
}

function FootStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View>
      <Text style={styles.footLabel}>{label}</Text>
      <Text style={[styles.footValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 0,
    paddingTop: spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.borderStrong },
  tabLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  tabLabelActive: { color: colors.text },
  list: {
    paddingTop: spacing.md,
    paddingBottom: 80,
    gap: spacing.sm,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: typography.small,
    textAlign: 'center',
  },
  bigAddBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  bigAddLabel: { color: '#fff', fontWeight: '700' },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingBottom: spacing.sm,
  },
  newBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  newBtnLabel: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardActive: { borderColor: colors.accent },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  tripName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    flexShrink: 1,
  },
  liveBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tripMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
    marginTop: 2,
  },
  tripNet: {
    fontSize: typography.heading,
    fontWeight: '800',
  },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  footLabel: {
    color: colors.textDim,
    fontSize: typography.micro,
    letterSpacing: 0.4,
  },
  footValue: {
    fontSize: typography.small,
    fontWeight: '700',
    marginTop: 2,
  },
});
