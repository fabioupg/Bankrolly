import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PokerTable } from '@/components/PokerTable';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TAG_LABELS } from '@/components/HandNoteCard';
import { useHandStore } from '@/store/useHandStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { buildReplaySteps, parseTableState, stateAtStep } from '@/utils/replay';
import { parseCards } from '@/utils/cards';
import type { HandTag } from '@/db/schema';
import { colors, radius, spacing, typography, pnlColor } from '@/theme/colors';
import { formatPnL } from '@/utils/formatters';

const AUTOPLAY_MS = 1400;

export default function HandReplayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hand = useHandStore((s) => s.hands.find((h) => h.id === id));
  const currency = useSettingsStore((s) => s.currency);

  const tableState = useMemo(
    () => (hand ? parseTableState(hand.tableState) : null),
    [hand],
  );
  const steps = useMemo(
    () => (tableState && hand ? buildReplaySteps(tableState, hand.board, hand.actionLine) : []),
    [tableState, hand],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const atEnd = stepIndex >= steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setStepIndex((i) => (i >= steps.length - 1 ? i : i + 1));
    }, AUTOPLAY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, steps.length]);

  useEffect(() => {
    if (playing && atEnd) setPlaying(false);
  }, [playing, atEnd]);

  if (!hand) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Hand not found</Text>
          <PrimaryButton label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tableState || steps.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No table data for this hand</Text>
          <Text style={styles.emptyBody}>
            This hand was saved without the visual table. Open it in the editor and place the
            action on the table to make it replayable.
          </Text>
          <PrimaryButton
            label="Open in editor"
            onPress={() => router.replace({ pathname: '/hand/new', params: { id: hand.id } })}
          />
        </View>
      </SafeAreaView>
    );
  }

  // steps can shrink while this screen stays mounted (hand edited underneath),
  // so never trust stepIndex to still be in range.
  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index];
  const displayState = stateAtStep(tableState, step);
  const visibleBoard = parseCards(hand.board).slice(0, step.boardCount).join(' ');
  const tag = (hand.tag as HandTag) ?? 'review';

  const jump = (i: number) => {
    setPlaying(false);
    setStepIndex(Math.max(0, Math.min(steps.length - 1, i)));
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.metaTag}>{TAG_LABELS[tag]}</Text>
          <Text style={styles.metaStreet}>{step.street.toUpperCase()}</Text>
          <Text style={[styles.metaResult, { color: pnlColor(hand.result) }]}>
            {formatPnL(hand.result, currency)}
          </Text>
        </View>

        <PokerTable
          state={displayState}
          heroCards={hand.heroCards}
          board={visibleBoard}
          dimmedSeats={step.folded}
          activeSeat={step.actorSeat}
        />

        <View style={styles.stepCard}>
          <Text style={styles.stepCounter}>
            Step {index + 1} / {steps.length}
          </Text>
          <Text style={styles.stepLabel}>{step.label}</Text>
        </View>

        <View style={styles.controls}>
          <ControlButton label="⏮" onPress={() => jump(0)} disabled={index === 0} />
          <ControlButton label="◀" onPress={() => jump(index - 1)} disabled={index === 0} />
          <Pressable
            onPress={() => {
              if (atEnd) {
                setStepIndex(0);
                setPlaying(true);
              } else {
                setPlaying((p) => !p);
              }
            }}
            style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.playLabel}>{playing ? '❚❚' : atEnd ? '↻' : '▶'}</Text>
          </Pressable>
          <ControlButton label="▶" onPress={() => jump(index + 1)} disabled={atEnd} />
          <ControlButton label="⏭" onPress={() => jump(steps.length - 1)} disabled={atEnd} />
        </View>

        <View style={styles.log}>
          {steps.map((s, i) => (
            <Pressable
              key={i}
              onPress={() => jump(i)}
              style={[styles.logRow, i === index && styles.logRowActive]}
            >
              <Text
                style={[
                  s.kind === 'action' ? styles.logAction : styles.logMarker,
                  i === index && styles.logTextActive,
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {hand.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesBody}>{hand.notes}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label="Edit hand"
          variant="ghost"
          onPress={() => router.push({ pathname: '/hand/new', params: { id: hand.id } })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ControlButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ctrlBtn,
        disabled && { opacity: 0.35 },
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      <Text style={styles.ctrlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaTag: {
    color: colors.text,
    fontWeight: '700',
    fontSize: typography.body,
  },
  metaStreet: {
    color: colors.textDim,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    flex: 1,
  },
  metaResult: {
    fontWeight: '700',
    fontSize: typography.body,
  },
  stepCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
    alignItems: 'center',
  },
  stepCounter: {
    color: colors.textDim,
    fontSize: typography.micro,
  },
  stepLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlLabel: {
    color: colors.text,
    fontSize: 18,
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playLabel: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  log: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  logRow: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  logRowActive: {
    backgroundColor: colors.accentSoft,
  },
  logMarker: {
    color: colors.textDim,
    fontSize: typography.small,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  logAction: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  logTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  notesCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  notesTitle: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  notesBody: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 20,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: typography.heading,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: typography.small,
    lineHeight: 20,
  },
});
