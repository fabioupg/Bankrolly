import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Chip } from '@/components/Chip';
import { usePlayerStore } from '@/store/usePlayerStore';
import { PLAYER_ARCHETYPES, type Player, type PlayerArchetype } from '@/db/schema';
import { colors, radius, spacing, typography } from '@/theme/colors';
import { useCanAdd } from '@/hooks/useCanAdd';
import { promptUpgrade } from '@/components/UpgradePrompt';

type ArchetypeFilter = PlayerArchetype | 'All';

export default function PlayersTab() {
  const players = usePlayerStore((s) => s.players);
  const hands = usePlayerStore((s) => s.hands);
  const limit = useCanAdd('player');
  const [query, setQuery] = useState('');
  const [archetype, setArchetype] = useState<ArchetypeFilter>('All');

  const handleNew = () => {
    if (!limit.canAdd) {
      promptUpgrade('player', limit.current, limit.limit);
      return;
    }
    router.push('/players/new');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (archetype !== 'All' && p.archetype !== archetype) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q) ||
        p.venue.toLowerCase().includes(q) ||
        p.archetype.toLowerCase().includes(q) ||
        p.generalNotes.toLowerCase().includes(q)
      );
    });
  }, [players, query, archetype]);

  const handsByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of hands) map.set(h.playerId, (map.get(h.playerId) ?? 0) + 1);
    return map;
  }, [hands]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Players</Text>
          <Text style={styles.subtitle}>
            {players.length} tracked
            {filtered.length !== players.length ? ` • ${filtered.length} shown` : ''}
          </Text>
        </View>
        <Pressable onPress={handleNew} style={styles.addBtn}>
          <Text style={styles.addLabel}>+ New</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, nickname, venue…"
          placeholderTextColor={colors.textDim}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={12}>
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        <FlatList
          data={['All', ...PLAYER_ARCHETYPES] as ArchetypeFilter[]}
          keyExtractor={(a) => a}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <Chip
              label={item}
              tone="accent"
              active={archetype === item}
              onPress={() => setArchetype(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <PlayerRow
            player={item}
            handCount={handsByPlayer.get(item.id) ?? 0}
            onPress={() => router.push(`/players/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {players.length === 0 ? 'No players yet' : 'No matches'}
            </Text>
            <Text style={styles.emptyBody}>
              {players.length === 0
                ? 'Add regulars and tough opponents — what they open, how they bet, when they bluff.'
                : 'Try a different name or clear the filter.'}
            </Text>
            {players.length === 0 ? (
              <Pressable onPress={handleNew} style={styles.bigAddBtn}>
                <Text style={styles.bigAddLabel}>+ Add your first player</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function PlayerRow({
  player,
  handCount,
  onPress,
}: {
  player: Player;
  handCount: number;
  onPress: () => void;
}) {
  const initials = (player.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials || '?'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{player.name}</Text>
          {player.archetype ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{player.archetype}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {[player.nickname, player.venue].filter(Boolean).join(' • ') || '—'}
        </Text>
        <Text style={styles.meta}>
          {handCount} hand{handCount === 1 ? '' : 's'}
          {player.bluffFrequency ? ` • Bluffs: ${player.bluffFrequency}` : ''}
        </Text>
      </View>
      <Text style={styles.chev}>›</Text>
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
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  addLabel: { color: '#fff', fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  searchIcon: {
    color: colors.textMuted,
    fontSize: 18,
  },
  search: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    paddingVertical: 12,
  },
  clear: {
    color: colors.textMuted,
    fontSize: 18,
  },
  filterRow: {
    paddingBottom: spacing.sm,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 60,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.cardHover },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.profit,
    fontWeight: '800',
    fontSize: typography.body,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    flexShrink: 1,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.borderStrong,
  },
  tagText: {
    color: colors.text,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  sub: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  meta: {
    color: colors.textDim,
    fontSize: typography.micro,
    marginTop: 2,
  },
  chev: {
    color: colors.textDim,
    fontSize: 26,
    paddingHorizontal: 4,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: typography.body,
  },
  emptyBody: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: typography.small,
  },
  bigAddBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  bigAddLabel: { color: '#fff', fontWeight: '700' },
});
