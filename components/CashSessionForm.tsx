import { useMemo, useState } from 'react';
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
import { useSessionStore } from '@/store/useSessionStore';
import { useSettingsStore } from '@/store/useStatsStore';
import {
  GAME_TYPES,
  STAKES_PRESETS,
  type CashSession,
  type GameType,
} from '@/db/schema';
import { colors, radius, spacing, typography, pnlColor } from '@/theme/colors';
import { formatPnL } from '@/utils/formatters';

interface FormState {
  date: Date;
  venue: string;
  gameType: GameType;
  stakes: string;
  buyIn: string;
  cashOut: string;
  hours: string;
  minutes: string;
  notes: string;
  tripId: string | null;
}

function toForm(s?: CashSession): FormState {
  if (!s) {
    return {
      date: new Date(),
      venue: '',
      gameType: 'NLH',
      stakes: '1/2',
      buyIn: '',
      cashOut: '',
      hours: '',
      minutes: '',
      notes: '',
      tripId: null,
    };
  }
  return {
    date: new Date(s.date),
    venue: s.venue,
    gameType: (GAME_TYPES.includes(s.gameType as GameType) ? s.gameType : 'NLH') as GameType,
    stakes: s.stakes,
    buyIn: String(s.buyIn),
    cashOut: String(s.cashOut),
    hours: String(Math.floor(s.durationMinutes / 60)),
    minutes: String(s.durationMinutes % 60),
    notes: s.notes,
    tripId: s.tripId ?? null,
  };
}

interface Props {
  initial?: CashSession;
  mode: 'create' | 'edit';
  onSaved?: () => void;
  footerContent?: React.ReactNode;
}

export function CashSessionForm({ initial, mode, onSaved, footerContent }: Props) {
  const [form, setForm] = useState<FormState>(toForm(initial));
  const [submitting, setSubmitting] = useState(false);
  const addSession = useSessionStore((s) => s.add);
  const updateSession = useSessionStore((s) => s.update);
  const removeSession = useSessionStore((s) => s.remove);
  const currency = useSettingsStore((s) => s.currency);
  const limit = useCanAdd('cash');

  const buyInNum = Number(form.buyIn) || 0;
  const cashOutNum = Number(form.cashOut) || 0;
  const profit = cashOutNum - buyInNum;
  const durationMinutes =
    (Math.max(0, Math.floor(Number(form.hours) || 0)) * 60) +
    Math.max(0, Math.floor(Number(form.minutes) || 0));

  const customStakes = useMemo(
    () => !STAKES_PRESETS.includes(form.stakes as (typeof STAKES_PRESETS)[number]) && form.stakes !== '',
    [form.stakes],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const validate = (): string | null => {
    if (!form.venue.trim()) return 'Venue is required';
    if (!form.stakes.trim()) return 'Stakes are required';
    if (!form.buyIn.trim()) return 'Buy-in is required';
    if (!form.cashOut.trim()) return 'Cash-out is required';
    if (Number.isNaN(Number(form.buyIn)) || Number.isNaN(Number(form.cashOut))) {
      return 'Buy-in and cash-out must be numbers';
    }
    if (durationMinutes <= 0) return 'Duration must be greater than zero';
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Check the form', err);
      return;
    }
    if (mode === 'create' && !limit.canAdd) {
      promptUpgrade('cash', limit.current, limit.limit);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        date: form.date.toISOString(),
        venue: form.venue.trim(),
        gameType: form.gameType,
        stakes: form.stakes.trim(),
        buyIn: Number(form.buyIn),
        cashOut: Number(form.cashOut),
        durationMinutes,
        notes: form.notes.trim(),
        tripId: form.tripId,
      };
      if (mode === 'edit' && initial) {
        await updateSession(initial.id, payload);
        onSaved?.();
        router.back();
      } else {
        const created = await addSession(payload);
        onSaved?.();
        router.replace(`/cash/${created.id}`);
      }
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = () => {
    if (!initial) return;
    Alert.alert('Delete session?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeSession(initial.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <DateField label="Date" value={form.date} onChange={(d) => set('date', d)} />
        <FormField
          label="Venue"
          placeholder="e.g. Bellagio, Home game"
          value={form.venue}
          onChangeText={(v) => set('venue', v)}
        />

        <View>
          <Text style={styles.fieldLabel}>Game</Text>
          <View style={styles.chips}>
            {GAME_TYPES.map((g) => (
              <Chip
                key={g}
                label={g}
                tone="accent"
                active={form.gameType === g}
                onPress={() => set('gameType', g)}
              />
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Stakes</Text>
          <View style={styles.chips}>
            {STAKES_PRESETS.map((s) => (
              <Chip
                key={s}
                label={s}
                tone="accent"
                active={form.stakes === s}
                onPress={() => set('stakes', s)}
              />
            ))}
            <Chip
              label={customStakes ? `Custom: ${form.stakes}` : 'Custom'}
              tone="accent"
              active={customStakes}
              onPress={() => set('stakes', customStakes ? '1/2' : '')}
            />
          </View>
          {(customStakes || form.stakes === '') && (
            <FormField
              label="Custom stakes"
              placeholder="e.g. 3/5 NLH"
              value={form.stakes}
              onChangeText={(v) => set('stakes', v)}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <FormField
              label="Buy-in"
              placeholder="200"
              keyboardType="decimal-pad"
              value={form.buyIn}
              onChangeText={(v) => set('buyIn', v)}
            />
          </View>
          <View style={styles.flex}>
            <FormField
              label="Cash-out"
              placeholder="450"
              keyboardType="decimal-pad"
              value={form.cashOut}
              onChangeText={(v) => set('cashOut', v)}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <FormField
              label="Hours"
              placeholder="4"
              keyboardType="number-pad"
              value={form.hours}
              onChangeText={(v) => set('hours', v)}
            />
          </View>
          <View style={styles.flex}>
            <FormField
              label="Minutes"
              placeholder="30"
              keyboardType="number-pad"
              value={form.minutes}
              onChangeText={(v) => set('minutes', v)}
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
          placeholder="What stood out about this session?"
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          multiline
          numberOfLines={4}
          style={styles.notes}
        />

        <View style={styles.summary}>
          <SectionTitle title="Summary" />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Profit</Text>
            <Text style={[styles.summaryValue, { color: pnlColor(profit) }]}>
              {formatPnL(profit, currency)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>
              {Math.floor(durationMinutes / 60)}h {durationMinutes % 60}m
            </Text>
          </View>
        </View>

        <PrimaryButton
          label={mode === 'edit' ? 'Save changes' : 'Save session'}
          onPress={onSave}
          loading={submitting}
        />
        {mode === 'edit' ? (
          <PrimaryButton label="Delete session" variant="danger" onPress={onDelete} />
        ) : null}
        {mode === 'edit' && initial ? (
          <PrimaryButton
            label="Add hand note for this session"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: '/hand/new',
                params: { sessionId: initial.id, sessionType: 'cash' },
              })
            }
          />
        ) : null}
        {footerContent}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
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
  flex: {
    flex: 1,
  },
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
