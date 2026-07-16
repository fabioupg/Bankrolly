import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { promptUpgrade } from '@/components/UpgradePrompt';
import { useCanAdd } from '@/hooks/useCanAdd';
import { useLiveSessionStore } from '@/store/useLiveSessionStore';
import { isLiveActivitySupported } from '@/lib/liveActivity';
import { GAME_TYPES, STAKES_PRESETS } from '@/db/schema';
import { colors, spacing, typography } from '@/theme/colors';

/**
 * Start screen for a live session: just enough to get the player seated
 * (venue, stakes, game, buy-in). Everything else is captured while playing.
 */
export default function NewLiveSession() {
  const [venue, setVenue] = useState('');
  const [stakes, setStakes] = useState('');
  const [gameType, setGameType] = useState<string>('NLH');
  const [buyIn, setBuyIn] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const start = useLiveSessionStore((s) => s.start);
  const active = useLiveSessionStore((s) => s.active);
  // A live session becomes a cash session when it ends, so it is gated by the
  // same free-plan limit.
  const limit = useCanAdd('cash');

  const onStart = async () => {
    if (active) {
      router.replace('/live');
      return;
    }
    const amount = Number(buyIn);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Buy-in required', 'Enter the amount you are sitting down with.');
      return;
    }
    if (!limit.canAdd) {
      promptUpgrade('cash', limit.current, limit.limit);
      return;
    }
    setSubmitting(true);
    try {
      await start({
        venue: venue.trim(),
        stakes: stakes.trim(),
        gameType,
        buyIn: amount,
      });
      router.replace('/live');
    } catch (e) {
      Alert.alert('Could not start', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: 'Start live session' }} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.intro}>
          Track the session while you play: update your stack, log hands and notes, and see it all
          on your lock screen.
        </Text>

        <FormField
          label="Venue"
          placeholder="Casino, club or home game"
          value={venue}
          onChangeText={setVenue}
        />

        <View>
          <Text style={styles.fieldLabel}>Stakes</Text>
          <View style={styles.chips}>
            {STAKES_PRESETS.map((s) => (
              <Chip
                key={s}
                label={s}
                tone="accent"
                active={stakes === s}
                onPress={() => setStakes(s)}
              />
            ))}
          </View>
        </View>
        <FormField
          label="Custom stakes"
          placeholder="e.g. 1/3"
          value={stakes}
          onChangeText={setStakes}
        />

        <View>
          <Text style={styles.fieldLabel}>Game</Text>
          <View style={styles.chips}>
            {GAME_TYPES.map((g) => (
              <Chip
                key={g}
                label={g}
                tone="accent"
                active={gameType === g}
                onPress={() => setGameType(g)}
              />
            ))}
          </View>
        </View>

        <FormField
          label="Buy-in"
          placeholder="500"
          keyboardType="decimal-pad"
          value={buyIn}
          onChangeText={setBuyIn}
          hint="Your starting stack. Re-buys can be added during the session."
        />

        <PrimaryButton
          label={active ? 'Open running session' : '▶ Start session'}
          onPress={onStart}
          loading={submitting}
        />
        {!isLiveActivitySupported() ? (
          <Text style={styles.hint}>
            Lock-screen stats need iOS 16.2 or newer — the session still tracks normally here.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
    marginBottom: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: {
    color: colors.textDim,
    fontSize: typography.micro,
    textAlign: 'center',
  },
});
