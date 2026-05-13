import { Alert } from 'react-native';
import { router } from 'expo-router';
import { LIMIT_LABELS, type LimitedKind } from '@/utils/limits';

export function promptUpgrade(kind: LimitedKind, current: number, limit: number) {
  const label = LIMIT_LABELS[kind];
  Alert.alert(
    'Free limit reached',
    `You've logged ${current} of ${limit} ${label}. Upgrade to Pro for unlimited ${label}, all analytics charts, and CSV export.`,
    [
      { text: 'Maybe later', style: 'cancel' },
      {
        text: 'See Pro',
        style: 'default',
        onPress: () => router.push('/paywall'),
      },
    ],
  );
}
