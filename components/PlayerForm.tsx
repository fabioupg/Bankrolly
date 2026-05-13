import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { promptUpgrade } from '@/components/UpgradePrompt';
import { useCanAdd } from '@/hooks/useCanAdd';
import { usePlayerStore } from '@/store/usePlayerStore';
import {
  BLUFF_FREQUENCIES,
  PLAYER_ARCHETYPES,
  type BluffFrequency,
  type Player,
  type PlayerArchetype,
} from '@/db/schema';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface FormState {
  name: string;
  nickname: string;
  venue: string;
  archetype: PlayerArchetype | '';
  bluffFrequency: BluffFrequency | '';
  preflopTendencies: string;
  postflopTendencies: string;
  betSizing: string;
  generalNotes: string;
}

function toForm(p?: Player): FormState {
  if (!p) {
    return {
      name: '',
      nickname: '',
      venue: '',
      archetype: '',
      bluffFrequency: '',
      preflopTendencies: '',
      postflopTendencies: '',
      betSizing: '',
      generalNotes: '',
    };
  }
  return {
    name: p.name,
    nickname: p.nickname,
    venue: p.venue,
    archetype: (PLAYER_ARCHETYPES.includes(p.archetype as PlayerArchetype)
      ? p.archetype
      : '') as PlayerArchetype | '',
    bluffFrequency: (BLUFF_FREQUENCIES.includes(p.bluffFrequency as BluffFrequency)
      ? p.bluffFrequency
      : '') as BluffFrequency | '',
    preflopTendencies: p.preflopTendencies,
    postflopTendencies: p.postflopTendencies,
    betSizing: p.betSizing,
    generalNotes: p.generalNotes,
  };
}

interface Props {
  initial?: Player;
  mode: 'create' | 'edit';
  footerContent?: React.ReactNode;
}

export function PlayerForm({ initial, mode, footerContent }: Props) {
  const [form, setForm] = useState<FormState>(toForm(initial));
  const [submitting, setSubmitting] = useState(false);
  const addPlayer = usePlayerStore((s) => s.addPlayer);
  const updatePlayer = usePlayerStore((s) => s.updatePlayer);
  const removePlayer = usePlayerStore((s) => s.removePlayer);
  const limit = useCanAdd('player');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const onSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'At least the player name.');
      return;
    }
    if (mode === 'create' && !limit.canAdd) {
      promptUpgrade('player', limit.current, limit.limit);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        nickname: form.nickname.trim(),
        venue: form.venue.trim(),
        archetype: form.archetype,
        bluffFrequency: form.bluffFrequency,
        preflopTendencies: form.preflopTendencies.trim(),
        postflopTendencies: form.postflopTendencies.trim(),
        betSizing: form.betSizing.trim(),
        generalNotes: form.generalNotes.trim(),
      };
      if (mode === 'edit' && initial) {
        await updatePlayer(initial.id, payload);
        router.back();
      } else {
        const created = await addPlayer(payload);
        router.replace(`/players/${created.id}`);
      }
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = () => {
    if (!initial) return;
    Alert.alert('Delete player?', 'All linked hand notes will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removePlayer(initial.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <FormField
          label="Name"
          placeholder="Real name or main alias"
          value={form.name}
          onChangeText={(v) => set('name', v)}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormField
              label="Nickname"
              placeholder="e.g. The Crab"
              value={form.nickname}
              onChangeText={(v) => set('nickname', v)}
            />
          </View>
          <View style={styles.flex}>
            <FormField
              label="Venue"
              placeholder="e.g. Bellagio"
              value={form.venue}
              onChangeText={(v) => set('venue', v)}
            />
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Archetype</Text>
          <View style={styles.chips}>
            {PLAYER_ARCHETYPES.map((a) => (
              <Chip
                key={a}
                label={a}
                tone="accent"
                active={form.archetype === a}
                onPress={() => set('archetype', form.archetype === a ? '' : a)}
              />
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Bluff frequency</Text>
          <View style={styles.chips}>
            {BLUFF_FREQUENCIES.map((b) => (
              <Chip
                key={b}
                label={b}
                tone="accent"
                active={form.bluffFrequency === b}
                onPress={() => set('bluffFrequency', form.bluffFrequency === b ? '' : b)}
              />
            ))}
          </View>
        </View>

        <FormField
          label="Preflop tendencies"
          placeholder="Opens 25%, 3-bets light from BTN..."
          value={form.preflopTendencies}
          onChangeText={(v) => set('preflopTendencies', v)}
          multiline
          style={styles.multi}
        />
        <FormField
          label="Postflop tendencies"
          placeholder="Cbets every flop, gives up turn often..."
          value={form.postflopTendencies}
          onChangeText={(v) => set('postflopTendencies', v)}
          multiline
          style={styles.multi}
        />
        <FormField
          label="Bet sizing"
          placeholder="Small flop bets ~30%, polarises river"
          value={form.betSizing}
          onChangeText={(v) => set('betSizing', v)}
          multiline
          style={styles.multi}
        />
        <FormField
          label="General notes"
          placeholder="Tilts after losing big pots, talkative..."
          value={form.generalNotes}
          onChangeText={(v) => set('generalNotes', v)}
          multiline
          style={styles.multi}
        />

        <PrimaryButton
          label={mode === 'edit' ? 'Save changes' : 'Save player'}
          onPress={onSave}
          loading={submitting}
        />
        {mode === 'edit' ? (
          <PrimaryButton label="Delete player" variant="danger" onPress={onDelete} />
        ) : null}
        {footerContent}
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  multi: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
});
