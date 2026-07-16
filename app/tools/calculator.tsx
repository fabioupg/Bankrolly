import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardSelectField } from '@/components/CardSelectField';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import {
  GAME_VARIANTS,
  VARIANT_HOLE_CARDS,
  VARIANT_LABELS,
  parseCards,
  serializeCards,
  type GameVariant,
} from '@/utils/cards';
import { estimateEquity, potOdds, type EquityResult } from '@/utils/equity';
import { colors, radius, spacing, typography } from '@/theme/colors';

// Omaha evaluates every 2-of-hole x 3-of-board combo per iteration, so fewer
// iterations keep the runtime in the same ballpark as the Hold'em path.
const ITERATIONS_BY_VARIANT: Record<GameVariant, number> = {
  NLH: 20000,
  PLO4: 5000,
  PLO5: 3500,
  PLO6: 2500,
};

/**
 * Standalone Equilab-style equity + pot-odds calculator, reachable from the "+".
 * Unlike the inline reviewer tool, hero / villain / board are all editable here
 * and it runs a higher-iteration simulation for a sharper read.
 */
export default function CalculatorScreen() {
  const [variant, setVariant] = useState<GameVariant>('NLH');
  const [hero, setHero] = useState('');
  const [villain, setVillain] = useState('');
  const [board, setBoard] = useState('');
  const [pot, setPot] = useState('');
  const [toCall, setToCall] = useState('');
  const [stack, setStack] = useState('');
  const [result, setResult] = useState<EquityResult | null>(null);
  const [computing, setComputing] = useState(false);

  const holeCount = VARIANT_HOLE_CARDS[variant];
  const heroReady = parseCards(hero).length === holeCount;
  const villainCount = parseCards(villain).length;

  /** Switch variant; trim hands that exceed the new hole-card limit. */
  const switchVariant = (v: GameVariant) => {
    setVariant(v);
    const max = VARIANT_HOLE_CARDS[v];
    const trim = (value: string, apply: (s: string) => void) => {
      const cards = parseCards(value);
      if (cards.length > max) apply(serializeCards(cards.slice(0, max)));
    };
    trim(hero, setHero);
    trim(villain, setVillain);
    setResult(null);
  };

  const run = () => {
    if (!heroReady) return;
    setComputing(true);
    setResult(null);
    setTimeout(() => {
      setResult(estimateEquity(hero, villain, board, ITERATIONS_BY_VARIANT[variant]));
      setComputing(false);
    }, 16);
  };

  const odds = potOdds(Number(pot) || 0, Number(toCall) || 0);
  const callOk = result && odds ? result.equity >= odds.required : null;
  const potNum = Number(pot) || 0;
  const stackNum = Number(stack) || 0;
  const spr = potNum > 0 && stackNum > 0 ? stackNum / potNum : null;

  const reset = () => {
    setHero('');
    setVillain('');
    setBoard('');
    setPot('');
    setToCall('');
    setStack('');
    setResult(null);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: 'Equity Calculator' }} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.intro}>
          Run hand-vs-hand (or vs a random hand) equity on any board, then check the call price.
        </Text>

        <View>
          <Text style={styles.gameLabel}>Game</Text>
          <View style={styles.gameChips}>
            {GAME_VARIANTS.map((v) => (
              <Chip
                key={v}
                label={VARIANT_LABELS[v]}
                tone="accent"
                active={variant === v}
                onPress={() => switchVariant(v)}
              />
            ))}
          </View>
        </View>

        <CardSelectField
          label="Hero hand"
          value={hero}
          onChange={setHero}
          max={holeCount}
          disabledCards={[...parseCards(villain), ...parseCards(board)]}
          hint={`Your ${holeCount} hole cards`}
        />
        <CardSelectField
          label="Villain hand"
          value={villain}
          onChange={setVillain}
          max={holeCount}
          disabledCards={[...parseCards(hero), ...parseCards(board)]}
          hint={villainCount < holeCount ? 'Leave empty to run vs a random hand' : undefined}
        />
        <CardSelectField
          label="Board"
          value={board}
          onChange={setBoard}
          max={5}
          disabledCards={[...parseCards(hero), ...parseCards(villain)]}
          hint="Flop, turn and river — leave empty for preflop"
        />

        <Pressable
          onPress={run}
          disabled={!heroReady || computing}
          style={[styles.runBtn, (!heroReady || computing) && styles.runBtnDisabled]}
        >
          {computing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.runLabel}>Calculate equity</Text>
          )}
        </Pressable>
        {!heroReady ? <Text style={styles.warn}>Pick {holeCount} hero cards to run.</Text> : null}

        {result ? (
          <View style={styles.result}>
            <View style={styles.equityRow}>
              <Text style={styles.equityBig}>{(result.equity * 100).toFixed(1)}%</Text>
              <Text style={styles.equityCaption}>
                hero equity{villainCount === holeCount ? ' vs villain' : ' vs random'}
              </Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barSeg, { flex: result.win, backgroundColor: colors.profit }]} />
              <View style={[styles.barSeg, { flex: result.tie, backgroundColor: colors.warn }]} />
              <View style={[styles.barSeg, { flex: result.lose, backgroundColor: colors.loss }]} />
            </View>
            <Text style={styles.legend}>
              Win {(result.win * 100).toFixed(1)}% · Tie {(result.tie * 100).toFixed(1)}% · Lose{' '}
              {(result.lose * 100).toFixed(1)}%
            </Text>
            <Text style={styles.iters}>{result.iterations.toLocaleString()} simulations</Text>
          </View>
        ) : null}

        <Text style={styles.section}>Pot odds</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <FormField label="Pot" placeholder="100" keyboardType="decimal-pad" value={pot} onChangeText={setPot} />
          </View>
          <View style={styles.col}>
            <FormField label="To call" placeholder="33" keyboardType="decimal-pad" value={toCall} onChangeText={setToCall} />
          </View>
          <View style={styles.col}>
            <FormField label="Eff. stack" placeholder="500" keyboardType="decimal-pad" value={stack} onChangeText={setStack} />
          </View>
        </View>

        {odds ? (
          <View style={styles.odds}>
            <Text style={styles.oddsLine}>
              Pot odds {odds.ratio} · need {(odds.required * 100).toFixed(1)}% equity
              {spr ? ` · SPR ${spr.toFixed(1)}` : ''}
            </Text>
            {callOk !== null ? (
              <Text style={[styles.verdict, { color: callOk ? colors.profit : colors.loss }]}>
                {callOk
                  ? `✓ Call is +EV (${(result!.equity * 100).toFixed(1)}% ≥ ${(odds.required * 100).toFixed(1)}%)`
                  : `✗ Call is -EV (${(result!.equity * 100).toFixed(1)}% < ${(odds.required * 100).toFixed(1)}%)`}
              </Text>
            ) : (
              <Text style={styles.hint}>Run equity above to get a call/fold verdict.</Text>
            )}
          </View>
        ) : (
          <Text style={styles.hint}>Enter a pot and a call amount to see the price.</Text>
        )}

        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={styles.resetLabel}>Reset</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  gameLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
    marginBottom: 6,
  },
  gameChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  runBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  runBtnDisabled: { backgroundColor: colors.border },
  runLabel: { color: '#fff', fontWeight: '800', fontSize: typography.body },
  warn: { color: colors.warn, fontSize: typography.small, fontWeight: '600' },
  result: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  equityRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  equityBig: { color: colors.text, fontSize: typography.display, fontWeight: '800' },
  equityCaption: { color: colors.textMuted, fontSize: typography.small },
  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  barSeg: { height: '100%' },
  legend: { color: colors.textMuted, fontSize: typography.small },
  iters: { color: colors.textDim, fontSize: typography.micro },
  section: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  odds: { gap: 4 },
  oddsLine: { color: colors.textMuted, fontSize: typography.small },
  verdict: { fontSize: typography.body, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: typography.small },
  resetBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetLabel: { color: colors.textMuted, fontSize: typography.small, fontWeight: '600' },
});
