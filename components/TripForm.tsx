import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { promptUpgrade } from '@/components/UpgradePrompt';
import { useCanAdd } from '@/hooks/useCanAdd';
import { useTripStore } from '@/store/useTripStore';
import { colors, spacing } from '@/theme/colors';
import type { Trip } from '@/db/schema';

interface FormState {
  name: string;
  destination: string;
  start: Date;
  end: Date;
  notes: string;
}

function toForm(t?: Trip): FormState {
  if (!t) {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);
    return {
      name: '',
      destination: '',
      start,
      end,
      notes: '',
    };
  }
  return {
    name: t.name,
    destination: t.destination,
    start: new Date(t.startDate),
    end: new Date(t.endDate),
    notes: t.notes,
  };
}

interface Props {
  initial?: Trip;
  mode: 'create' | 'edit';
  footerContent?: React.ReactNode;
}

export function TripForm({ initial, mode, footerContent }: Props) {
  const [form, setForm] = useState<FormState>(toForm(initial));
  const [submitting, setSubmitting] = useState(false);
  const addTrip = useTripStore((s) => s.addTrip);
  const updateTrip = useTripStore((s) => s.updateTrip);
  const removeTrip = useTripStore((s) => s.removeTrip);
  const limit = useCanAdd('trip');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const onSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give your trip a name like "WSOP Vegas 2026".');
      return;
    }
    if (form.end < form.start) {
      Alert.alert('Dates', 'End date must be on or after start date.');
      return;
    }
    if (mode === 'create' && !limit.canAdd) {
      promptUpgrade('trip', limit.current, limit.limit);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        destination: form.destination.trim(),
        startDate: form.start.toISOString(),
        endDate: form.end.toISOString(),
        notes: form.notes.trim(),
      };
      if (mode === 'edit' && initial) {
        await updateTrip(initial.id, payload);
        router.back();
      } else {
        const created = await addTrip(payload);
        router.replace(`/trips/${created.id}`);
      }
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = () => {
    if (!initial) return;
    Alert.alert(
      'Delete trip?',
      'Expenses will be deleted. Linked sessions stay but lose their trip link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeTrip(initial.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <FormField
          label="Trip name"
          placeholder="e.g. WSOP Vegas 2026"
          value={form.name}
          onChangeText={(v) => set('name', v)}
        />
        <FormField
          label="Destination"
          placeholder="e.g. Las Vegas, NV"
          value={form.destination}
          onChangeText={(v) => set('destination', v)}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <DateField label="Start date" value={form.start} onChange={(d) => set('start', d)} />
          </View>
          <View style={styles.flex}>
            <DateField label="End date" value={form.end} onChange={(d) => set('end', d)} />
          </View>
        </View>
        <FormField
          label="Notes"
          placeholder="Goals, schedule, who you're with..."
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          multiline
          style={styles.multi}
        />

        <PrimaryButton
          label={mode === 'edit' ? 'Save changes' : 'Create trip'}
          onPress={onSave}
          loading={submitting}
        />
        {mode === 'edit' ? (
          <PrimaryButton label="Delete trip" variant="danger" onPress={onDelete} />
        ) : null}
        {footerContent}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  multi: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
});
