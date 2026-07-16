import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/components/Chip';
import { HandNoteCard, TAG_LABELS } from '@/components/HandNoteCard';
import { promptUpgrade } from '@/components/UpgradePrompt';
import { useCanAdd } from '@/hooks/useCanAdd';
import { useHandStore } from '@/store/useHandStore';
import { useSettingsStore } from '@/store/useStatsStore';
import {
  HAND_TAGS,
  POSITIONS,
  STREETS,
  type HandTag,
  type Position,
  type SessionType,
  type Street,
} from '@/db/schema';
import { colors, radius, spacing, typography } from '@/theme/colors';

type Filter<T extends string> = T | 'all';

export default function HandHistoryScreen() {
  const hands = useHandStore((s) => s.hands);
  const remove = useHandStore((s) => s.remove);
  const currency = useSettingsStore((s) => s.currency);
  const limit = useCanAdd('hand');

  const handleNew = () => {
    if (!limit.canAdd) {
      promptUpgrade('hand', limit.current, limit.limit);
      return;
    }
    router.push('/hand/new');
  };

  const [tag, setTag] = useState<Filter<HandTag>>('all');
  const [position, setPosition] = useState<Filter<Position>>('all');
  const [street, setStreet] = useState<Filter<Street>>('all');
  const [sessionType, setSessionType] = useState<Filter<SessionType>>('all');

  const filtered = useMemo(
    () =>
      hands.filter((h) => {
        if (tag !== 'all' && h.tag !== tag) return false;
        if (position !== 'all' && h.position !== position) return false;
        if (street !== 'all' && h.street !== street) return false;
        if (sessionType !== 'all' && h.sessionType !== sessionType) return false;
        return true;
      }),
    [hands, tag, position, street, sessionType],
  );

  const onDelete = (id: string) => {
    Alert.alert('Delete hand?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  const reset = () => {
    setTag('all');
    setPosition('all');
    setStreet('all');
    setSessionType('all');
  };

  const filtersActive =
    tag !== 'all' || position !== 'all' || street !== 'all' || sessionType !== 'all';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <FlatList
        data={filtered}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{hands.length} hand{hands.length === 1 ? '' : 's'} logged</Text>
              <Pressable onPress={handleNew} style={styles.addBtn}>
                <Text style={styles.addLabel}>+ New</Text>
              </Pressable>
            </View>
            {hands.length > 0 ? (
              <Text style={styles.hint}>Tap a hand to edit · long-press to delete</Text>
            ) : null}

            <Text style={styles.filterLabel}>Tag</Text>
            <View style={styles.chips}>
              <Chip label="All" tone="accent" active={tag === 'all'} onPress={() => setTag('all')} />
              {HAND_TAGS.map((t) => (
                <Chip
                  key={t}
                  label={TAG_LABELS[t]}
                  tone="accent"
                  active={tag === t}
                  onPress={() => setTag(t)}
                />
              ))}
            </View>

            <Text style={styles.filterLabel}>Street</Text>
            <View style={styles.chips}>
              <Chip label="All" tone="accent" active={street === 'all'} onPress={() => setStreet('all')} />
              {STREETS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  tone="accent"
                  active={street === s}
                  onPress={() => setStreet(s)}
                />
              ))}
            </View>

            <Text style={styles.filterLabel}>Position</Text>
            <View style={styles.chips}>
              <Chip label="All" tone="accent" active={position === 'all'} onPress={() => setPosition('all')} />
              {POSITIONS.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  tone="accent"
                  active={position === p}
                  onPress={() => setPosition(p)}
                />
              ))}
            </View>

            <Text style={styles.filterLabel}>Session</Text>
            <View style={styles.chips}>
              <Chip label="All" tone="accent" active={sessionType === 'all'} onPress={() => setSessionType('all')} />
              <Chip
                label="Cash"
                tone="accent"
                active={sessionType === 'cash'}
                onPress={() => setSessionType('cash')}
              />
              <Chip
                label="Tournament"
                tone="accent"
                active={sessionType === 'tournament'}
                onPress={() => setSessionType('tournament')}
              />
            </View>

            {filtersActive ? (
              <Pressable onPress={reset} style={styles.resetBtn}>
                <Text style={styles.resetLabel}>Reset filters</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {hands.length === 0 ? 'No hand notes yet' : 'No hands match those filters'}
            </Text>
            <Text style={styles.emptyBody}>
              {hands.length === 0
                ? 'Tag tough spots, hero calls and bluffs to review later.'
                : 'Try resetting the filters.'}
            </Text>
            {hands.length === 0 ? (
              <Pressable onPress={handleNew} style={styles.bigAddBtn}>
                <Text style={styles.bigAddLabel}>+ Log your first hand</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <HandNoteCard
            hand={item}
            currency={currency}
            onPress={() => router.push({ pathname: '/hand/new', params: { id: item.id } })}
            onLongPress={() => onDelete(item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.micro,
    marginTop: -spacing.xs,
  },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  addLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  filterLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  resetBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
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
  bigAddLabel: {
    color: '#fff',
    fontWeight: '700',
  },
});
