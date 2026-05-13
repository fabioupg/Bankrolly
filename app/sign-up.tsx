import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSignUp } from '@clerk/clerk-expo';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, spacing, typography } from '@/theme/colors';

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'form' | 'verify'>('form');
  const [submitting, setSubmitting] = useState(false);

  const submitEmail = async () => {
    if (!isLoaded) return;
    if (!email.trim() || password.length < 8) {
      Alert.alert('Check the form', 'Email and a password (≥ 8 chars) are required.');
      return;
    }
    setSubmitting(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStage('verify');
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
        (err as Error).message ??
        'Sign up failed';
      Alert.alert('Sign up failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async () => {
    if (!isLoaded) return;
    if (code.trim().length < 4) {
      Alert.alert('Code missing', 'Enter the 6-digit code from your email.');
      return;
    }
    setSubmitting(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/');
      } else {
        Alert.alert('Verification incomplete', 'Try again with a fresh code.');
      }
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
        (err as Error).message ??
        'Verification failed';
      Alert.alert('Verification failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.brand}>
          <Text style={styles.logo}>♣</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            {stage === 'form' ? 'Use email or pick a provider on the sign-in screen' : 'Check your inbox for the code'}
          </Text>
        </View>

        {stage === 'form' ? (
          <>
            <FormField
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <FormField
              label="Password"
              placeholder="At least 8 characters"
              autoCapitalize="none"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <PrimaryButton
              label="Send verification code"
              onPress={submitEmail}
              loading={submitting}
            />
          </>
        ) : (
          <>
            <FormField
              label="Verification code"
              placeholder="123456"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              maxLength={6}
            />
            <PrimaryButton
              label="Verify and sign in"
              onPress={submitCode}
              loading={submitting}
            />
            <Pressable onPress={() => setStage('form')} style={styles.backBtn}>
              <Text style={styles.backLabel}>← Back to email</Text>
            </Pressable>
          </>
        )}

        <View style={styles.bottom}>
          <Text style={styles.bottomText}>Already have an account?</Text>
          <Link href="/sign-in" asChild>
            <Pressable>
              <Text style={styles.link}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: 6,
  },
  logo: {
    fontSize: 44,
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
  bottom: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  bottomText: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  link: {
    color: colors.profit,
    fontSize: typography.small,
    fontWeight: '700',
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  backLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
});
