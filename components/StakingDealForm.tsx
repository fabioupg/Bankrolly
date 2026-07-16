import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { Chip } from '@/components/Chip';
import { useStakingStore } from '@/store/useStakingStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { settleStaking, type StakingDirection } from '@/utils/staking';
import { formatMoney, formatPnL } from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';

interface Props {
  mode: 'create' | 'edit';
  dealId?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const numOr = (s: string, fallback = 0) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

export function StakingDealForm({ mode, dealId }: Props) {
  const currency = useSettingsStore((s) => s.currency);
  const deals = useStakingStore((s) => s.deals);
  const add = useStakingStore((s) => s.add);
  const update = useStakingStore((s) => s.update);
  const remove = useStakingStore((s) => s.remove);
  const suggestMakeup = useStakingStore((s) => s.suggestMakeup);

  const existing = mode === 'edit' ? deals.find((d) => d.id === dealId) : undefined;

  const [direction, setDirection] = useState<StakingDirection>(
    (existing?.direction as StakingDirection) ?? 'backed',
  );
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [buyIn, setBuyIn] = useState(existing ? String(existing.buyIn) : '');
  const [percent, setPercent] = useState(existing ? String(existing.percent) : '');
  const [markup, setMarkup] = useState(existing ? String(existing.markup) : '1');
  const [result, setResult] = useState(existing ? String(existing.result) : '');
  const [makeupTouched, setMakeupTouched] = useState(false);
  const [makeupBefore, setMakeupBefore] = useState(existing ? String(existing.makeupBefore) : '0');
  const [note, setNote] = useState(existing?.note ?? '');
  const [settled, setSettled] = useState(!!existing?.settled);
  const [busy, setBusy] = useState(false);

  // Until the user edits makeup by hand, keep it in sync with what this
  // counterparty already carries. Only meaningful for new deals.
  const effectiveMakeup = useMemo(() => {
    if (makeupTouched || mode === 'edit') return numOr(makeupBefore);
    return suggestMakeup(counterparty, direction);
  }, [makeupTouched, makeupBefore, counterparty, direction, suggestMakeup, mode]);

  const preview = useMemo(
    () =>
      settleStaking({
        direction,
        buyIn: numOr(buyIn),
        percent: numOr(percent),
        markup: numOr(markup, 1),
        makeupBefore: effectiveMakeup,
        result: numOr(result),
      }),
    [direction, buyIn, percent, markup, effectiveMakeup, result],
  );

  const backed = direction === 'backed';

  const onSave = async () => {
    if (!counterparty.trim()) {
      Alert.alert(
        'Who is the deal with?',
        backed ? 'Name your backer.' : 'Name the player you back.',
      );
      return;
    }
    const p = numOr(percent);
    if (p <= 0 || p > 100) {
      Alert.alert('Check the percentage', 'Enter the staked share as 1–100.');
      return;
    }
    setBusy(true);
    const payload = {
      direction,
      counterparty: counterparty.trim(),
      date,
      buyIn: numOr(buyIn),
      percent: p,
      markup: Math.max(1, numOr(markup, 1)),
      makeupBefore: effectiveMakeup,
      result: numOr(result),
      settled: settled ? 1 : 0,
      // Stamp today only when the deal transitions to settled; a later edit of
      // an already-settled deal must not rewrite when it was settled.
      settledDate: settled
        ? existing?.settled
          ? existing.settledDate ?? todayISO()
          : todayISO()
        : null,
      note: note.trim(),
    };
    try {
      if (mode === 'edit' && dealId) await update(dealId, payload);
      else await add(payload);
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!dealId) return;
    Alert.alert('Delete this deal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove(dealId);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: mode === 'edit' ? 'Edit deal' : 'New staking deal' }} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <SectionTitle title="Direction" />
          <View style={styles.chipRow}>
            <Chip
              label="I'm backed"
              active={backed}
              tone="accent"
              onPress={() => setDirection('backed')}
            />
            <Chip
              label="I back someone"
              active={!backed}
              tone="accent"
              onPress={() => setDirection('backing')}
            />
          </View>
          <Text style={styles.hint}>
            {backed
              ? 'Investors buy a share of your action; you owe them their cut of the result.'
              : 'You buy a share of another player; you get your cut of their result.'}
          </Text>
        </View>

        <View style={styles.card}>
          <FormField
            label={backed ? 'Backer' : 'Player you back'}
            placeholder="Name"
            value={counterparty}
            onChangeText={setCounterparty}
            autoCapitalize="words"
          />
          <FormField label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
          <FormField
            label="Action buy-in"
            placeholder="1000"
            keyboardType="decimal-pad"
            value={buyIn}
            onChangeText={setBuyIn}
            hint="The total buy-in of the session or tournament being staked."
          />
          <FormField
            label="Staked share (%)"
            placeholder="50"
            keyboardType="decimal-pad"
            value={percent}
            onChangeText={setPercent}
            hint={backed ? 'How much of your action you sold.' : 'How much of them you bought.'}
          />
          <FormField
            label="Markup"
            placeholder="1.1"
            keyboardType="decimal-pad"
            value={markup}
            onChangeText={setMarkup}
            hint="Premium on the staked buy-in. 1 = none, 1.1 = 10% markup."
          />
          <FormField
            label="Result of the action"
            placeholder="e.g. 2400 win or -1000 loss"
            keyboardType="numbers-and-punctuation"
            value={result}
            onChangeText={setResult}
            hint="Cash-out minus buy-in. Negative for a loss."
          />
          <FormField
            label="Makeup carried in"
            placeholder="0"
            keyboardType="decimal-pad"
            value={makeupTouched || mode === 'edit' ? makeupBefore : String(effectiveMakeup)}
            onChangeText={(t) => {
              setMakeupTouched(true);
              setMakeupBefore(t);
            }}
            hint="Prior losses to recoup before profit is split. Auto-filled from earlier deals."
          />
        </View>

        <View style={styles.previewCard}>
          <SectionTitle title="Settlement" />
          <Row label="Staked share of result">
            <Text style={styles.previewVal}>{formatMoney(preview.backerShare, currency)}</Text>
          </Row>
          {preview.markupPremium !== 0 ? (
            <Row label="Markup premium to the horse">
              <Text style={styles.previewVal}>{formatMoney(preview.markupPremium, currency)}</Text>
            </Row>
          ) : null}
          <Row label={backed ? "Backer's profit/loss" : 'Your profit/loss as backer'}>
            <Text style={[styles.previewVal, { color: pnlColor(preview.backerPL) }]}>
              {formatPnL(preview.backerPL, currency)}
            </Text>
          </Row>
          {effectiveMakeup > 0 || preview.makeupAfter > 0 ? (
            <Row label="Makeup left after this deal">
              <Text style={[styles.previewVal, { color: colors.warn }]}>
                {formatMoney(preview.makeupAfter, currency)}
              </Text>
            </Row>
          ) : null}
          <View style={styles.divider} />
          <Row label="Your result from this deal">
            <Text style={[styles.previewBig, { color: pnlColor(preview.yourResult) }]}>
              {formatPnL(preview.yourResult, currency)}
            </Text>
          </Row>
          {preview.distributable > 0 ? (
            <Text style={styles.hint}>
              {formatMoney(preview.distributable, currency)} is released now; the rest clears makeup.
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <SectionTitle title="Status" />
          <View style={styles.chipRow}>
            <Chip label="Open" active={!settled} tone="accent" onPress={() => setSettled(false)} />
            <Chip label="Settled" active={settled} tone="accent" onPress={() => setSettled(true)} />
          </View>
          <FormField
            label="Note"
            placeholder="Optional"
            value={note}
            onChangeText={setNote}
            multiline
            style={styles.multi}
          />
        </View>

        <PrimaryButton
          label={mode === 'edit' ? 'Save changes' : 'Add deal'}
          onPress={onSave}
          loading={busy}
        />
        {mode === 'edit' ? (
          <PrimaryButton label="Delete deal" variant="danger" onPress={onDelete} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
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
    gap: spacing.sm,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  hint: { color: colors.textMuted, fontSize: typography.small, lineHeight: 18 },
  multi: { minHeight: 64, textAlignVertical: 'top', paddingTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: colors.textMuted, fontSize: typography.small, flex: 1 },
  previewVal: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  previewBig: { fontSize: typography.title, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
