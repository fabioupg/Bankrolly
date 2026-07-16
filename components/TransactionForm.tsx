import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { Chip } from '@/components/Chip';
import { useTransactionStore } from '@/store/useTransactionStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { TRANSACTION_KINDS, type TransactionKind } from '@/db/schema';
import { formatPnL } from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';

interface Props {
  mode: 'create' | 'edit';
  transactionId?: string;
}

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  expense: 'Expense',
  bonus: 'Bonus / rakeback',
  other: 'Other',
};

/** Money leaving the bankroll for these kinds — the stored amount is negative. */
const NEGATIVE_KINDS: TransactionKind[] = ['withdrawal', 'expense'];

const todayISO = () => new Date().toISOString().slice(0, 10);
const numOr = (s: string, fallback = 0) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

/** The signed amount that gets stored: into the bankroll positive, out negative. */
function signedAmount(kind: TransactionKind, raw: string): number {
  const n = numOr(raw);
  if (kind === 'other') return n; // 'other' keeps whatever sign was typed
  const abs = Math.abs(n);
  return NEGATIVE_KINDS.includes(kind) ? -abs : abs;
}

export function TransactionForm({ mode, transactionId }: Props) {
  const currency = useSettingsStore((s) => s.currency);
  const transactions = useTransactionStore((s) => s.transactions);
  const add = useTransactionStore((s) => s.add);
  const update = useTransactionStore((s) => s.update);
  const remove = useTransactionStore((s) => s.remove);

  const existing = mode === 'edit' ? transactions.find((t) => t.id === transactionId) : undefined;

  const [kind, setKind] = useState<TransactionKind>(
    (existing?.kind as TransactionKind) ?? 'deposit',
  );
  const [date, setDate] = useState(existing?.date?.slice(0, 10) ?? todayISO());
  const [amount, setAmount] = useState(
    existing ? String(existing.kind === 'other' ? existing.amount : Math.abs(existing.amount)) : '',
  );
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => signedAmount(kind, amount), [kind, amount]);

  const onSave = async () => {
    if (numOr(amount) === 0) {
      Alert.alert('Enter an amount', 'The amount cannot be zero.');
      return;
    }
    setBusy(true);
    const payload = {
      date,
      kind,
      amount: signedAmount(kind, amount),
      venue: venue.trim(),
      currency: existing?.currency ?? '',
      notes: notes.trim(),
    };
    try {
      if (mode === 'edit' && transactionId) await update(transactionId, payload);
      else await add(payload);
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!transactionId) return;
    Alert.alert('Delete this transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove(transactionId);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: mode === 'edit' ? 'Edit transaction' : 'New transaction' }} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <SectionTitle title="Type" />
          <View style={styles.chipRow}>
            {TRANSACTION_KINDS.map((k) => (
              <Chip
                key={k}
                label={TRANSACTION_KIND_LABELS[k]}
                active={kind === k}
                tone="accent"
                onPress={() => setKind(k)}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            {kind === 'other'
              ? 'Enter the amount with its sign: positive adds to the bankroll, negative takes from it.'
              : NEGATIVE_KINDS.includes(kind)
              ? 'Taken out of your bankroll. Kept out of your win rate and hourly.'
              : 'Added to your bankroll. Kept out of your win rate and hourly.'}
          </Text>
        </View>

        <View style={styles.card}>
          <FormField
            label="Amount"
            placeholder={kind === 'other' ? 'e.g. 500 or -500' : '500'}
            keyboardType={kind === 'other' ? 'numbers-and-punctuation' : 'decimal-pad'}
            value={amount}
            onChangeText={setAmount}
          />
          <FormField label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
          <FormField
            label="Venue / site"
            placeholder="Optional — e.g. Bellagio, PokerStars"
            value={venue}
            onChangeText={setVenue}
            autoCapitalize="words"
          />
          <FormField
            label="Notes"
            placeholder="Optional"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={styles.multi}
          />
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>BANKROLL IMPACT</Text>
          <Text style={[styles.previewValue, { color: pnlColor(preview) }]}>
            {formatPnL(preview, currency)}
          </Text>
        </View>

        <PrimaryButton
          label={mode === 'edit' ? 'Save changes' : 'Add transaction'}
          onPress={onSave}
          loading={busy}
        />
        {mode === 'edit' ? (
          <PrimaryButton label="Delete transaction" variant="danger" onPress={onDelete} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 1,
    fontWeight: '700',
  },
  previewValue: { fontSize: typography.title, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  hint: { color: colors.textMuted, fontSize: typography.small, lineHeight: 18 },
  multi: { minHeight: 64, textAlignVertical: 'top', paddingTop: spacing.sm },
});
