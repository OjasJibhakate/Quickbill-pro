import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { isDriveConfigured, verifyGoogleAccount, driveSignOut, getRecoveryEmail } from '@/utils/drivesync';
import { getUsers, saveUser } from '@/database/repo';
import { User } from '@/types';

const PIN_LENGTH = 4;

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  // PIN recovery (Reset via Google).
  const [recovering, setRecovering] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [newPin, setNewPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const submit = async (value: string) => {
    setBusy(true);
    const ok = await login(value);
    setBusy(false);
    if (ok) {
      router.replace('/(tabs)');
    } else {
      dialog.alert('Invalid PIN', 'No account found for that PIN. Try again.');
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

  const forgotPin = async () => {
    if (!isDriveConfigured()) {
      dialog.alert(
        'Recovery needs Google',
        'PIN recovery uses your shop Google account. Ask the owner to set up Google Drive first (Settings → Backup & Restore).'
      );
      return;
    }
    setRecovering(true);
    try {
      const ownerEmail = await getRecoveryEmail();
      if (!ownerEmail) {
        dialog.alert(
          'Not set up yet',
          'Connect Google Drive once while logged in (Settings → Backup & Restore) to enable PIN recovery on this phone.'
        );
        return;
      }
      const email = await verifyGoogleAccount();
      if (email.toLowerCase() !== ownerEmail.toLowerCase()) {
        await driveSignOut(); // don't leave a non-shop account connected
        dialog.alert(
          'Not the shop account',
          "This Google account isn't the one linked to this shop, so it can't reset PINs."
        );
        return;
      }
      const list = await getUsers();
      setUsers(list);
      setSelected(null);
      setNewPin('');
      setResetOpen(true);
    } catch (e: any) {
      if (e?.message !== 'cancelled') {
        dialog.alert('Could not verify', 'Google sign-in failed. Please try again.');
      }
    } finally {
      setRecovering(false);
    }
  };

  const savePin = async () => {
    if (!selected) return;
    if (!/^\d{4}$/.test(newPin)) {
      dialog.alert('4 digits', 'PIN must be exactly 4 digits.');
      return;
    }
    setSavingPin(true);
    try {
      await saveUser({
        id: selected.id,
        name: selected.name,
        role: selected.role,
        maxDiscount: selected.maxDiscount,
        pin: newPin,
      });
      setResetOpen(false);
      dialog.alert('PIN updated', `${selected.name} can now log in with ${newPin}.`);
    } catch (e: any) {
      dialog.alert('Could not update', e?.message ?? 'Try a different PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Ionicons name="receipt-outline" size={36} color="#FFF" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>QuickBill Pro</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Enter your PIN to continue</Text>
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

      {busy ? (
        <ActivityIndicator color={colors.primary} style={{ height: 24 }} />
      ) : (
        <View style={{ height: 24 }} />
      )}

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

      {isDriveConfigured() && (
        <TouchableOpacity onPress={forgotPin} disabled={recovering} style={styles.forgot}>
          {recovering ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Forgot PIN?</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Reset via Google */}
      <Modal
        visible={resetOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setResetOpen(false)}
      >
        <View style={styles.scrim}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sheetHead}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
                {selected ? `New PIN · ${selected.name}` : 'Reset a PIN'}
              </Text>
              <TouchableOpacity onPress={() => setResetOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selected ? (
              <View style={{ gap: 12 }}>
                <TextInput
                  value={newPin}
                  onChangeText={(t) => setNewPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  placeholder="4-digit PIN"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  style={[styles.pinInput, { color: colors.text, borderColor: colors.border }]}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setSelected(null)}
                    style={[styles.sheetBtn, { borderColor: colors.border, borderWidth: 1 }]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={savePin}
                    disabled={savingPin}
                    style={[styles.sheetBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>
                      {savingPin ? 'Saving…' : 'Save PIN'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                <Text style={{ color: colors.textMuted, marginBottom: 10 }}>
                  Verified as the shop account. Pick whose PIN to reset:
                </Text>
                {users.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => {
                      setSelected(u);
                      setNewPin('');
                    }}
                    style={[styles.userRow, { borderColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{u.name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, textTransform: 'capitalize' }}>
                        {u.role}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  forgot: { marginTop: 28, paddingVertical: 8, paddingHorizontal: 16, minHeight: 36, justifyContent: 'center' },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  sheet: { width: '100%', maxWidth: 380, borderRadius: 16, borderWidth: 1, padding: 18 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  pinInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
    fontWeight: '700',
  },
  sheetBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
});
