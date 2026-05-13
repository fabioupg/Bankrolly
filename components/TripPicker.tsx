import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { useTripStore } from '@/store/useTripStore';
import { isTripActive } from '@/utils/calculations';
import { colors, spacing, typography } from '@/theme/colors';

interface Props {
  value: string | null | undefined;
  onChange: (tripId: string | null) => void;
  preferredDateIso?: string;
}

export function TripPicker({ value, onChange, preferredDateIso }: Props) {
  const trips = useTripStore((s) => s.trips);

  const ordered = useMemo(() => {
    const active = trips.filter((t) => isTripActive(t));
    const others = trips.filter((t) => !isTripActive(t));
    if (preferredDateIso) {
      const d = new Date(preferredDateIso);
      others.sort((a, b) => {
        const da = Math.abs(d.getTime() - new Date(a.startDate).getTime());
        const db = Math.abs(d.getTime() - new Date(b.startDate).getTime());
        return da - db;
      });
    } else {
      others.sort((a, b) => b.startDate.localeCompare(a.startDate));
    }
    return [...active, ...others].slice(0, 12);
  }, [trips, preferredDateIso]);

  if (trips.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Trip</Text>
        <Text style={styles.hint}>No trips yet — create one in the Trips section to link sessions.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Trip</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip
          label="None"
          tone="accent"
          active={!value}
          onPress={() => onChange(null)}
        />
        {ordered.map((t) => {
          const isActive = isTripActive(t);
          return (
            <Chip
              key={t.id}
              label={isActive ? `● ${t.name}` : t.name}
              tone="accent"
              active={value === t.id}
              onPress={() => onChange(t.id)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.micro,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
});
