import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography, pnlColor } from '@/theme/colors';
import { formatMoneyCompact } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';

interface Datum {
  label: string;
  value: number;
}

interface Props {
  data: Datum[];
  currency: Currency;
  height?: number;
  emptyText?: string;
}

export function BarChart({ data, currency, height = 200, emptyText = 'No data' }: Props) {
  if (!data.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <View style={styles.wrap}>
      {data.map((d) => {
        const widthPct = Math.min(100, (Math.abs(d.value) / maxAbs) * 100);
        const tone = pnlColor(d.value);
        return (
          <View key={d.label} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>{d.label}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${widthPct}%`,
                    backgroundColor: tone,
                    alignSelf: d.value < 0 ? 'flex-start' : 'flex-start',
                  },
                ]}
              />
            </View>
            <Text style={[styles.value, { color: tone }]}>
              {formatMoneyCompact(d.value, currency)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    width: 78,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '600',
  },
  track: {
    flex: 1,
    height: 18,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    minWidth: 2,
    borderRadius: radius.sm,
  },
  value: {
    width: 64,
    fontSize: typography.small,
    fontWeight: '700',
    textAlign: 'right',
  },
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
