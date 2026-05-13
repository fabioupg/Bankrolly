import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { TripPicker } from '@/components/TripPicker';
import { useCanAdd } from '@/hooks/useCanAdd';
import { promptUpgrade } from '@/components/UpgradePrompt';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useSettingsStore } from '@/store/useStatsStore';
import {
  TOURNAMENT_FORMATS,
  type Tournament,
  type TournamentFormat,
} from '@/db/schema';
import { colors, radius, spacing, typography, pnlColor } from '@/theme/colors';
import { formatPercent, formatPnL } from '@/utils/formatters';
import { tournamentInvested, tournamentNet, tournamentROI } from '@/utils/calculations';

interface FormState {
  date: Date;
  name: string;
  venue: string;
  format: TournamentFormat;
  buyIn: string;
  rebuys: string;
  addon: string;
  fieldSize: string;
  finishPosition: string;
  prize: string;
  bounties: string;
  notes: string;
  tripId: string | null;
}

function toForm(t?: Tournament): FormState {
  if (!t) {
    return {
      date: new Date(),
      name: '',
      venue: '',
      format: 'MTT',
      buyIn: '',
      rebuys: '',
      addon: '',
      fieldSize: '',
      finishPosition: '',
      prize: '',
      bounties: '',
      notes: '',
      tripId: null,
    };
  }
  const fmt = TOURNAMENT_FORMATS.includes(t.format as TournamentFormat)
    ? (t.format as TournamentFormat)
    : 'MTT';
  return {
    date: new Date(t.date),
    name: t.name,
    venue: t.venue,
    format: fmt,
    buyIn: String(t.buyIn),
    rebuys: t.rebuys ? String(t.rebuys) : '',
    addon: t.addon ? String(t.addon) : '',
    fieldSize: t.fieldSize ? String(t.fieldSize) : '',
    finishPosition: t.finishPosition ? String(t.finishPosition) : '',
    prize: t.prize ? String(t.prize) : '',
    bounties: t.bounties ? String(t.bounties) : '',
    notes: t.notes,
    tripId: t.tripId ?? null,
  };
}

interface Props {
  initial?: Tournament;
  mode: 'create' | 'edit';
  footerContent?: React.ReactNode;
}

