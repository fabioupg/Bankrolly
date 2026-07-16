import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { useOnlineSessionStore } from '@/store/useOnlineSessionStore';
import { useSettingsStore } from '@/store/useStatsStore';
import {
  entriesTotals,
  parseEntries,
  serializeEntries,
  type OnlineEntry,
} from '@/utils/onlineSession';
import type { OnlineSession } from '@/db/schema';
import { colors, radius, spacing, typography, pnlColor } from '@/theme/colors';
import { formatPnL } from '@/utils/formatters';

interface FormState {
  date: Date;
  site: string;
  totalBuyIn: string;
  totalCash: string;
  notes: string;
  entries: OnlineEntry[];
}

function toForm(s?: OnlineSession): FormState {
  if (!s) {
    return { date: new Date(), site: '', totalBuyIn: '', totalCash: '', notes: '', entries: [] };
  }
  return {
    date: new Date(s.date),
    site: s.site,
    totalBuyIn: String(s.totalBuyIn),
    totalCash: String(s.totalCash),
    notes: s.notes,
    entries: parseEntries(s.entries),
  };
}

interface Props {
  initial?: OnlineSession;
  mode: 'create' | 'edit';
}

export function OnlineSessionForm({ initial, mode }: Props) {
  const [form, setForm] = useState<FormState>(toForm(initial));
  const [draft, setDraft] = useState({ name: '', buyIn: '', cash: '' });
  const [submitting, setSubmitting] = useState(false);
  const add = useOnlineSessionStore((s) => s.add);
  const update = useOnlineSessionStore((s) => s.update);
  const remove = useOnlineSessionStore((s) => s.remove);
  const currency = useSettingsStore((s) => s.currency);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const itemised = form.entries.length > 0;
  const computed = entriesTotals(form.entries);
  const buyIn = itemised ? computed.buyIn : Number(form.totalBuyIn) || 0;
  const cash = itemised ? computed.cash : Number(form.totalCash) || 0;
  const net = cash - buyIn;

  const addEntry = () => {
    if (!draft.name.trim() && !draft.buyIn.trim() && !draft.cash.trim()) return;
    const entry: OnlineEntry = {
      name: draft.name.trim() || `Tournament ${form.entries.length + 1}`,
      buyIn: Number(draft.buyIn) || 0,
      cash: Number(draft.cash) || 0,
    };
    set('entries', [...form.entries, entry]);
    setDraft({ name: '', buyIn: '', cash: '' });
  };

  const removeEntry = (index: number) =>
    set('entries', form.entries.filter((_, i) => i !== index));

  const onSave = async () => {
    if (!itemised && !form.totalBuyIn.trim() && !form.totalCash.trim()) {
      Alert.alert('Nothing to save', 'Enter total buy-ins / cashes, or add tournaments.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        date: form.date.toISOString(),
        site: form.site.trim(),
        totalBuyIn: buyIn,
        totalCash: cash,
        entries: serializeEntries(form.entries),
        notes: form.notes.trim(),
      };
      if (mode === 'edit' && initial) {
        await update(initial.id, payload);
        router.back();
      } else {
        const created = await add(payload);
        router.replace(`/online/${created.id}`);
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
          await remove(initial.id);
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
          label="Site (optional)"
          placeholder="PokerStars, GGPoker, 888…"
          value={form.site}
          onChangeText={(v) => set('site', v)}
        />

        <View style={styles.row}>
          <View style={styles.flex}>
            <FormField
              label="Total buy-ins"
              placeholder="120"
              keyboardType="decimal-pad"
              value={itemised ? String(computed.buyIn) : form.totalBuyIn}
              onChangeText={(v) => set('totalBuyIn', v)}
              editable={!itemised}
              hint={itemised ? 'From tournaments below' : undefined}
            />
          </View>
          <View style={styles.flex}>
            <FormField
              label="Total cashes"
              placeholder="305"
              keyboardType="decimal-pad"
              value={itemised ? String(computed.cash) : form.totalCash}
              onChangeText={(v) => set('totalCash', v)}
              editable={!itemised}
              hint={itemised ? 'From tournaments below' : undefined}
            />
          </View>
        </View>

        <View style={styles.block}>
          <SectionTitle title="Tournaments (optional)" />
          <Text style={styles.blockHint}>
            Add individual tournaments and the totals above fill in automatically.
          </Text>

          {form.entries.map((e, i) => (
            <View key={`${e.name}-${i}`} style={styles.entryRow}>
              <View style={styles.entryMeta}>
                <Text style={styles.entryName} numberOfLines={1}>{e.name}</Text>
                <Text style={styles.entrySub}>
                  Buy-in {formatPnL(-e.buyIn, currency)} · Cash {formatPnL(e.cash, currency)}
                </Text>
              </View>
              <Text style={[styles.entryNet, { color: pnlColor(e.cash - e.buyIn) }]}>
                {formatPnL(e.cash - e.buyIn, currency)}
              </Text>
              <Pressable onPress={() => removeEntry(i)} hitSlop={8} style={styles.remove}>
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </View>
          ))}

          <FormField
            label="Tournament name"
            placeholder="e.g. $11 Bounty Builder"
            value={draft.name}
            onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <FormField
                label="Buy-in"
                placeholder="11"
                keyboardType="decimal-pad"
                value={draft.buyIn}
                onChangeText={(v) => setDraft((d) => ({ ...d, buyIn: v }))}
              />
            </View>
            <View style={styles.flex}>
              <FormField
                label="Cash"
                placeholder="0"
                keyboardType="decimal-pad"
                value={draft.cash}
                onChangeText={(v) => setDraft((d) => ({ ...d, cash: v }))}
              />
            </View>
          </View>
          <Pressable onPress={addEntry} style={styles.addEntryBtn}>
            <Text style={styles.addEntryLabel}>+ Add tournament</Text>
          </Pressable>
        </View>

        <FormField
          label="Notes"
          placeholder="How did the session run?"
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          multiline
          numberOfLines={4}
          style={styles.notes}
        />

        <View style={styles.summary}>
          <SectionTitle title="Summary" />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Buy-ins</Text>
            <Text style={styles.summaryValue}>{formatPnL(-buyIn, currency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Cashes</Text>
            <Text style={styles.summaryValue}>{formatPnL(cash, currency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Net</Text>
            <Text style={[styles.summaryValue, { color: pnlColor(net) }]}>
              {formatPnL(net, currency)}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  block: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  blockHint: {
    color: colors.textDim,
    fontSize: typography.micro,
    marginTop: -spacing.xs,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  entryMeta: { flex: 1 },
  entryName: { color: colors.text, fontSize: typography.small, fontWeight: '700' },
  entrySub: { color: colors.textMuted, fontSize: typography.micro, marginTop: 2 },
  entryNet: { fontSize: typography.small, fontWeight: '700' },
  remove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 18 },
  addEntryBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  addEntryLabel: { color: colors.profit, fontSize: typography.small, fontWeight: '700' },
  notes: {
    minHeight: 88,
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
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.textMuted, fontSize: typography.body },
  summaryValue: { color: colors.text, fontWeight: '700', fontSize: typography.body },
});
