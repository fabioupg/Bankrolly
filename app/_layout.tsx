import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { CLERK_PUBLISHABLE_KEY, tokenCache } from '@/lib/clerk';
import { initDatabase } from '@/db';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useHandStore } from '@/store/useHandStore';
import { useOnlineSessionStore } from '@/store/useOnlineSessionStore';
import { useLiveSessionStore } from '@/store/useLiveSessionStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useTripStore } from '@/store/useTripStore';
import { useTransactionStore } from '@/store/useTransactionStore';
import { useStakingStore } from '@/store/useStakingStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});
WebBrowser.maybeCompleteAuthSession();

function LoadingScreen({ label, hint, slow }: { label: string; hint?: string; slow?: boolean }) {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator color={colors.profit} size="large" />
      <Text style={styles.loadingLabel}>{label}</Text>
      {hint ? <Text style={styles.loadingHint}>{hint}</Text> : null}
      {slow ? (
        <Text style={styles.slowHint}>
          Taking longer than expected. Check your network connection.
        </Text>
      ) : null}
    </View>
  );
}

function useSlowFlag(active: boolean, delayMs = 8000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);
  return slow;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const slow = useSlowFlag(!isLoaded);

  useEffect(() => {
    if (!isLoaded) return;
    const first = segments[0];
    const inAuthFlow = first === 'sign-in' || first === 'sign-up';
    if (!isSignedIn && !inAuthFlow) {
      router.replace('/sign-in');
    } else if (isSignedIn && inAuthFlow) {
      router.replace('/');
    }
  }, [isLoaded, isSignedIn, segments, router]);

  useEffect(() => {
    if (!isLoaded) return;
    usePlayerStore.getState().setOwner(userId ?? '');
    useTripStore.getState().setOwner(userId ?? '');
    useStakingStore.getState().setOwner(userId ?? '');
    const sub = useSubscriptionStore.getState();
    if (!sub.ready) {
      sub.init(userId ?? null).finally(() => SplashScreen.hideAsync().catch(() => {}));
    } else {
      sub.identify(userId ?? null);
    }
  }, [isLoaded, userId]);

  if (!isLoaded) {
    return (
      <LoadingScreen
        label="Connecting…"
        hint="Authenticating with Clerk"
        slow={slow}
      />
    );
  }
  return <>{children}</>;
}

function DataBoot({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const slow = useSlowFlag(!ready && !bootError);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        initDatabase();
        await Promise.all([
          useSessionStore.getState().hydrate(),
          useTournamentStore.getState().hydrate(),
          useHandStore.getState().hydrate(),
          useOnlineSessionStore.getState().hydrate(),
          useLiveSessionStore.getState().hydrate(),
          useTransactionStore.getState().hydrate(),
        ]);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setBootError((err as Error).message);
      } finally {
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setBootError(null);
    setReady(false);
    setTimeout(() => {
      try {
        initDatabase();
        Promise.all([
          useSessionStore.getState().hydrate(),
          useTournamentStore.getState().hydrate(),
          useHandStore.getState().hydrate(),
          useOnlineSessionStore.getState().hydrate(),
          useLiveSessionStore.getState().hydrate(),
          useTransactionStore.getState().hydrate(),
        ])
          .then(() => setReady(true))
          .catch((err) => setBootError((err as Error).message));
      } catch (err) {
        setBootError((err as Error).message);
      }
    }, 100);
  };

  if (bootError) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.error}>Database error</Text>
        <Text style={styles.errorBody}>{bootError}</Text>
        <Pressable onPress={retry} style={styles.retryBtn}>
          <Text style={styles.retryLabel}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (!ready) {
    return (
      <LoadingScreen
        label="Loading your data…"
        hint="Reading local database"
        slow={slow}
      />
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    const id = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 200);
    return () => clearTimeout(id);
  }, []);

  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.error}>Missing Clerk key</Text>
        <Text style={styles.errorBody}>
          EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is empty in this build. The build was made without the
          environment variable. Add it to EAS secrets for the production environment and rebuild.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
          <ClerkLoaded>
            <AuthGate>
              <DataBoot>
                <Stack
                  screenOptions={{
                    headerStyle: { backgroundColor: colors.bgElevated },
                    headerTitleStyle: { color: colors.text, fontWeight: '700' },
                    headerTintColor: colors.profit,
                    contentStyle: { backgroundColor: colors.bg },
                  }}
                >
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="sign-in"
                    options={{ headerShown: false, animation: 'fade' }}
                  />
                  <Stack.Screen
                    name="sign-up"
                    options={{ headerShown: false, animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="quick-add"
                    options={{ presentation: 'modal', title: 'New entry' }}
                  />
                  <Stack.Screen
                    name="paywall"
                    options={{ presentation: 'modal', headerShown: false }}
                  />
                  <Stack.Screen name="cash/new" options={{ title: 'New cash session' }} />
                  <Stack.Screen name="cash/[id]" options={{ title: 'Cash session' }} />
                  <Stack.Screen name="tournament/new" options={{ title: 'New tournament' }} />
                  <Stack.Screen name="tournament/[id]" options={{ title: 'Tournament' }} />
                  <Stack.Screen name="live/index" options={{ title: 'Live session' }} />
                  <Stack.Screen name="live/new" options={{ title: 'Start live session' }} />
                  <Stack.Screen name="online/new" options={{ title: 'New online session' }} />
                  <Stack.Screen name="online/[id]" options={{ title: 'Online session' }} />
                  <Stack.Screen name="import" options={{ title: 'Import from another app' }} />
                  <Stack.Screen name="staking/index" options={{ title: 'Staking' }} />
                  <Stack.Screen name="staking/new" options={{ title: 'New staking deal' }} />
                  <Stack.Screen name="staking/[id]" options={{ title: 'Staking deal' }} />
                  <Stack.Screen name="transactions/index" options={{ title: 'Transactions' }} />
                  <Stack.Screen name="transactions/new" options={{ title: 'New transaction' }} />
                  <Stack.Screen name="transactions/[id]" options={{ title: 'Transaction' }} />
                  <Stack.Screen name="hand/new" options={{ title: 'New hand note' }} />
                  <Stack.Screen name="hand/index" options={{ title: 'Hand history' }} />
                  <Stack.Screen name="hand/replay" options={{ title: 'Hand replay' }} />
                  <Stack.Screen name="tools/calculator" options={{ title: 'Equity Calculator' }} />
                  <Stack.Screen name="players/index" options={{ title: 'Player notes' }} />
                  <Stack.Screen name="players/new" options={{ title: 'New player' }} />
                  <Stack.Screen name="players/[id]" options={{ title: 'Player' }} />
                  <Stack.Screen name="trips/index" options={{ title: 'Trips' }} />
                  <Stack.Screen name="trips/new" options={{ title: 'New trip' }} />
                  <Stack.Screen name="trips/[id]" options={{ title: 'Trip' }} />
                </Stack>
              </DataBoot>
            </AuthGate>
          </ClerkLoaded>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  error: {
    color: colors.loss,
    fontWeight: '700',
    fontSize: 18,
  },
  errorBody: {
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    marginTop: 8,
  },
  loadingHint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  slowHint: {
    color: colors.warn,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  retryLabel: {
    color: '#fff',
    fontWeight: '700',
  },
});
