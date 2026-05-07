import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SessionCard } from '@/components/SessionCard';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { unifySessions, type SessionEntry } from '@/utils/calculations';
import { colors, radius, spacing, typography } from '@/theme/colors';

type Tab = 'cash' | 'tournament';

export default function SessionsScreen() {
  const cash = useSessionStore((s) => s.sessions);
  const tourneys = useTournamentStore((s) => s.tourneys);
  const removeCash = useSessionStore((s) => s.remove);
  const removeTourney = useTournamentStore((s) => s.remove);
  const currency = useSettingsStore((s) => s.currency);
  const [tab, setTab] = useState<Tab>('cash');

  const entries = useMemo<SessionEntry[]>(() => {
    if (tab === 'cash') return unifySessions(cash, []);
    return unifySessions([], tourneys);
  }, [tab, cash, tourneys]);

  const confirmDelete = (entry: SessionEntry) => {
    Alert.alert(
      'Delete session?',
      'This will permanently remove the entry.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (entry.type === 'cash') await removeCash(entry.id);
            else await removeTourney(entry.id);
          },
        },
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
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No {tab === 'cash' ? 'cash games' : 'tournaments'} yet</Text>
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
            onLongPress={() => confirmDelete(item)}
          />
        )}
      />
    </ScreenContainer>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
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
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.borderStrong,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.text,
  },
  list: {
    paddingTop: spacing.md,
    paddingBottom: 80,
    gap: spacing.sm,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
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
});
