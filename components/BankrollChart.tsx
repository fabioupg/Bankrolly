import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors, radius, spacing, typography } from '@/theme/colors';
import { movingAverage, type BankrollPoint } from '@/utils/calculations';
import { formatMoneyCompact } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';

interface Props {
  data: BankrollPoint[];
  currency: Currency;
  height?: number;
  movingWindow?: number;
}

const PADDING = { top: 16, right: 12, bottom: 24, left: 56 };

export function BankrollChart({ data, currency, height = 240, movingWindow = 20 }: Props) {
  const [width, setWidth] = useState(0);

  const series = useMemo(() => {
    if (!data.length) return null;
    const cum = data.map((p) => p.cumulative);
    const ma = movingAverage(cum, Math.min(movingWindow, cum.length));
    const min = Math.min(...cum, 0);
    const max = Math.max(...cum, 0);
    return { cum, ma, min, max };
  }, [data, movingWindow]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (!series || !data.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyTitle}>No data yet</Text>
        <Text style={styles.emptySub}>Log a session to see your bankroll curve</Text>
      </View>
    );
  }

  const innerW = Math.max(0, width - PADDING.left - PADDING.right);
  const innerH = Math.max(0, height - PADDING.top - PADDING.bottom);
  const range = series.max - series.min || 1;

  const xFor = (i: number) =>
    PADDING.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yFor = (v: number) => PADDING.top + innerH - ((v - series.min) / range) * innerH;

  const cumPoints = series.cum.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
  const maPoints = series.ma
    .map((v, i) => (v == null ? null : `${xFor(i)},${yFor(v)}`))
    .filter((p): p is string => p != null)
    .join(' ');

  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => series.min + (range * i) / ticks);
  const zeroY = series.min < 0 && series.max > 0 ? yFor(0) : null;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {tickValues.map((tv, i) => (
            <Line
              key={`grid-${i}`}
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={yFor(tv)}
              y2={yFor(tv)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {tickValues.map((tv, i) => (
            <SvgText
              key={`label-${i}`}
              x={PADDING.left - 6}
              y={yFor(tv) + 4}
              fontSize={10}
              textAnchor="end"
              fill={colors.textMuted}
            >
              {formatMoneyCompact(tv, currency)}
            </SvgText>
          ))}
          {zeroY != null ? (
            <Line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={zeroY}
              y2={zeroY}
              stroke={colors.borderStrong}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          ) : null}
          {maPoints ? (
            <Polyline
              points={maPoints}
              stroke={colors.warn}
              strokeWidth={1.5}
              fill="none"
            />
          ) : null}
          <Polyline
            points={cumPoints}
            stroke={colors.profit}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
      <View style={styles.legend}>
        <LegendDot color={colors.profit} label="Bankroll" />
        <LegendDot color={colors.warn} label={`MA(${Math.min(movingWindow, data.length)})`} />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyTitle: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  emptySub: { color: colors.textMuted, fontSize: typography.small, marginTop: 4 },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: typography.small },
});
