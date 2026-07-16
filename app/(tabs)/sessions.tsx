import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SessionCard } from '@/components/SessionCard';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useOnlineSessionStore } from '@/store/useOnlineSessionStore';
import { useTripStore } from '@/store/useTripStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { useCanAdd } from '@/hooks/useCanAdd';
import { promptUpgrade } from '@/components/UpgradePrompt';
import { isTripActive, tripSummary, unifySessions, type SessionEntry } from '@/utils/calculations';
import { onlineNet, parseEntries } from '@/utils/onlineSession';
import { formatDateShort, formatPnL } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';
import type { OnlineSession, Trip } from '@/db/schema';

type Tab = 'cash' | 'tournament' | 'online' | 'trip';
type SortMode = 'date' | 'profit';

interface MonthSection<T> {
  key: string;
  title: string | null;
  profit: number;
  data: T[];
}

function monthTitle(yearMonth: string): string {
  const d = new Date(`${yearMonth}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Groups date-sorted items into per-month sections with the month's net P&L. */
function groupByMonth<T>(
  items: T[],
  getDate: (item: T) => string,
  getProfit: (item: T) => number,
): MonthSection<T>[] {
  const sections: MonthSection<T>[] = [];
  for (const item of items) {
    const ym = getDate(item).slice(0, 7);
    const last = sections[sections.length - 1];
    if (last && last.key === ym) {
      last.data.push(item);
      last.profit += getProfit(item);
    } else {
      sections.push({ key: ym, title: monthTitle(ym), profit: getProfit(item), data: [item] });
    }
  }
  return sections;
}

export default function SessionsScreen() {
  const cash = useSessionStore((s) => s.sessions);
  const tourneys = useTournamentStore((s) => s.tourneys);
  const online = useOnlineSessionStore((s) => s.sessions);
  const trips = useTripStore((s) => s.trips);
  const tripExpenses = useTripStore((s) => s.expenses);
  const removeCash = useSessionStore((s) => s.remove);
  const removeTourney = useTournamentStore((s) => s.remove);
  const removeOnline = useOnlineSessionStore((s) => s.remove);
  const removeTrip = useTripStore((s) => s.removeTrip);
  const currency = useSettingsStore((s) => s.currency);
  const tripLimit = useCanAdd('trip');
  const [tab, setTab] = useState<Tab>('cash');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('date');

  const handleNewTrip = () => {
    if (!tripLimit.canAdd) {
      promptUpgrade('trip', tripLimit.current, tripLimit.limit);
      return;
    }
    router.push('/trips/new');
  };

  const sessionEntries = useMemo<SessionEntry[]>(() => {
    let entries: SessionEntry[] = [];
    if (tab === 'cash') entries = unifySessions(cash, []);
    else if (tab === 'tournament') entries = unifySessions([], tourneys);
    const q = query.trim().toLowerCase();
    if (q) entries = entries.filter((e) => e.label.toLowerCase().includes(q));
    if (sort === 'profit') entries = [...entries].sort((a, b) => b.profit - a.profit);
    return entries;
  }, [tab, cash, tourneys, query, sort]);

  // Grouped by month only when date-sorted; a profit sort gets one flat section.
  const sessionSections = useMemo<MonthSection<SessionEntry>[]>(() => {
    if (sort === 'profit')
      return sessionEntries.length
        ? [{ key: 'all', title: null, profit: 0, data: sessionEntries }]
        : [];
    return groupByMonth(
      sessionEntries,
      (e) => e.date,
      (e) => e.profit,
    );
  }, [sessionEntries, sort]);

  const filteredOnline = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = online;
    if (q)
      rows = rows.filter(
        (s) => s.site.toLowerCase().includes(q) || s.notes.toLowerCase().includes(q),
      );
    if (sort === 'profit') rows = [...rows].sort((a, b) => onlineNet(b) - onlineNet(a));
    return rows;
  }, [online, query, sort]);

  const onlineSections = useMemo<MonthSection<OnlineSession>[]>(() => {
    if (sort === 'profit')
      return filteredOnline.length
        ? [{ key: 'all', title: null, profit: 0, data: filteredOnline }]
        : [];
    return groupByMonth(filteredOnline, (s) => s.date, onlineNet);
  }, [filteredOnline, sort]);

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

  const confirmDeleteOnline = (session: OnlineSession) => {
    Alert.alert('Delete session?', 'This will permanently remove the entry.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeOnline(session.id) },
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
          label={`MTT (${tourneys.length})`}
          active={tab === 'tournament'}
          onPress={() => setTab('tournament')}
        />
        <TabBtn label={`Online (${online.length})`} active={tab === 'online'} onPress={() => setTab('online')} />
        <TabBtn label={`Trips (${trips.length})`} active={tab === 'trip'} onPress={() => setTab('trip')} />
      </View>

      {tab !== 'trip' ? (
        <View style={styles.filterRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={
              tab === 'online' ? 'Search site or notes' : 'Search venue, stakes or name'
            }
            placeholderTextColor={colors.textDim}
            style={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          <Pressable
            onPress={() => setSort(sort === 'date' ? 'profit' : 'date')}
            style={({ pressed }) => [styles.sortBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.sortLabel}>{sort === 'date' ? 'Date ↓' : 'P&L ↓'}</Text>
          </Pressable>
        </View>
      ) : null}

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
      ) : tab === 'online' ? (
        <SectionList
          sections={onlineSections}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <View style={styles.tripHeader}>
              <Pressable
                onPress={() => router.push('/online/new')}
                style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.newBtnLabel}>+ New online session</Text>
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            query.trim() ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyBody}>Nothing found for “{query.trim()}”.</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No online sessions yet</Text>
                <Text style={styles.emptyBody}>
                  Track total buy-ins and cashes for your online grind — add tournaments if you want.
                </Text>
                <Pressable onPress={() => router.push('/online/new')} style={styles.bigAddBtn}>
                  <Text style={styles.bigAddLabel}>+ Log your first online session</Text>
                </Pressable>
              </View>
            )
          }
          renderSectionHeader={({ section }) =>
            section.title ? (
              <MonthHeader title={section.title} profit={section.profit} currency={currency} />
            ) : null
          }
          renderItem={({ item }) => (
            <OnlineRow
              session={item}
              currency={currency}
              onPress={() => router.push(`/online/${item.id}`)}
              onLongPress={() => confirmDeleteOnline(item)}
            />
          )}
        />
      ) : (
        <SectionList
          sections={sessionSections}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            query.trim() ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyBody}>Nothing found for “{query.trim()}”.</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  No {tab === 'cash' ? 'cash games' : 'tournaments'} yet
                </Text>
                <Text style={styles.emptyBody}>Tap the + tab to add one.</Text>
              </View>
            )
          }
          renderSectionHeader={({ section }) =>
            section.title ? (
              <MonthHeader title={section.title} profit={section.profit} currency={currency} />
            ) : null
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

function MonthHeader({
  title,
  profit,
  currency,
}: {
  title: string;
  profit: number;
  currency: Currency;
}) {
  return (
    <View style={styles.monthHeader}>
      <Text style={styles.monthTitle}>{title}</Text>
      <Text style={[styles.monthPnl, { color: pnlColor(profit) }]}>
        {formatPnL(profit, currency)}
      </Text>
    </View>
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

interface OnlineRowProps {
  session: OnlineSession;
  currency: Currency;
  onPress: () => void;
  onLongPress: () => void;
}

function OnlineRow({ session, currency, onPress, onLongPress }: OnlineRowProps) {
  const net = onlineNet(session);
  const count = parseEntries(session.entries).length;
  const meta = [
    session.site || 'Online',
    formatDateShort(session.date),
    count ? `${count} MTT${count === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' • ');
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.oRow, pressed && { backgroundColor: colors.cardHover }]}
    >
      <View style={styles.oLeft}>
        <View style={styles.oBadge}>
          <Text style={styles.oBadgeText}>ONLINE</Text>
        </View>
        <View style={styles.oMeta}>
          <Text style={styles.oTitle} numberOfLines={1}>{meta}</Text>
          <Text style={styles.oSub}>
            In {formatPnL(-session.totalBuyIn, currency)} · Out {formatPnL(session.totalCash, currency)}
          </Text>
        </View>
      </View>
      <Text style={[styles.oNet, { color: pnlColor(net) }]}>{formatPnL(net, currency)}</Text>
    </Pressable>
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
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  search: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.small,
    minHeight: 40,
  },
  sortBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minHeight: 40,
  },
  sortLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
  },
  monthTitle: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  monthPnl: {
    fontSize: typography.small,
    fontWeight: '800',
  },
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
  oRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  oLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  oBadge: {
    backgroundColor: '#0e3a44',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  oBadgeText: {
    color: colors.text,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  oMeta: { flexShrink: 1 },
  oTitle: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  oSub: { color: colors.textMuted, fontSize: typography.small, marginTop: 2 },
  oNet: { fontSize: typography.heading, fontWeight: '700' },
});
