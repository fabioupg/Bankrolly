import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionTitle } from '@/components/SectionTitle';
import { StackChart } from '@/components/StackChart';
import { useLiveSessionStore } from '@/store/useLiveSessionStore';
import { useHandStore } from '@/store/useHandStore';
import { useSettingsStore } from '@/store/useStatsStore';
import {
  activeElapsedMs,
  formatClock,
  formatDuration,
  liveProfit,
  parseLiveNotes,
  parseStackHistory,
} from '@/utils/liveSession';
import { persistNotePhoto } from '@/utils/photos';
import { formatMoney, formatPnL } from '@/utils/formatters';
import { colors, pnlColor, radius, spacing, typography } from '@/theme/colors';

export default function LiveSessionScreen() {
  const active = useLiveSessionStore((s) => s.active);
  const updateStack = useLiveSessionStore((s) => s.updateStack);
  const addBuyIn = useLiveSessionStore((s) => s.addBuyIn);
  const addNote = useLiveSessionStore((s) => s.addNote);
  const removeNote = useLiveSessionStore((s) => s.removeNote);
  const pause = useLiveSessionStore((s) => s.pause);
  const resume = useLiveSessionStore((s) => s.resume);
  const end = useLiveSessionStore((s) => s.end);
  const discard = useLiveSessionStore((s) => s.discard);
  const currency = useSettingsStore((s) => s.currency);
  const hands = useHandStore((s) => s.hands);

  const [stackInput, setStackInput] = useState('');
  const [rebuyInput, setRebuyInput] = useState('');
  const [noteText, setNoteText] = useState('');
  const [notePhoto, setNotePhoto] = useState('');
  const [busy, setBusy] = useState(false);
  // Re-render every second so the duration ticks while the screen is open.
  const [, setTick] = useState(0);

  const running = active?.status === 'running';
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const points = useMemo(() => parseStackHistory(active?.stackHistory), [active?.stackHistory]);
  const notes = useMemo(() => parseLiveNotes(active?.notes), [active?.notes]);
  const linkedHands = useMemo(
    () => (active ? hands.filter((h) => h.sessionId === active.id) : []),
    [hands, active],
  );

  if (!active) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <Stack.Screen options={{ title: 'Live session' }} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No live session running</Text>
          <Text style={styles.emptySub}>Start one to track your stack, hands and notes.</Text>
          <PrimaryButton label="▶ Start live session" onPress={() => router.replace('/live/new')} />
        </View>
      </SafeAreaView>
    );
  }

  const profit = liveProfit(active);
  const elapsed = activeElapsedMs(active);

  const onUpdateStack = async () => {
    const value = Number(stackInput);
    if (!Number.isFinite(value) || value < 0) {
      Alert.alert('Invalid stack', 'Enter your current chip count.');
      return;
    }
    setBusy(true);
    try {
      await updateStack(value);
      setStackInput('');
    } finally {
      setBusy(false);
    }
  };

  const onRebuy = async () => {
    const value = Number(rebuyInput);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid re-buy', 'Enter the amount you are adding.');
      return;
    }
    setBusy(true);
    try {
      await addBuyIn(value);
      setRebuyInput('');
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        fromCamera
          ? 'Allow camera access to attach a photo.'
          : 'Allow photo access to attach a photo.',
      );
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled || !result.assets?.length) return;
    try {
      // Picker/camera URIs live in a cache iOS can purge — keep our own copy.
      setNotePhoto(await persistNotePhoto(result.assets[0].uri));
    } catch (e) {
      Alert.alert('Could not attach photo', (e as Error).message);
    }
  };

  const onAddNote = async () => {
    if (!noteText.trim() && !notePhoto) {
      Alert.alert('Empty note', 'Write something or attach a photo.');
      return;
    }
    setBusy(true);
    try {
      await addNote(noteText, notePhoto);
      setNoteText('');
      setNotePhoto('');
    } finally {
      setBusy(false);
    }
  };

  const onEnd = () => {
    Alert.alert(
      'End session?',
      `Cash out at ${formatMoney(active.currentStack, currency)} — this saves it as a cash session (${formatDuration(elapsed)} played).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End & save',
          onPress: async () => {
            setBusy(true);
            try {
              await end();
              router.replace('/(tabs)/sessions');
            } catch (e) {
              Alert.alert('Could not end session', (e as Error).message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onDiscard = () => {
    Alert.alert('Discard session?', 'The session is deleted and nothing is logged.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await discard();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: active.venue || 'Live session' }} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={[styles.hero, active.status === 'paused' && styles.heroPaused]}>
          <View style={styles.heroTop}>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: running ? colors.profit : colors.warn }]} />
              <Text style={styles.statusText}>{running ? 'LIVE' : 'PAUSED'}</Text>
            </View>
            <Text style={styles.duration}>{formatDuration(elapsed)}</Text>
          </View>

          <Text style={[styles.profit, { color: pnlColor(profit) }]}>
            {formatPnL(profit, currency)}
          </Text>

          <View style={styles.heroStats}>
            <Stat label="Buy-in" value={formatMoney(active.buyIn, currency)} />
            <Stat label="Stack" value={formatMoney(active.currentStack, currency)} />
            <Stat
              label="Game"
              value={active.stakes ? `${active.stakes} ${active.gameType}` : active.gameType}
            />
          </View>
        </View>

        <View style={styles.controls}>
          <PrimaryButton
            label={running ? '⏸ Pause' : '▶ Resume'}
            variant="ghost"
            onPress={() => (running ? pause() : resume())}
            style={styles.controlBtn}
          />
          <PrimaryButton label="■ End session" onPress={onEnd} style={styles.controlBtn} />
        </View>

        <View style={styles.card}>
          <SectionTitle title="Current stack" />
          <View style={styles.inlineRow}>
            <View style={styles.grow}>
              <FormField
                label="Count your chips"
                placeholder={String(active.currentStack)}
                keyboardType="decimal-pad"
                value={stackInput}
                onChangeText={setStackInput}
              />
            </View>
            <PrimaryButton label="Update" onPress={onUpdateStack} style={styles.inlineBtn} />
          </View>

          <View style={styles.inlineRow}>
            <View style={styles.grow}>
              <FormField
                label="Re-buy / top-up"
                placeholder="200"
                keyboardType="decimal-pad"
                value={rebuyInput}
                onChangeText={setRebuyInput}
                hint="Adds to both your buy-in and your stack."
              />
            </View>
            <PrimaryButton label="Add" variant="ghost" onPress={onRebuy} style={styles.inlineBtn} />
          </View>
        </View>

        <View style={styles.card}>
          <SectionTitle title="Stack over time" />
          <StackChart points={points} buyIn={active.buyIn} currency={currency} />
        </View>

        <View style={styles.card}>
          <SectionTitle title="Hands" />
          <Text style={styles.hint}>
            {linkedHands.length === 0
              ? 'No hands logged in this session yet.'
              : `${linkedHands.length} hand${linkedHands.length === 1 ? '' : 's'} logged.`}
          </Text>
          <PrimaryButton
            label="+ Log a hand"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: '/hand/new',
                params: { sessionId: active.id, sessionType: 'cash' },
              })
            }
          />
          {linkedHands.length > 0 ? (
            <PrimaryButton label="View hands" variant="ghost" onPress={() => router.push('/hand')} />
          ) : null}
        </View>

        <View style={styles.card}>
          <SectionTitle title="Notes" />
          <FormField
            label="New note"
            placeholder="Table is loud, seat 4 is spewing..."
            value={noteText}
            onChangeText={setNoteText}
            multiline
            style={styles.multi}
          />
          {notePhoto ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: notePhoto }} style={styles.photoThumb} />
              <Pressable onPress={() => setNotePhoto('')} hitSlop={8}>
                <Text style={styles.removePhoto}>Remove photo</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.photoRow}>
            <PrimaryButton
              label="📷 Camera"
              variant="ghost"
              onPress={() => pickPhoto(true)}
              style={styles.controlBtn}
            />
            <PrimaryButton
              label="🖼 Library"
              variant="ghost"
              onPress={() => pickPhoto(false)}
              style={styles.controlBtn}
            />
          </View>
          <PrimaryButton label="Add note" onPress={onAddNote} />

          {notes.length > 0 ? (
            <View style={styles.noteList}>
              {[...notes]
                .sort((a, b) => b.t - a.t)
                .map((n) => (
                  <View key={n.t} style={styles.note}>
                    <View style={styles.noteHeader}>
                      <Text style={styles.noteTime}>{formatClock(n.t)}</Text>
                      <Pressable onPress={() => removeNote(n.t)} hitSlop={8}>
                        <Text style={styles.noteDelete}>Delete</Text>
                      </Pressable>
                    </View>
                    {n.text ? <Text style={styles.noteText}>{n.text}</Text> : null}
                    {n.photo ? <Image source={{ uri: n.photo }} style={styles.notePhoto} /> : null}
                  </View>
                ))}
            </View>
          ) : null}
        </View>

        <PrimaryButton label="Discard session" variant="danger" onPress={onDiscard} />
        {busy ? <ActivityIndicator color={colors.profit} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: { color: colors.text, fontSize: typography.heading, fontWeight: '700' },
  emptySub: { color: colors.textMuted, fontSize: typography.small, textAlign: 'center' },
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.profit,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroPaused: { borderColor: colors.warn },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 1,
  },
  duration: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  profit: { fontSize: typography.display, fontWeight: '800' },
  heroStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  stat: { flex: 1 },
  statLabel: {
    color: colors.textDim,
    fontSize: typography.micro,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  statValue: { color: colors.text, fontSize: typography.small, fontWeight: '700', marginTop: 2 },
  controls: { flexDirection: 'row', gap: spacing.sm },
  controlBtn: { flex: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  inlineRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  grow: { flex: 1 },
  inlineBtn: { paddingHorizontal: spacing.lg, minWidth: 96 },
  multi: { minHeight: 72, textAlignVertical: 'top', paddingTop: spacing.sm },
  photoRow: { flexDirection: 'row', gap: spacing.sm },
  photoPreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoThumb: { width: 64, height: 64, borderRadius: radius.md },
  removePhoto: { color: colors.loss, fontSize: typography.small, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: typography.small },
  noteList: { gap: spacing.sm },
  note: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteTime: {
    color: colors.textDim,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  noteDelete: { color: colors.loss, fontSize: typography.micro, fontWeight: '700' },
  noteText: { color: colors.text, fontSize: typography.small, lineHeight: 19 },
  notePhoto: { width: '100%', height: 180, borderRadius: radius.md, marginTop: spacing.xs },
});
