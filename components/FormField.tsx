import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

export function FormField({ label, hint, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textDim}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.danger,
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.micro,
  },
  error: {
    color: colors.loss,
    fontSize: typography.micro,
  },
});
