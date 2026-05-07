import Constants from 'expo-constants';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionTitle } from '@/components/SectionTitle';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSettingsStore } from '@/store/useStatsStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useHandStore } from '@/store/useHandStore';
import { exportAllAsCsv } from '@/utils/csvExport';
import { resetDatabase } from '@/db';
import { colors, radius, spacing, typography } from '@/theme/colors';
import { CURRENCY_SYMBOLS, getCurrencySymbol } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';
import { useMemo, useState } from 'react';

const POPULAR_CURRENCIES: Currency[] = [
  'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD', 'JPY',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'TRY', 'INR',
  'AED', 'SAR', 'ILS', 'ZAR', 'BRL', 'MXN', 'SGD', 'HKD',
  'CNY', 'KRW', 'THB', 'VND', 'IDR', 'PHP',
];

export default function SettingsScreen() {
  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const cash = useSessionStore((s) => s.sessions);
  const tourneys = useTournamentStore((s) => s.tourneys);
  const hands = useHandStore((s) => s.hands);
  const [exporting, setExporting] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const isCustom = useMemo(
    () => !POPULAR_CURRENCIES.includes(currency.toUpperCase() as Currency),
    [currency],
  );

  const onSetCustom = () => {
    const code = customCode.trim().toUpperCase();
    if (code.length < 2 || code.length > 5) {
      Alert.alert('Invalid currency code', 'Use 2–5 letters like VND, BHD, XAU.');
      return;
    }
    setCurrency(code);
    setCustomCode('');
  };

  const onExport = async () => {
    if (cash.length + tourneys.length + hands.length === 0) {
      Alert.alert('Nothing to export', 'Log a session first.');
      return;
    }
    setExporting(true);
    try {
      await exportAllAsCsv({ cash, tourneys, hands });
    } catch (err) {
      Alert.alert('Export failed', (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const onReset = () => {
    Alert.alert(
      'Reset database?',
      'All sessions, tournaments and hand notes will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            resetDatabase();
            await Promise.all([
              useSessionStore.getState().hydrate(),
              useTournamentStore.getState().hydrate(),
              useHandStore.getState().hydrate(),
            ]);
            Alert.alert('Done', 'Database has been reset.');
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.card}>
        <SectionTitle title="Currency" />
        <View style={styles.currentRow}>
          <Text style={styles.currentLabel}>Current</Text>
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>{getCurrencySymbol(currency).trim()}</Text>
            <Text style={styles.currentCode}>{currency.toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.chips}>
          {POPULAR_CURRENCIES.map((c) => (
            <Chip
              key={c}
              label={`${CURRENCY_SYMBOLS[c]?.trim() ?? c} ${c}`}
              active={currency.toUpperCase() === c}
              tone="accent"
              onPress={() => setCurrency(c)}
            />
          ))}
        </View>
        <View style={styles.customRow}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Custom currency code"
              placeholder={isCustom ? currency.toUpperCase() : 'e.g. VND, BHD, XAU'}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={5}
              value={customCode}
              onChangeText={setCustomCode}
              hint="2–5 letters. Symbol falls back to the code if unknown."
            />
          </View>
          <PrimaryButton label="Set" onPress={onSetCustom} style={styles.setBtn} />
        </View>
        <Text style={styles.hint}>
          Changes how amounts are displayed throughout the app. Stored values are unchanged.
        </Text>
      </View>

      <View style={styles.card}>
        <SectionTitle title="Hand history" />
        <PrimaryButton
          label="Open hand history"
          variant="ghost"
          onPress={() => router.push('/hand')}
        />
      </View>

      <View style={styles.card}>
        <SectionTitle title="Data" />
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{cash.length}</Text>
            <Text style={styles.statLabel}>Cash</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{tourneys.length}</Text>
            <Text style={styles.statLabel}>Tourneys</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{hands.length}</Text>
            <Text style={styles.statLabel}>Hands</Text>
          </View>
        </View>
        <PrimaryButton label="Export CSV" onPress={onExport} loading={exporting} />
        <Text style={styles.hint}>Exports cash sessions, tournaments and hand notes as 3 CSV files.</Text>
      </View>

      <View style={styles.card}>
        <SectionTitle title="Danger zone" />
        <PrimaryButton label="Reset database" variant="danger" onPress={onReset} />
        <Text style={styles.hint}>This action cannot be undone.</Text>
      </View>

      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>PokerLedger</Text>
        <Text style={styles.aboutVersion}>v{version}</Text>
        <Text style={styles.aboutBody}>Local-first poker bankroll tracker.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  currentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  currentBadgeText: {
    color: colors.profit,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  currentCode: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  setBtn: {
    paddingHorizontal: spacing.lg,
    minWidth: 88,
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.small,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 0.5,
  },
  aboutCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: 4,
  },
  aboutTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  aboutVersion: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  aboutBody: {
    color: colors.textDim,
    fontSize: typography.small,
  },
});
