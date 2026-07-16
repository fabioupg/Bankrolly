import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { Chip } from '@/components/Chip';
import {
  commitImport,
  previewImport,
  type DateOrder,
  type ImportPreview,
} from '@/utils/import';
import { useSettingsStore } from '@/store/useStatsStore';
import { formatPnL } from '@/utils/formatters';
import { colors, radius, spacing, typography } from '@/theme/colors';

export default function ImportScreen() {
  const currency = useSettingsStore((s) => s.currency);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-run the preview under a chosen day/month order once the file is loaded.
  const run = async (raw: string, order: DateOrder) => {
    setBusy(true);
    try {
      setText(raw);
      setPreview(await previewImport(raw, order));
    } catch (err) {
      Alert.alert('Could not read the file', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPick = async () => {
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'text/plain',
          'public.comma-separated-values-text',
        ],
        copyToCacheDirectory: true,
      });
    } catch (err) {
      Alert.alert('Could not open the file', (err as Error).message);
      return;
    }
    if (picked.canceled || !picked.assets?.length) return;
    try {
      const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await run(raw, 'auto');
    } catch (err) {
      Alert.alert('Could not read the file', (err as Error).message);
    }
  };

  const onConfirm = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await commitImport(preview);
      Alert.alert(
        'Import finished',
        `${res.cash} cash sessions, ${res.tournaments} tournaments and ${res.transactions} transactions added.`,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert('Import failed', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const total = preview
    ? preview.cashCount + preview.tournamentCount + preview.transactionCount
    : 0;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: 'Import from another app' }} />
      <ScrollView contentContainerStyle={styles.body}>
        {!preview ? (
          <View style={styles.card}>
            <SectionTitle title="Pick a CSV file" />
            <Text style={styles.hint}>
              Export your history from another poker app — Poker Bankroll Tracker, BINK, Left
              Pocket, a spreadsheet, anything — and choose the file here. Bankrolly detects the
              format on its own and shows you a preview before saving.
            </Text>
            <PrimaryButton label="Choose CSV file" onPress={onPick} loading={busy} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <SectionTitle title="Detected format" />
              <Text style={styles.source}>{preview.sourceApp}</Text>
              <View style={styles.countRow}>
                <Count n={preview.cashCount} label="Cash" />
                <Count n={preview.tournamentCount} label="Tourneys" />
                <Count n={preview.transactionCount} label="Transactions" />
              </View>
              {preview.duplicateCount > 0 ? (
                <Text style={styles.hint}>
                  {preview.duplicateCount} row{preview.duplicateCount === 1 ? '' : 's'} already in
                  Bankrolly will be skipped.
                </Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <SectionTitle title="Result" />
              <Row label="Sessions net">
                <Text style={[styles.value, { color: pnlColor(preview.sessionsNet) }]}>
                  {formatPnL(preview.sessionsNet, currency)}
                </Text>
              </Row>
              <Row label="Deposits / costs">
                <Text style={[styles.value, { color: pnlColor(preview.transactionsNet) }]}>
                  {formatPnL(preview.transactionsNet, currency)}
                </Text>
              </Row>
              <Text style={styles.hint}>
                Deposits, withdrawals and costs move your bankroll but stay out of your win rate and
                hourly.
              </Text>
            </View>

            {preview.datesAmbiguous ? (
              <View style={styles.warnCard}>
                <Text style={styles.warnTitle}>Which way round are the dates?</Text>
                <Text style={styles.hint}>
                  This file uses dates like 01/02/2026 and does not say which number is the day.
                  Pick the format the exporting app used.
                </Text>
                <View style={styles.chipRow}>
                  <Chip
                    label="MM/DD (US)"
                    active={preview.order === 'mdy'}
                    tone="accent"
                    onPress={() => run(text, 'mdy')}
                  />
                  <Chip
                    label="DD/MM (EU)"
                    active={preview.order === 'dmy'}
                    tone="accent"
                    onPress={() => run(text, 'dmy')}
                  />
                </View>
              </View>
            ) : null}

            {preview.warnings.length > 0 ? (
              <View style={styles.warnCard}>
                <Text style={styles.warnTitle}>Heads up</Text>
                {preview.warnings.map((w, i) => (
                  <Text key={i} style={styles.warnLine}>
                    • {w}
                  </Text>
                ))}
              </View>
            ) : null}

            {preview.unmapped.length > 0 ? (
              <View style={styles.card}>
                <SectionTitle title="Ignored columns" />
                <Text style={styles.hint}>
                  These columns weren&apos;t recognised and are skipped:{' '}
                  {preview.unmapped.join(', ')}
                </Text>
              </View>
            ) : null}

            {preview.skipped.length > 0 ? (
              <View style={styles.card}>
                <SectionTitle title={`${preview.skipped.length} skipped rows`} />
                {preview.skipped.slice(0, 8).map((s) => (
                  <Text key={s.row} style={styles.issue}>
                    Row {s.row}: {s.message}
                  </Text>
                ))}
                {preview.skipped.length > 8 ? (
                  <Text style={styles.hint}>…and {preview.skipped.length - 8} more.</Text>
                ) : null}
              </View>
            ) : null}

            {preview.issues.length > 0 ? (
              <View style={styles.card}>
                <SectionTitle title={`${preview.issues.length} notes`} />
                {preview.issues.slice(0, 8).map((s, i) => (
                  <Text key={i} style={styles.issue}>
                    Row {s.row}: {s.message}
                  </Text>
                ))}
                {preview.issues.length > 8 ? (
                  <Text style={styles.hint}>…and {preview.issues.length - 8} more.</Text>
                ) : null}
              </View>
            ) : null}

            <PrimaryButton
              label={total > 0 ? `Import ${total} entries` : 'Nothing to import'}
              onPress={onConfirm}
              loading={busy}
              disabled={total === 0}
            />
            <PrimaryButton
              label="Choose a different file"
              variant="ghost"
              onPress={() => {
                setPreview(null);
                setText('');
              }}
            />
          </>
        )}
        {busy ? <ActivityIndicator color={colors.profit} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function pnlColor(v: number) {
  return v > 0 ? colors.profit : v < 0 ? colors.loss : colors.neutral;
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.countBox}>
      <Text style={styles.countValue}>{n}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.valueRow}>
      <Text style={styles.valueLabel}>{label}</Text>
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
    gap: spacing.sm,
  },
  warnCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.warn,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  warnTitle: { color: colors.warn, fontSize: typography.body, fontWeight: '800' },
  warnLine: { color: colors.text, fontSize: typography.small, lineHeight: 19 },
  source: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: typography.small, lineHeight: 18 },
  countRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  countBox: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  countValue: { color: colors.text, fontSize: typography.title, fontWeight: '700' },
  countLabel: { color: colors.textMuted, fontSize: typography.micro, letterSpacing: 0.5 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valueLabel: { color: colors.textMuted, fontSize: typography.small },
  value: { fontSize: typography.body, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  issue: { color: colors.textDim, fontSize: typography.small, lineHeight: 18 },
});