export function TournamentForm({ initial, mode, footerContent }: Props) {
  const [form, setForm] = useState<FormState>(toForm(initial));
  const [submitting, setSubmitting] = useState(false);
  const add = useTournamentStore((s) => s.add);
  const update = useTournamentStore((s) => s.update);
  const remove = useTournamentStore((s) => s.remove);
  const currency = useSettingsStore((s) => s.currency);
  const limit = useCanAdd('tournament');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const numericPayload = {
    buyIn: Number(form.buyIn) || 0,
    rebuys: Number(form.rebuys) || 0,
    addon: Number(form.addon) || 0,
    prize: Number(form.prize) || 0,
    bounties: Number(form.bounties) || 0,
  };
  const invested = tournamentInvested(numericPayload);
  const net = tournamentNet(numericPayload);
  const roi = tournamentROI(numericPayload);

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Name is required';
    if (!form.venue.trim()) return 'Venue is required';
    if (!form.buyIn.trim() || Number.isNaN(Number(form.buyIn))) {
      return 'Buy-in is required (number)';
    }
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Check the form', err);
      return;
    }
    if (mode === 'create' && !limit.canAdd) {
      promptUpgrade('tournament', limit.current, limit.limit);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        date: form.date.toISOString(),
        name: form.name.trim(),
        venue: form.venue.trim(),
        format: form.format,
        buyIn: Number(form.buyIn),
        rebuys: Number(form.rebuys) || 0,
        addon: Number(form.addon) || 0,
        fieldSize: Math.floor(Number(form.fieldSize)) || 0,
        finishPosition: Math.floor(Number(form.finishPosition)) || 0,
        prize: Number(form.prize) || 0,
        bounties: Number(form.bounties) || 0,
        notes: form.notes.trim(),
        tripId: form.tripId,
      };
      if (mode === 'edit' && initial) {
        await update(initial.id, payload);
        router.back();
      } else {
        const created = await add(payload);
        router.replace(`/tournament/${created.id}`);
      }
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = () => {
    if (!initial) return;
    Alert.alert('Delete tournament?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove(initial.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <DateField label="Date" value={form.date} onChange={(d) => set('date', d)} />
        <FormField
          label="Name"
          placeholder="e.g. WSOP $400 Deepstack"
          value={form.name}
          onChangeText={(v) => set('name', v)}
        />
        <FormField
          label="Venue"
          placeholder="e.g. Wynn, PokerStars"
          value={form.venue}
          onChangeText={(v) => set('venue', v)}
        />

        <View>
          <Text style={styles.fieldLabel}>Format</Text>
          <View style={styles.chips}>
            {TOURNAMENT_FORMATS.map((f) => (
              <Chip
                key={f}
                label={f}
                tone="accent"
                active={form.format === f}
                onPress={() => set('format', f)}
              />
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <FormField
              label="Buy-in"
              placeholder="400"
              keyboardType="decimal-pad"
              value={form.buyIn}
              onChangeText={(v) => set('buyIn', v)}
            />
          </View>
          <View style={styles.flex}>
            <FormField
              label="Rebuys"
              placeholder="0"
              keyboardType="decimal-pad"
              value={form.rebuys}
              onChangeText={(v) => set('rebuys', v)}
            />
          </View>
          <View style={styles.flex}>
            <FormField
              label="Add-on"
              placeholder="0"
              keyboardType="decimal-pad"
              value={form.addon}
              onChangeText={(v) => set('addon', v)}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <FormField
              label="Field size"
              placeholder="320"
              keyboardType="number-pad"
              value={form.fieldSize}
              onChangeText={(v) => set('fieldSize', v)}
            />
          </View>
          <View style={styles.flex}>
            <FormField
              label="Finish"
              placeholder="14"
              keyboardType="number-pad"
              value={form.finishPosition}
              onChangeText={(v) => set('finishPosition', v)}
              hint={
                form.fieldSize && form.finishPosition
                  ? `Top ${formatPercent(
                      (Number(form.finishPosition) / Math.max(1, Number(form.fieldSize))) * 100,
                      0,
                    )}`
                  : undefined
              }
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <FormField
              label="Prize"
              placeholder="0"
              keyboardType="decimal-pad"
              value={form.prize}
              onChangeText={(v) => set('prize', v)}
            />
          </View>
          <View style={styles.flex}>
            <FormField
              label="Bounties"
              placeholder="0"
              keyboardType="decimal-pad"
              value={form.bounties}
              onChangeText={(v) => set('bounties', v)}
            />
          </View>
        </View>

        <TripPicker
          value={form.tripId}
          onChange={(id) => set('tripId', id)}
          preferredDateIso={form.date.toISOString()}
        />

        <FormField
          label="Notes"
          placeholder="Key spots, structure thoughts…"
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          multiline
          numberOfLines={4}
          style={styles.notes}
        />

        <View style={styles.summary}>
          <SectionTitle title="Summary" />
          <SummaryRow label="Total invested" value={formatPnL(invested, currency)} />
          <SummaryRow label="Net P&L" value={formatPnL(net, currency)} color={pnlColor(net)} />
          <SummaryRow label="ROI" value={formatPercent(roi)} color={pnlColor(net)} />
        </View>

        <PrimaryButton
          label={mode === 'edit' ? 'Save changes' : 'Save tournament'}
          onPress={onSave}
          loading={submitting}
        />
        {mode === 'edit' ? (
          <PrimaryButton label="Delete tournament" variant="danger" onPress={onDelete} />
        ) : null}
        {mode === 'edit' && initial ? (
          <PrimaryButton
            label="Add hand note for this tournament"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: '/hand/new',
                params: { sessionId: initial.id, sessionType: 'tournament' },
              })
            }
          />
        ) : null}
        {footerContent}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
    marginBottom: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  summaryValue: {
    color: colors.text,
    fontWeight: '700',
    fontSize: typography.body,
  },
});
