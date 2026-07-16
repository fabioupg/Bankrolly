import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors, radius, spacing, typography } from '@/theme/colors';
import { formatMoneyCompact } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';
import { formatClock, type StackPoint } from '@/utils/liveSession';

interface Props {
  points: StackPoint[];
  /** Break-even line: total invested so far. */
  buyIn: number;
  currency: Currency;
  height?: number;
}

const PADDING = { top: 16, right: 12, bottom: 22, left: 56 };

/**
 * Stack over the course of the running session. The buy-in is drawn as a dashed
 * break-even line so the player can see at a glance whether they are up or down.
 */
export function StackChart({ points, buyIn, currency, height = 200 }: Props) {
  const [width, setWidth] = useState(0);

  const series = useMemo(() => {
    if (points.length === 0) return null;
    const stacks = points.map((p) => p.stack);
    return {
      min: Math.min(...stacks, buyIn),
      max: Math.max(...stacks, buyIn),
    };
  }, [points, buyIn]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (!series) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyTitle}>No stack updates yet</Text>
        <Text style={styles.emptySub}>Update your stack to build the curve</Text>
      </View>
    );
  }

  const innerW = Math.max(0, width - PADDING.left - PADDING.right);
  const innerH = Math.max(0, height - PADDING.top - PADDING.bottom);
  // Pad a flat line (single point / unchanged stack) so it renders mid-chart.
  const span = series.max - series.min;
  const range = span || Math.max(1, Math.abs(series.max) * 0.1);
  const min = span ? series.min : series.min - range / 2;

  const xFor = (i: number) =>
    PADDING.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yFor = (v: number) => PADDING.top + innerH - ((v - min) / range) * innerH;

  const line = points.map((p, i) => `${xFor(i)},${yFor(p.stack)}`).join(' ');
  const ticks = 3;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => min + (range * i) / ticks);
  const last = points[points.length - 1];
  const up = last.stack >= buyIn;

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

          {/* Break-even line = total buy-in */}
          <Line
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={yFor(buyIn)}
            y2={yFor(buyIn)}
            stroke={colors.borderStrong}
            strokeWidth={1}
            strokeDasharray="4,4"
          />

          <Polyline
            points={line}
            stroke={up ? colors.profit : colors.loss}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle
            cx={xFor(points.length - 1)}
            cy={yFor(last.stack)}
            r={4}
            fill={up ? colors.profit : colors.loss}
          />

          <SvgText x={PADDING.left} y={height - 6} fontSize={10} fill={colors.textDim}>
            {formatClock(points[0].t)}
          </SvgText>
          {points.length > 1 ? (
            <SvgText
              x={width - PADDING.right}
              y={height - 6}
              fontSize={10}
              textAnchor="end"
              fill={colors.textDim}
            >
              {formatClock(last.t)}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
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
});
