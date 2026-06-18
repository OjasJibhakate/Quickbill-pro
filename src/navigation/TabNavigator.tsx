import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useTheme, ThemeColors } from '@/context/ThemeContext';
import { useStore } from '@/context/StoreContext';

/** Branded header title: gradient "QBP" logo + the shop's name. */
function BrandHeader({ colors, isDark, name }: { colors: ThemeColors; isDark: boolean; name: string }) {
  return (
    <View style={styles.brandRow}>
      <LinearGradient
        colors={isDark ? (['#60A5FA', '#2563EB'] as const) : (['#3B82F6', '#1D4ED8'] as const)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.logo}
      >
        <Text style={styles.logoText}>QBP</Text>
      </LinearGradient>
      <Text style={[styles.brandName, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  logoText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12.5, letterSpacing: 0.8 },
  brandName: { fontSize: 18, fontWeight: '800', letterSpacing: 0.3, maxWidth: 210 },
});

export default function TabNavigator() {
  const { user, isOwner } = useAuth();
  const { colors, isDark } = useTheme();
  const { displayName } = useStore();
  const router = useRouter();

  // Guard: never render the tabs to an unauthenticated user.
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.text,
        headerTitleAlign: 'left',
        headerTitle: () => <BrandHeader colors={colors} isDark={isDark} name={displayName} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/scan')}
              hitSlop={8}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="scan-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'Billing',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="layers-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Reports',
          // Only the owner sees the Reports tab; href:null hides it for employees.
          href: isOwner ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
