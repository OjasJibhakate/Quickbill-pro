import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { StoreProvider } from '@/context/StoreContext';

function RootStack() {
  const { isDark, colors } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sales" options={{ headerShown: true, title: 'Sales History' }} />
        <Stack.Screen name="sale/[id]" options={{ headerShown: true, title: 'Sale Details' }} />
        <Stack.Screen name="customers" options={{ headerShown: true, title: 'Customers & Udhaar' }} />
        <Stack.Screen name="customer/[id]" options={{ headerShown: true, title: 'Customer' }} />
        <Stack.Screen name="users" options={{ headerShown: true, title: 'Staff & PINs' }} />
        <Stack.Screen name="shift" options={{ headerShown: true, title: 'Shift' }} />
        <Stack.Screen name="shift/[id]" options={{ headerShown: true, title: 'Z-Report' }} />
        <Stack.Screen name="activity" options={{ headerShown: true, title: 'Activity Log' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <StoreProvider>
              <RootStack />
            </StoreProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
