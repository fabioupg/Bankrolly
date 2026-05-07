import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/colors';
import { ReactNode } from 'react';

interface Props {
  title: string;
  action?: ReactNode;
}

export function SectionTitle({ title, action }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
});
