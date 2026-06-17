import { View, Text, TouchableOpacity } from 'react-native';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme, ThemeColors } from '@/context/ThemeContext';
import { useStore } from '@/context/StoreContext';

/** Branded header title: "QBP" badge + the shop's name. */
function BrandHeader({ colors, name }: { colors: ThemeColors; name: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          paddingHorizontal: 7,
          height: 28,
          borderRadius: 8,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 }}>
          QBP
        </Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

export default function TabNavigator() {
  const { user, isOwner } = useAuth();
  const { colors } = useTheme();
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
        headerTitle: () => <BrandHeader colors={colors} name={displayName} />,
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
