import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme/colors';

export default function QuickAddModal() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.body}>
        <Text style={styles.title}>What did you play?</Text>
        <Text style={styles.subtitle}>Pick a session type to log</Text>

        <View style={styles.options}>
          <OptionCard
            title="Cash Game"
            subtitle="Buy-in / cash-out, hourly rate, hands"
            glyph="♠"
            tone={colors.accent}
            onPress={() => {
              router.dismiss();
              router.push('/cash/new');
            }}
          />
          <OptionCard
            title="Tournament"
            subtitle="MTT / SNG / Bounty, ROI, ITM"
            glyph="♣"
            tone="#3b6dff"
            onPress={() => {
              router.dismiss();
              router.push('/tournament/new');
            }}
          />
          <OptionCard
            title="Hand Note"
            subtitle="Standalone hand to review later"
            glyph="♥"
            tone="#9333ea"
            onPress={() => {
              router.dismiss();
              router.push('/hand/new');
            }}
          />
        </View>

        <Pressable onPress={() => router.dismiss()} style={styles.cancel}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface OptionProps {
  title: string;
  subtitle: string;
  glyph: string;
  tone: string;
  onPress: () => void;
}

function OptionCard({ title, subtitle, glyph, tone, onPress }: OptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.cardHover }]}
    >
      <View style={[styles.glyphBox, { backgroundColor: tone }]}>
        <Text style={styles.glyph}>{glyph}</Text>
      </View>
      <View style={styles.optionMeta}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSub}>{subtitle}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    marginTop: -spacing.md,
  },
  options: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  glyphBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  optionMeta: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  optionSub: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  chev: {
    color: colors.textDim,
    fontSize: 28,
  },
  cancel: {
    marginTop: 'auto',
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '600',
  },
});
