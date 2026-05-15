import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { colors, radius, spacing, typography } from '@/theme/colors';

const FEATURES = [
  'Unlimited cash sessions and tournaments',
  'Unlimited player notes and hand history',
  'All analytics charts: bankroll, ROI, venue rate',
  'CSV export for cash, tourneys and hands',
  'Cross-device cloud sync',
  'Priority support',
];

const TOS_URL = 'https://fabioupg.github.io/Bankrolly/terms';
const PRIVACY_URL = 'https://fabioupg.github.io/Bankrolly/privacy';

export default function PaywallScreen() {
  const offering = useSubscriptionStore((s) => s.offering);
  const isPro = useSubscriptionStore((s) => s.isPro);
  const purchase = useSubscriptionStore((s) => s.purchase);
  const restore = useSubscriptionStore((s) => s.restore);
  const configurable = useSubscriptionStore((s) => s.configurable);
  const loading = useSubscriptionStore((s) => s.loading);
  const refresh = useSubscriptionStore((s) => s.refresh);
  const lastError = useSubscriptionStore((s) => s.lastError);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (configurable) void refresh();
  }, [configurable, refresh]);

  const yearly = useMemo(() => offering?.annual ?? null, [offering]);
  const monthly = useMemo(() => offering?.monthly ?? null, [offering]);

  const [selected, setSelected] = useState<'annual' | 'monthly'>('annual');

  useEffect(() => {
    if (isPro) router.dismiss();
  }, [isPro]);

  const selectedPackage: PurchasesPackage | null =
    selected === 'annual' ? yearly : monthly;

  const trialEligible = Boolean(
    selectedPackage?.product?.introPrice ||
      selectedPackage?.product?.discounts?.length,
  );

  const onPurchase = async () => {
    if (!selectedPackage) {
      Alert.alert(
        'Plans not loaded',
        configurable
          ? 'Try again in a moment.'
          : 'Purchases are only available in a development or production build, not in Expo Go.',
      );
      return;
    }
    const result = await purchase(selectedPackage);
    if (result.success) {
      router.dismiss();
    } else if (!result.userCanceled && result.error) {
      Alert.alert('Purchase failed', result.error);
    }
  };

  const onRestore = async () => {
    const result = await restore();
    if (result.success) {
      Alert.alert('Restored', 'Welcome back to Pro!');
      router.dismiss();
    } else if (result.error) {
      Alert.alert('Nothing to restore', result.error);
    } else {
      Alert.alert('Nothing to restore', 'No active subscription found on this Apple ID.');
    }
  };

  const priceFor = (pkg: PurchasesPackage | null, fallback: string) =>
    pkg?.product?.priceString ?? fallback;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.dismiss()} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.brand}>
          <Text style={styles.logo}>♠</Text>
          <Text style={styles.title}>Bankrolly Pro</Text>
          <Text style={styles.subtitle}>Track unlimited — every session, every venue, every trip</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <PlanCard
          label="Yearly"
          price={priceFor(yearly, '€99.99')}
          per="/ year"
          badge="SAVE 36%"
          subtext={
            yearly?.product?.pricePerMonthString
              ? `${yearly.product.pricePerMonthString} / month`
              : '≈ €8.33 / month'
          }
          selected={selected === 'annual'}
          onPress={() => setSelected('annual')}
        />
        <PlanCard
          label="Monthly"
          price={priceFor(monthly, '€12.99')}
          per="/ month"
          subtext={trialEligible ? '14-day free trial' : 'Billed monthly'}
          selected={selected === 'monthly'}
          onPress={() => setSelected('monthly')}
        />

        <PrimaryButton
          label={trialEligible ? 'Start 14-day free trial' : 'Subscribe'}
          onPress={onPurchase}
          loading={loading}
          disabled={!selectedPackage}
        />

        <Pressable onPress={onRestore} style={styles.restoreBtn} disabled={loading}>
          <Text style={styles.restoreLabel}>Restore purchases</Text>
        </Pressable>

        <Pressable onPress={() => setShowDebug((s) => !s)} style={styles.debugToggle}>
          <Text style={styles.debugToggleLabel}>{showDebug ? 'Hide debug' : 'Debug info'}</Text>
        </Pressable>

        {showDebug ? (
          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>Subscription debug</Text>
            <Text style={styles.debugRow}>SDK configurable: {String(configurable)}</Text>
            <Text style={styles.debugRow}>Offering loaded: {offering ? 'yes' : 'NO'}</Text>
            <Text style={styles.debugRow}>Offering id: {offering?.identifier ?? '—'}</Text>
            <Text style={styles.debugRow}>Monthly package: {monthly ? 'yes' : 'NO'}</Text>
            <Text style={styles.debugRow}>Annual package: {yearly ? 'yes' : 'NO'}</Text>
            <Text style={styles.debugRow}>Monthly product: {monthly?.product?.identifier ?? '—'}</Text>
            <Text style={styles.debugRow}>Annual product: {yearly?.product?.identifier ?? '—'}</Text>
            <Text style={styles.debugRow}>Is Pro: {String(isPro)}</Text>
            {lastError ? (
              <Text style={[styles.debugRow, { color: colors.loss }]}>Error: {lastError}</Text>
            ) : null}
            <Pressable onPress={refresh} style={styles.refreshBtn}>
              <Text style={styles.refreshLabel}>Refresh from RevenueCat</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.footnote}>
          Auto-renews until cancelled. Cancel anytime in your Apple ID subscription settings.
          {' '}You'll be charged through your Apple ID. By continuing you agree to our{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(TOS_URL)}>Terms</Text>
          {' '}and{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface PlanCardProps {
  label: string;
  price: string;
  per: string;
  subtext: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}

function PlanCard({ label, price, per, subtext, badge, selected, onPress }: PlanCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.planCard,
        selected && styles.planCardSelected,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.planLeft}>
        <View style={styles.radio}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
        <View>
          <View style={styles.planLabelRow}>
            <Text style={styles.planLabel}>{label}</Text>
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.planSub}>{subtext}</Text>
        </View>
      </View>
      <View style={styles.planRight}>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planPer}>{per}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  close: {
    color: colors.textMuted,
    fontSize: 24,
    paddingHorizontal: spacing.sm,
  },
  brand: {
    alignItems: 'center',
    gap: 6,
    marginVertical: spacing.md,
  },
  logo: {
    fontSize: 48,
    color: colors.profit,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  features: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  check: {
    color: colors.profit,
    fontSize: typography.heading,
    fontWeight: '800',
    width: 18,
  },
  featureText: {
    color: colors.text,
    fontSize: typography.body,
    flex: 1,
  },
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  planCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.profit,
  },
  planLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planLabel: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: colors.profit,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    color: '#0b0f0d',
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planSub: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  planRight: {
    alignItems: 'flex-end',
  },
  planPrice: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  planPer: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  restoreLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  footnote: {
    color: colors.textDim,
    fontSize: typography.micro,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  link: {
    color: colors.profit,
    textDecorationLine: 'underline',
  },
  debugToggle: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  debugToggleLabel: {
    color: colors.textDim,
    fontSize: typography.micro,
    textDecorationLine: 'underline',
  },
  debugBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
    marginTop: spacing.sm,
  },
  debugTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: typography.small,
    marginBottom: 4,
  },
  debugRow: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontFamily: 'monospace',
  },
  refreshBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.borderStrong,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  refreshLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
});
