import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { OnlineSessionForm } from '@/components/OnlineSessionForm';
import { useOnlineSessionStore } from '@/store/useOnlineSessionStore';
import { colors, typography } from '@/theme/colors';

export default function EditOnlineSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessions = useOnlineSessionStore((s) => s.sessions);

  const session = useMemo(
    () => (id ? sessions.find((s) => s.id === id) : undefined),
    [sessions, id],
  );

  if (!session) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Session not found</Text>
        <Text style={styles.notFoundBody}>It may have been deleted.</Text>
      </View>
    );
  }

  return <OnlineSessionForm initial={session} mode="edit" />;
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  notFoundTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  notFoundBody: {
    color: colors.textMuted,
  },
});
