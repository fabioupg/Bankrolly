import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/colors';

function TabIcon({ glyph, label, focused }: { glyph: string; label: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>{glyph}</Text>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
    </View>
  );
}

function AddTabButton() {
  return (
    <Pressable
      onPress={() => router.push('/quick-add')}
      style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
      accessibilityLabel="Add new entry"
    >
      <Text style={styles.addPlus}>+</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerTintColor: colors.profit,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          height: 70,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◆" label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ focused }) => <TabIcon glyph="≡" label="Sessions" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarButton: () => <AddTabButton />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/quick-add');
          },
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ focused }) => <TabIcon glyph="∿" label="Analytics" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⚙" label="Settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    gap: 2,
    width: 60,
  },
  icon: {
    color: colors.textDim,
    fontSize: 22,
  },
  iconFocused: {
    color: colors.profit,
  },
  label: {
    color: colors.textDim,
    fontSize: typography.micro,
  },
  labelFocused: {
    color: colors.profit,
    fontWeight: '700',
  },
  addBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
    alignSelf: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addPlus: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 32,
  },
});
