import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCanAdd } from '@/hooks/useCanAdd';
import { promptUpgrade } from '@/components/UpgradePrompt';
import { colors, radius, spacing, typography } from '@/theme/colors';
import type { LimitedKind } from '@/utils/limits';

export default function QuickAddModal() {
  const cash = useCanAdd('cash');
  const tournament = useCanAdd('tournament');
  const hand = useCanAdd('hand');
  const player = useCanAdd('player');
  const trip = useCanAdd('trip');

  const handleNav = (
    kind: LimitedKind,
    state: ReturnType<typeof useCanAdd>,
    target: string,
  ) => {
    router.dismiss();
    if (!state.canAdd) {
      promptUpgrade(kind, state.current, state.limit);
      return;
    }
    router.push(target);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.body}>
        <Text style={styles.title}>What did you play?</Text>
        <Text style={styles.subtitle}>Pick a session type to log</Text>

        <View style={styles.options}>
          <OptionCard
            title="Cash Game"
            subtitle="Buy-in / cash-out, hourly rate, hands"
            glyph="♠"
            tone={colors.accent}
            state={cash}
            onPress={() => handleNav('cash', cash, '/cash/new')}
          />
          <OptionCard
            title="Tournament"
            subtitle="MTT / SNG / Bounty, ROI, ITM"
            glyph="♣"
            tone="#3b6dff"
            state={tournament}
            onPress={() => handleNav('tournament', tournament, '/tournament/new')}
          />
          <OptionCard
            title="Hand Note"
            subtitle="Standalone hand to review later"
            glyph="♥"
            tone="#9333ea"
            state={hand}
            onPress={() => handleNav('hand', hand, '/hand/new')}
          />
          <OptionCard
            title="Player Note"
            subtitle="Track tendencies, archetypes, hands"
            glyph="♦"
            tone="#dc2626"
            state={player}
            onPress={() => handleNav('player', player, '/players/new')}
          />
          <OptionCard
            title="Trip"
            subtitle="WSOP, EPT, festivals — buy-ins + costs"
            glyph="✈"
            tone="#0ea5e9"
            state={trip}
            onPress={() => handleNav('trip', trip, '/trips/new')}
          />
        </View>

        <Pressable onPress={() => router.dismiss()} style={styles.cancel}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface OptionProps {
  title: string;
  subtitle: string;
  glyph: string;
  tone: string;
  state: ReturnType<typeof useCanAdd>;
  onPress: () => void;
}

function OptionCard({ title, subtitle, glyph, tone, state, onPress }: OptionProps) {
  const showLimit = !state.isPro;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.cardHover }]}
    >
      <View style={[styles.glyphBox, { backgroundColor: tone }]}>
        <Text style={styles.glyph}>{glyph}</Text>
      </View>
      <View style={styles.optionMeta}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSub}>{subtitle}</Text>
        {showLimit ? (
          <Text style={[styles.limit, !state.canAdd && styles.limitFull]}>
            {state.current}/{state.limit} on Free
          </Text>
        ) : null}
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    marginTop: -spacing.md,
  },
  options: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  glyphBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  optionMeta: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  optionSub: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  limit: {
    color: colors.textDim,
    fontSize: typography.micro,
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  limitFull: {
    color: colors.warn,
  },
  chev: {
    color: colors.textDim,
    fontSize: 28,
  },
  cancel: {
    marginTop: 'auto',
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '600',
  },
});
