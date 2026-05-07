import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useHandStore } from '@/store/useHandStore';
import {
  HAND_TAGS,
  POSITIONS,
  STREETS,
  type HandTag,
  type Position,
  type SessionType,
  type Street,
} from '@/db/schema';
import { TAG_LABELS } from '@/components/HandNoteCard';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface FormState {
  sessionType: SessionType;
  street: Street;
  position: Position;
  heroCards: string;
  board: string;
  villainRangeNotes: string;
  actionLine: string;
  result: string;
  tag: HandTag;
  notes: string;
}

export default function NewHandNote() {
  const { sessionId, sessionType: typeParam } = useLocalSearchParams<{
    sessionId?: string;
    sessionType?: SessionType;
  }>();
  const initialType: SessionType = typeParam === 'tournament' ? 'tournament' : 'cash';
  const [form, setForm] = useState<FormState>({
    sessionType: initialType,
    street: 'preflop',
    position: 'BTN',
    heroCards: '',
    board: '',
    villainRangeNotes: '',
    actionLine: '',
    result: '',
    tag: 'review',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const add = useHandStore((s) => s.add);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const onSave = async () => {
    if (!form.actionLine.trim() && !form.notes.trim() && !form.heroCards.trim()) {
      Alert.alert('Empty hand', 'Add at least hero cards, action line, or notes.');
      return;
    }
    setSubmitting(true);
    try {
      await add({
        sessionId: sessionId ?? null,
        sessionType: form.sessionType,
        street: form.street,
        position: form.position,
        heroCards: form.heroCards.trim(),
        board: form.board.trim(),
        villainRangeNotes: form.villainRangeNotes.trim(),
        actionLine: form.actionLine.trim(),
        result: Number(form.result) || 0,
        tag: form.tag,
        notes: form.notes.trim(),
      });
      router.back();
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {sessionId ? (
          <View style={styles.banner}>
            <Text style={styles.bannerLabel}>Linked to {form.sessionType} session</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.fieldLabel}>Session type</Text>
            <View style={styles.chips}>
              <Chip
                label="Cash"
                tone="accent"
                active={form.sessionType === 'cash'}
                onPress={() => set('sessionType', 'cash')}
              />
              <Chip
                label="Tournament"
                tone="accent"
                active={form.sessionType === 'tournament'}
                onPress={() => set('sessionType', 'tournament')}
              />
            </View>
          </View>
        )}

        <View>
          <Text style={styles.fieldLabel}>Street</Text>
          <View style={styles.chips}>
            {STREETS.map((s) => (
              <Chip
                key={s}
                label={s}
                tone="accent"
                active={form.street === s}
                onPress={() => set('street', s)}
              />
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Position</Text>
          <View style={styles.chips}>
            {POSITIONS.map((p) => (
              <Chip
                key={p}
                label={p}
                tone="accent"
                active={form.position === p}
                onPress={() => set('position', p)}
              />
            ))}
          </View>
        </View>

        <FormField
          label="Hero cards"
          placeholder="Ah Kd"
          autoCapitalize="none"
          value={form.heroCards}
          onChangeText={(v) => set('heroCards', v)}
          hint="Use suit letters: h d c s"
        />
        <FormField
          label="Board"
          placeholder="Js 9h 2c | Th | 4s"
          autoCapitalize="none"
          value={form.board}
          onChangeText={(v) => set('board', v)}
        />
        <FormField
          label="Villain range notes"
          placeholder="Tight reg, 3-bet 6%..."
          value={form.villainRangeNotes}
          onChangeText={(v) => set('villainRangeNotes', v)}
          multiline
          style={styles.multi}
        />
        <FormField
          label="Action line"
          placeholder="UTG opens 3bb, Hero 3bets 9bb, BB calls..."
          value={form.actionLine}
          onChangeText={(v) => set('actionLine', v)}
          multiline
          style={styles.multi}
        />
        <FormField
          label="Result (chips / $)"
          placeholder="+250 or -120"
          keyboardType="numbers-and-punctuation"
          value={form.result}
          onChangeText={(v) => set('result', v)}
        />

        <View>
          <Text style={styles.fieldLabel}>Tag</Text>
          <View style={styles.chips}>
            {HAND_TAGS.map((t) => (
              <Chip
                key={t}
                label={TAG_LABELS[t]}
                tone="accent"
                active={form.tag === t}
                onPress={() => set('tag', t)}
              />
            ))}
          </View>
        </View>

        <FormField
          label="Notes"
          placeholder="Why I made this play..."
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          multiline
          style={styles.multi}
        />

        <PrimaryButton label="Save hand" onPress={onSave} loading={submitting} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
    marginBottom: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  multi: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  banner: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerLabel: {
    color: colors.profit,
    fontWeight: '700',
    fontSize: typography.small,
  },
});
