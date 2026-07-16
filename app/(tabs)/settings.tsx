import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionTitle } from '@/components/SectionTitle';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSettingsStore } from '@/store/useStatsStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useHandStore } from '@/store/useHandStore';
import { useOnlineSessionStore } from '@/store/useOnlineSessionStore';
import { useLiveSessionStore } from '@/store/useLiveSessionStore';
import { useTransactionStore } from '@/store/useTransactionStore';
import { useStakingStore } from '@/store/useStakingStore';
import { useTripStore } from '@/store/useTripStore';
import { exportAllAsCsv } from '@/utils/csvExport';
import { importSessionsCsv } from '@/utils/csvImport';
import { exportBackup, importBackup, type ImportMode } from '@/utils/backup';
import { resetDatabase } from '@/db';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { colors, radius, spacing, typography } from '@/theme/colors';
import { CURRENCY_SYMBOLS, getCurrencySymbol } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';
import { useMemo, useState } from 'react';

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

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
  const [importing, setImporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const { signOut } = useAuth();
  const { user } = useUser();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const customerInfo = useSubscriptionStore((s) => s.customerInfo);

  const onSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to access your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/sign-in');
        },
      },
    ]);
  };

  const displayName =
    user?.fullName?.trim() ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.username ||
    'Signed in';
  const displayEmail = user?.primaryEmailAddress?.emailAddress;
  const initial = (displayName || '?').charAt(0).toUpperCase();

  const proEntitlement = customerInfo?.entitlements.active.pro ?? null;
  const renewalDate = proEntitlement?.expirationDate
    ? new Date(proEntitlement.expirationDate).toLocaleDateString()
    : null;
  const willRenew = proEntitlement?.willRenew ?? false;
  const productLabel = /yearly|annual/.test(proEntitlement?.productIdentifier ?? '')
    ? 'Yearly'
    : proEntitlement?.productIdentifier?.includes('monthly')
    ? 'Monthly'
    : 'Pro';

  const onManageSubscription = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

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
    if (!isPro) {
      router.push('/paywall');
      return;
    }
    if (cash.length + tourneys.length + hands.length === 0) {
      Alert.alert('Nothing to export', 'Log a session first.');
      return;
    }
    setExporting(true);
    try {
      await exportAllAsCsv({
        cash,
        tourneys,
        hands,
        online: useOnlineSessionStore.getState().sessions,
        staking: useStakingStore.getState().deals,
        transactions: useTransactionStore.getState().transactions,
        trips: useTripStore.getState().trips,
        tripExpenses: useTripStore.getState().expenses,
      });
    } catch (err) {
      Alert.alert('Export failed', (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const onImport = async () => {
    if (!isPro) {
      router.push('/paywall');
      return;
    }
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      });
    } catch (err) {
      Alert.alert('Import failed', (err as Error).message);
      return;
    }
    if (picked.canceled || !picked.assets?.length) return;

    setImporting(true);
    try {
      // Shared across files so a session can't be imported twice in one run.
      const existingIds = {
        cash: new Set(useSessionStore.getState().sessions.map((s) => s.id)),
        tournament: new Set(useTournamentStore.getState().tourneys.map((t) => t.id)),
      };
      let importedCash = 0;
      let importedTourneys = 0;
      let duplicates = 0;
      let invalid = 0;
      const failures: string[] = [];

      for (const asset of picked.assets) {
        try {
          const text = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          const res = await importSessionsCsv(text, existingIds);
          if (res.kind === 'cash') importedCash += res.imported;
          else importedTourneys += res.imported;
          duplicates += res.duplicates;
          invalid += res.errors.length;
        } catch (err) {
          failures.push(`${asset.name}: ${(err as Error).message}`);
        }
      }

      await Promise.all([
        useSessionStore.getState().hydrate(),
        useTournamentStore.getState().hydrate(),
      ]);

      const lines = [`${importedCash} cash sessions and ${importedTourneys} tournaments imported.`];
      if (duplicates) lines.push(`${duplicates} duplicate row${duplicates === 1 ? '' : 's'} skipped.`);
      if (invalid) lines.push(`${invalid} invalid row${invalid === 1 ? '' : 's'} skipped.`);
      lines.push(...failures);
      Alert.alert(failures.length ? 'Import finished with issues' : 'Import finished', lines.join('\n'));
    } finally {
      setImporting(false);
    }
  };

  // Backup/restore is deliberately not behind Pro: a user whose subscription
  // lapsed must still be able to get their own data onto a new phone.
  const onBackup = async () => {
    setBackingUp(true);
    try {
      const res = await exportBackup();
      Alert.alert(
        'Backup created',
        `${res.rows} entries and ${res.photos} photo${res.photos === 1 ? '' : 's'} · ${formatSize(res.bytes)}\n\n` +
          'Save it to iCloud Drive or AirDrop it to your new phone, then use "Restore backup" there.',
      );
    } catch (err) {
      Alert.alert('Backup failed', (err as Error).message);
    } finally {
      setBackingUp(false);
    }
  };

  const runRestore = async (uri: string, mode: ImportMode) => {
    setRestoring(true);
    try {
      const res = await importBackup(uri, mode);
      const lines = [
        `${res.rows} entries and ${res.photos} photo${res.photos === 1 ? '' : 's'} restored.`,
      ];
      if (res.skipped) {
        lines.push(`${res.skipped} entr${res.skipped === 1 ? 'y' : 'ies'} were already here and were skipped.`);
      }
      if (res.liveSessionSkipped) {
        lines.push(
          'The running session in the backup was skipped, because a session is already live on this phone.',
        );
      }
      Alert.alert('Restore finished', lines.join('\n'));
    } catch (err) {
      Alert.alert('Restore failed', (err as Error).message);
    } finally {
      setRestoring(false);
    }
  };

  const onRestore = async () => {
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      // The .bankrolly extension is ours, so no MIME filter would match it.
      picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    } catch (err) {
      Alert.alert('Restore failed', (err as Error).message);
      return;
    }
    if (picked.canceled || !picked.assets?.length) return;
    const { uri } = picked.assets[0];

    Alert.alert(
      'Restore backup',
      'Replace makes this phone match the backup exactly — pick this on a new phone.\n\n' +
        'Merge keeps what is already here and only adds what is missing.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', onPress: () => runRestore(uri, 'merge') },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Replace everything?',
              'Every session, tournament, hand, player, trip and photo on this phone is deleted and replaced by the backup. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Replace',
                  style: 'destructive',
                  onPress: () => runRestore(uri, 'replace'),
                },
              ],
            ),
        },
      ],
    );
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
            // Dismisses the lock-screen card and its photos before the table
            // it lives in is dropped.
            await useLiveSessionStore.getState().discard();
            resetDatabase();
            await Promise.all([
              useSessionStore.getState().hydrate(),
              useTournamentStore.getState().hydrate(),
              useHandStore.getState().hydrate(),
              useOnlineSessionStore.getState().hydrate(),
              useLiveSessionStore.getState().hydrate(),
              useTransactionStore.getState().hydrate(),
              useStakingStore.getState().hydrate(),
            ]);
            Alert.alert('Done', 'Database has been reset.');
          },
        },
      ],
    );
  };

  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your Bankrolly account and all associated data, including every session, tournament and hand note. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await user?.delete();
            } catch (err) {
              Alert.alert('Could not delete account', (err as Error).message);
              return;
            }
            await useLiveSessionStore.getState().discard();
            resetDatabase();
            await Promise.all([
              useSessionStore.getState().hydrate(),
              useTournamentStore.getState().hydrate(),
              useHandStore.getState().hydrate(),
              useOnlineSessionStore.getState().hydrate(),
              useLiveSessionStore.getState().hydrate(),
              useTransactionStore.getState().hydrate(),
              useStakingStore.getState().hydrate(),
            ]);
            try {
              await signOut();
            } catch {
              // session is already invalidated by the deletion
            }
            router.replace('/sign-in');
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.card}>
        <SectionTitle title="Account" />
        <View style={styles.accountRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.accountNameRow}>
              <Text style={styles.accountName}>{displayName}</Text>
              {isPro ? (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              ) : null}
            </View>
            {displayEmail ? <Text style={styles.accountEmail}>{displayEmail}</Text> : null}
          </View>
        </View>
        <PrimaryButton label="Sign out" variant="ghost" onPress={onSignOut} />
      </View>

      {isPro ? (
        <View style={styles.card}>
          <SectionTitle title="Subscription" />
          <View style={styles.subRow}>
            <View>
              <Text style={styles.subLabel}>Plan</Text>
              <Text style={styles.subValue}>Bankrolly Pro · {productLabel}</Text>
            </View>
            {renewalDate ? (
              <View>
                <Text style={styles.subLabel}>{willRenew ? 'Renews' : 'Expires'}</Text>
                <Text style={styles.subValue}>{renewalDate}</Text>
              </View>
            ) : null}
          </View>
          <PrimaryButton
            label="Manage subscription"
            variant="ghost"
            onPress={onManageSubscription}
          />
          <Text style={styles.hint}>Opens your Apple ID subscription settings.</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => router.push('/paywall')}
          style={({ pressed }) => [styles.upsellCard, pressed && { opacity: 0.95 }]}
        >
          <View style={styles.upsellRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.upsellTitle}>Upgrade to Pro</Text>
              <Text style={styles.upsellBody}>
                Unlimited sessions, trips, players & hands. Full analytics charts. CSV export.
                14-day free trial.
              </Text>
            </View>
            <Text style={styles.upsellChev}>›</Text>
          </View>
        </Pressable>
      )}

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
        <SectionTitle title="Notes & trips" />
        <PrimaryButton
          label="Trips"
          variant="ghost"
          onPress={() => router.push('/trips')}
        />
        <PrimaryButton
          label="Hand history"
          variant="ghost"
          onPress={() => router.push('/hand')}
        />
        <PrimaryButton
          label="Player notes"
          variant="ghost"
          onPress={() => router.push('/players')}
        />
        <PrimaryButton
          label="Staking"
          variant="ghost"
          onPress={() => router.push('/staking')}
        />
        <PrimaryButton
          label="Transactions"
          variant="ghost"
          onPress={() => router.push('/transactions')}
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
        <Text style={styles.hint}>
          Exports cash sessions, tournaments and hand notes — plus online sessions, staking,
          trips and transactions when you have any.
        </Text>
        <PrimaryButton label="Import CSV" variant="ghost" onPress={onImport} loading={importing} />
        <Text style={styles.hint}>
          Imports cash sessions and tournaments from CSV files in the same format as the export.
          Duplicates are skipped automatically.
        </Text>
      </View>

      <View style={styles.card}>
        <SectionTitle title="Import from another app" />
        <PrimaryButton
          label="Import a CSV file"
          variant="ghost"
          onPress={() => router.push('/import')}
        />
        <Text style={styles.hint}>
          Switching from Poker Bankroll Tracker, BINK, Left Pocket, Pokerbase or a spreadsheet?
          Bankrolly reads their CSV export, detects the format automatically and shows a preview
          before anything is saved. Deposits and costs are kept out of your win rate.
        </Text>
      </View>

      <View style={styles.card}>
        <SectionTitle title="Backup & restore" />
        <PrimaryButton label="Create backup" onPress={onBackup} loading={backingUp} />
        <Text style={styles.hint}>
          One encrypted file with everything: sessions, tournaments, online sessions, hands,
          players, trips and your live-session note photos.
        </Text>
        <PrimaryButton
          label="Restore backup"
          variant="ghost"
          onPress={onRestore}
          loading={restoring}
        />
        <Text style={styles.hint}>
          Got a new phone or a new iCloud account? Restore the file here. You choose whether it
          replaces everything or merges into what is already on this phone.
        </Text>
      </View>

      <View style={styles.card}>
        <SectionTitle title="Danger zone" />
        <PrimaryButton label="Reset database" variant="danger" onPress={onReset} />
        <Text style={styles.hint}>
          Deletes all local sessions, tournaments and hand notes. This action cannot be undone.
        </Text>
        <PrimaryButton label="Delete account" variant="danger" onPress={onDeleteAccount} />
        <Text style={styles.hint}>
          Permanently deletes your account and all associated data. This action cannot be undone.
        </Text>
      </View>

      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>Bankrolly</Text>
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
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  avatarText: {
    color: colors.profit,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  accountName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  accountEmail: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  proBadge: {
    backgroundColor: colors.profit,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  proBadgeText: {
    color: '#0b0f0d',
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  subLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  subValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: 2,
  },
  upsellCard: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  upsellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  upsellTitle: {
    color: colors.profit,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  upsellBody: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: 4,
  },
  upsellChev: {
    color: colors.profit,
    fontSize: 28,
    fontWeight: '700',
  },
});
