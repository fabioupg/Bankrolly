import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors, radius, spacing, typography } from '@/theme/colors';
import type { RoiPoint } from '@/utils/calculations';
import { formatPercent } from '@/utils/formatters';

interface Props {
  data: RoiPoint[];
  height?: number;
}

const PADDING = { top: 16, right: 12, bottom: 12, left: 56 };

export function RoiChart({ data, height = 200 }: Props) {
  const [width, setWidth] = useState(0);

  const series = useMemo(() => {
    if (!data.length) return null;
    const values = data.map((p) => p.cumulativeROI);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    return { values, min, max };
  }, [data]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (!series) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No tournaments logged yet</Text>
      </View>
    );
  }

  const innerW = Math.max(0, width - PADDING.left - PADDING.right);
  const innerH = Math.max(0, height - PADDING.top - PADDING.bottom);
  const range = series.max - series.min || 1;

  const xFor = (i: number) =>
    PADDING.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yFor = (v: number) => PADDING.top + innerH - ((v - series.min) / range) * innerH;

  const points = series.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => series.min + (range * i) / ticks);
  const zeroY = series.min < 0 && series.max > 0 ? yFor(0) : null;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {tickValues.map((tv, i) => (
            <Line
              key={`g-${i}`}
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
              key={`l-${i}`}
              x={PADDING.left - 6}
              y={yFor(tv) + 4}
              fontSize={10}
              textAnchor="end"
              fill={colors.textMuted}
            >
              {formatPercent(tv, 0)}
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
          <Polyline
            points={points}
            stroke="#3b6dff"
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
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
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
});
