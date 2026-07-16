import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CardSelectField } from '@/components/CardSelectField';
import { FormField } from '@/components/FormField';
import { parseCards } from '@/utils/cards';
import { estimateEquity, potOdds, type EquityResult } from '@/utils/equity';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  heroCards: string;
  board: string;
  /** Hole cards per hand: 2 (Hold'em) or 4/5/6 (Omaha). Defaults to 2. */
  holeCount?: number;
}

// Omaha scores every 2-of-hole x 3-of-board combo per iteration, so fewer
// iterations keep the on-device runtime comparable to the Hold'em path.
function iterationsFor(holeCount: number): number {
  if (holeCount <= 2) return 10000;
  if (holeCount === 4) return 2500;
  if (holeCount === 5) return 2000;
  return 1500;
}

/**
 * Self-contained equity + pot-odds tool. Hero cards and board come from the
 * form above; the villain hand and pot/bet are entered here. Runs a Monte-Carlo
 * simulation on demand and shows whether a call is +EV at the given price.
 */
export function EquityCalculator({ heroCards, board, holeCount = 2 }: Props) {
  const [villain, setVillain] = useState('');
  const [pot, setPot] = useState('');
  const [toCall, setToCall] = useState('');
  const [result, setResult] = useState<EquityResult | null>(null);
  const [computing, setComputing] = useState(false);

  const heroReady = parseCards(heroCards).length === holeCount;
  const used = [...parseCards(heroCards), ...parseCards(board)];

  const run = () => {
    if (!heroReady) return;
    setComputing(true);
    setResult(null);
    // Defer so the spinner paints before the synchronous simulation runs.
    setTimeout(() => {
      const r = estimateEquity(heroCards, villain, board, iterationsFor(holeCount));
      setResult(r);
      setComputing(false);
    }, 16);
  };

  const odds = potOdds(Number(pot) || 0, Number(toCall) || 0);
  const callOk = result && odds ? result.equity >= odds.required : null;
  const villainCount = parseCards(villain).length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Equity & pot odds</Text>

      {!heroReady ? (
        <Text style={styles.warn}>Set {holeCount} hero cards above to run equity.</Text>
      ) : (
        <Text style={styles.sub}>
          Hero {parseCards(heroCards).join(' ')}
          {parseCards(board).length ? ` · Board ${parseCards(board).join(' ')}` : ' · preflop'}
        </Text>
      )}

      <CardSelectField
        label="Villain hand"
        value={villain}
        onChange={setVillain}
        max={holeCount}
        disabledCards={used}
        hint={villainCount < holeCount ? 'Leave empty to run vs a random hand' : undefined}
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
        </View>
      ) : null}

      <View style={styles.potRow}>
        <View style={styles.potCol}>
          <FormField
            label="Pot"
            placeholder="100"
            keyboardType="decimal-pad"
            value={pot}
            onChangeText={setPot}
          />
        </View>
        <View style={styles.potCol}>
          <FormField
            label="To call"
            placeholder="33"
            keyboardType="decimal-pad"
            value={toCall}
            onChangeText={setToCall}
          />
        </View>
      </View>

      {odds ? (
        <View style={styles.odds}>
          <Text style={styles.oddsLine}>
            Pot odds {odds.ratio} · need {(odds.required * 100).toFixed(1)}% equity
          </Text>
          {callOk !== null ? (
            <Text style={[styles.verdict, { color: callOk ? colors.profit : colors.loss }]}>
              {callOk
                ? `✓ Call is +EV (${(result!.equity * 100).toFixed(1)}% ≥ ${(odds.required * 100).toFixed(1)}%)`
                : `✗ Call is -EV (${(result!.equity * 100).toFixed(1)}% < ${(odds.required * 100).toFixed(1)}%)`}
            </Text>
          ) : (
            <Text style={styles.hint}>Run equity to compare against this price.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  sub: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  warn: {
    color: colors.warn,
    fontSize: typography.small,
    fontWeight: '600',
  },
  runBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  runBtnDisabled: {
    backgroundColor: colors.border,
  },
  runLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.small,
  },
  result: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  equityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  equityBig: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  equityCaption: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  barSeg: {
    height: '100%',
  },
  legend: {
    color: colors.textMuted,
    fontSize: typography.micro,
  },
  potRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  potCol: {
    flex: 1,
  },
  odds: {
    gap: 4,
  },
  oddsLine: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  verdict: {
    fontSize: typography.small,
    fontWeight: '700',
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.micro,
  },
});
