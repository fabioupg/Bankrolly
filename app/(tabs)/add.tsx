import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

export default function AddTabRedirect() {
  useEffect(() => {
    router.replace('/quick-add');
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
