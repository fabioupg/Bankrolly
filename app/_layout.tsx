import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { initDatabase } from '@/db';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useHandStore } from '@/store/useHandStore';
import { colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        initDatabase();
        await Promise.all([
          useSessionStore.getState().hydrate(),
          useTournamentStore.getState().hydrate(),
          useHandStore.getState().hydrate(),
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

  if (bootError) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.error}>Database error</Text>
        <Text style={styles.errorBody}>{bootError}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.fallback}>
        <ActivityIndicator color={colors.profit} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
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
            name="quick-add"
            options={{
              presentation: 'modal',
              title: 'New entry',
            }}
          />
          <Stack.Screen name="cash/new" options={{ title: 'New cash session' }} />
          <Stack.Screen name="cash/[id]" options={{ title: 'Cash session' }} />
          <Stack.Screen name="tournament/new" options={{ title: 'New tournament' }} />
          <Stack.Screen name="tournament/[id]" options={{ title: 'Tournament' }} />
          <Stack.Screen name="hand/new" options={{ title: 'New hand note' }} />
          <Stack.Screen name="hand/index" options={{ title: 'Hand history' }} />
        </Stack>
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
    gap: 8,
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
});
