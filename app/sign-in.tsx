import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOAuth, useSignIn } from '@clerk/clerk-expo';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';
import { colors, radius, spacing, typography } from '@/theme/colors';

type OAuthStrategy = 'oauth_apple' | 'oauth_google' | 'oauth_discord' | 'oauth_github';

export default function SignInScreen() {
  useWarmUpBrowser();
  const { signIn, setActive, isLoaded } = useSignIn();

  const apple = useOAuth({ strategy: 'oauth_apple' });
  const google = useOAuth({ strategy: 'oauth_google' });
  const discord = useOAuth({ strategy: 'oauth_discord' });
  const github = useOAuth({ strategy: 'oauth_github' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOAuth = async (strategy: OAuthStrategy) => {
    const flow =
      strategy === 'oauth_apple' ? apple
      : strategy === 'oauth_google' ? google
      : strategy === 'oauth_discord' ? discord
      : github;
    try {
      const { createdSessionId, setActive: setActiveOAuth } = await flow.startOAuthFlow({
        redirectUrl: Linking.createURL('/'),
      });
      if (createdSessionId && setActiveOAuth) {
        await setActiveOAuth({ session: createdSessionId });
        router.replace('/');
      }
    } catch (err) {
      Alert.alert('Sign in failed', (err as Error).message);
    }
  };

  const handleEmail = async () => {
    if (!isLoaded) return;
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/');
        return;
      }
      if (attempt.status === 'needs_first_factor') {
        Alert.alert(
          'Check your email',
          'Your account has email-code sign-in enabled. Use the email link/code instead of the password, or contact support.',
        );
        return;
      }
      if (attempt.status === 'needs_second_factor') {
        Alert.alert(
          'Two-step verification active',
          'This account requires 2FA. Disable it in your account security settings, or contact support.',
        );
        return;
      }
      if (attempt.status === 'needs_new_password') {
        Alert.alert(
          'Password reset required',
          'Your password must be reset before signing in. Use "Forgot password" or contact support.',
        );
        return;
      }
      Alert.alert(
        'Sign in incomplete',
        `Status: ${attempt.status}. Please try again or contact support at bankrolly@fabulousio.com`,
      );
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
        (err as Error).message ??
        'Sign in failed';
      Alert.alert('Sign in failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.brand}>
          <Text style={styles.logo}>♠</Text>
          <Text style={styles.title}>Bankrolly</Text>
          <Text style={styles.subtitle}>Sign in to track your bankroll</Text>
        </View>

        <View style={styles.providers}>
          {Platform.OS === 'ios' ? (
            <ProviderButton
              label="Continue with Apple"
              glyph=""
              tone="#000"
              fg="#fff"
              onPress={() => handleOAuth('oauth_apple')}
            />
          ) : null}
          <ProviderButton
            label="Continue with Google"
            glyph="G"
            tone="#fff"
            fg="#1f1f1f"
            onPress={() => handleOAuth('oauth_google')}
          />
          <ProviderButton
            label="Continue with Discord"
            glyph="D"
            tone="#5865f2"
            fg="#fff"
            onPress={() => handleOAuth('oauth_discord')}
          />
          <ProviderButton
            label="Continue with GitHub"
            glyph="G"
            tone="#24292f"
            fg="#fff"
            onPress={() => handleOAuth('oauth_github')}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or with email</Text>
          <View style={styles.dividerLine} />
        </View>

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
          placeholder="••••••••"
          autoCapitalize="none"
          autoComplete="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <PrimaryButton label="Sign in" onPress={handleEmail} loading={submitting} />

        <View style={styles.bottom}>
          <Text style={styles.bottomText}>No account yet?</Text>
          <Link href="/sign-up" asChild>
            <Pressable>
              <Text style={styles.link}>Create one</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

interface PBProps {
  label: string;
  glyph: string;
  tone: string;
  fg: string;
  onPress: () => void;
}

function ProviderButton({ label, glyph, tone, fg, onPress }: PBProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.provider,
        { backgroundColor: tone },
        pressed && { opacity: 0.85 },
      ]}
    >
      {glyph ? (
        <View style={styles.providerGlyphBox}>
          <Text style={[styles.providerGlyph, { color: fg }]}>{glyph}</Text>
        </View>
      ) : (
        <Text style={[styles.appleGlyph, { color: fg }]}></Text>
      )}
      <Text style={[styles.providerLabel, { color: fg }]}>{label}</Text>
    </Pressable>
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
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  providers: {
    gap: spacing.sm,
  },
  provider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  providerGlyphBox: {
    width: 22,
    alignItems: 'center',
  },
  providerGlyph: {
    fontWeight: '900',
    fontSize: 18,
  },
  appleGlyph: {
    fontSize: 22,
    marginRight: 4,
  },
  providerLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
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
});
