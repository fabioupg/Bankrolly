import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HandHistoryList } from '@/components/HandHistoryList';
import { colors } from '@/theme/colors';

export default function HandHistoryScreen() {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <HandHistoryList />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
});
