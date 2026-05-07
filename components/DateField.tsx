import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  hint?: string;
}

export function DateField({ label, value, onChange, hint }: Props) {
  const [show, setShow] = useState(Platform.OS === 'ios');

  const handle = (_e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (d) onChange(d);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <View style={styles.iosBox}>
          <DateTimePicker
            value={value}
            mode="date"
            display="compact"
            onChange={handle}
            themeVariant="dark"
          />
        </View>
      ) : (
        <>
          <Pressable
            onPress={() => setShow(true)}
            style={({ pressed }) => [styles.field, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.value}>{value.toLocaleDateString()}</Text>
          </Pressable>
          {show ? (
            <DateTimePicker value={value} mode="date" display="default" onChange={handle} />
          ) : null}
        </>
      )}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  field: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  iosBox: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    flexDirection: 'row',
  },
  value: {
    color: colors.text,
    fontSize: typography.body,
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.micro,
  },
});
