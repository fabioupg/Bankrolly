import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackBody?: string;
  minHeight?: number;
}

export function ProGate({
  children,
  fallbackTitle = 'Pro feature',
  fallbackBody = 'Upgrade to unlock this section.',
  minHeight = 200,
}: Props) {
  const isPro = useSubscriptionStore((s) => s.isPro);
  if (isPro) return <>{children}</>;

  return (
    <View style={[styles.wrap, { minHeight }]}>
      <View style={styles.dim} pointerEvents="none">
        {children}
      </View>
      <View style={styles.overlay}>
        <Text style={styles.lock}>🔒</Text>
        <Text style={styles.title}>{fallbackTitle}</Text>
        <Text style={styles.body}>{fallbackBody}</Text>
        <Pressable
          onPress={() => router.push('/paywall')}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaLabel}>Unlock with Pro</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  dim: {
    opacity: 0.18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  lock: {
    fontSize: 30,
    marginBottom: 2,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.small,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cta: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  ctaLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.small,
    letterSpacing: 0.3,
  },
});
