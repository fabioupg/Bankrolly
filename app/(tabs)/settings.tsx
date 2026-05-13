import Constants from 'expo-constants';
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
import { exportAllAsCsv } from '@/utils/csvExport';
import { resetDatabase } from '@/db';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
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
  const productLabel = proEntitlement?.productIdentifier?.includes('yearly')
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
                7-day free trial.
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
