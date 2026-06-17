import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const PIN_LENGTH = 4;

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const submit = async (value: string) => {
    setBusy(true);
    const ok = await login(value);
    setBusy(false);
    if (ok) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Invalid PIN', 'No account found for that PIN. Try again.');
      setPin('');
    }
  };

  const press = (digit: string) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  };

  const backspace = () => setPin((p) => p.slice(0, -1));

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Ionicons name="receipt-outline" size={36} color="#FFF" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>QuickBill Pro</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Enter your PIN to continue
        </Text>
      </View>

      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                borderColor: colors.border,
                backgroundColor: i < pin.length ? colors.primary : 'transparent',
              },
            ]}
          />
        ))}
      </View>

      {busy ? <ActivityIndicator color={colors.primary} style={{ height: 24 }} /> : <View style={{ height: 24 }} />}

      <View style={styles.pad}>
        {keys.map((k, i) => {
          if (k === '') return <View key={i} style={styles.key} />;
          if (k === 'back') {
            return (
              <TouchableOpacity key={i} style={styles.key} onPress={backspace}>
                <Ionicons name="backspace-outline" size={26} color={colors.text} />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={i}
              style={[styles.key, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => press(k)}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>{k}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.hint, { borderColor: colors.border }]}>
        <Text style={{ color: colors.textMuted }}>Owner PIN: 1234 · Cashier PIN: 0000</Text>
      </View>
    </SafeAreaView>
  );
}

const KEY = 78;
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 30 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 15, marginTop: 6 },
  dots: { flexDirection: 'row', gap: 18, marginBottom: 16 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  pad: {
    width: KEY * 3 + 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: KEY / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  keyText: { fontSize: 26, fontWeight: '600' },
  hint: { marginTop: 32, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1 },
});
