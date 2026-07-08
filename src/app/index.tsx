import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const APP_NAME = Constants.expoConfig?.name ?? 'QuickBill Pro';

/**
 * Entry route. While auth state is restoring we show a splash; afterwards we
 * redirect to the tabs (logged in) or the login screen.
 */
export default function Index() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.primary }]}>
        <Text style={styles.brand}>{APP_NAME}</Text>
        <ActivityIndicator color="#FFF" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#FFF', fontSize: 28, fontWeight: '800' },
});
