import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { Card, Button, Field } from '@/components/ui';

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const { user, logout, isOwner } = useAuth();
  const { store, setStoreName, updateStore } = useStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const modes: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'light', label: 'Light', icon: 'sunny-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
    { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={[styles.h1, { color: colors.text }]}>Settings</Text>

        <Card style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '800' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              {user?.name}
            </Text>
            <Text style={{ color: colors.textMuted, textTransform: 'capitalize' }}>
              {user?.role} · Max discount {user?.maxDiscount}%
            </Text>
          </View>
        </Card>

        <Text style={[styles.section, { color: colors.textMuted }]}>STORE</Text>
        <Card>
          <Field
            label="Store name (header & invoices)"
            value={store.name}
            onChangeText={setStoreName}
            placeholder="e.g. Sharma Kirana Store"
          />
          <Field
            label="Address"
            value={store.address}
            onChangeText={(t) => updateStore({ address: t })}
            placeholder="Shown on invoices"
          />
          <Field
            label="Contact phone"
            value={store.phone}
            onChangeText={(t) => updateStore({ phone: t })}
            keyboardType="phone-pad"
            placeholder="Shown on invoices"
          />
          <Field
            label="Website (optional — adds a QR to invoices)"
            value={store.website}
            onChangeText={(t) => updateStore({ website: t })}
            keyboardType="url"
            autoCapitalize="none"
            placeholder="https://yourstore.com"
            containerStyle={{ marginBottom: 0 }}
          />
        </Card>

        {isOwner && (
          <>
            <TouchableOpacity onPress={() => router.push('/export')}>
              <Card style={[styles.linkRow, { marginTop: 12 }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Export to Excel</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Sales, inventory & customers as .xlsx
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Card>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/backup')}>
              <Card style={[styles.linkRow, { marginTop: 10 }]}>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Backup & Restore</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Save all data to your Google Drive
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Card>
            </TouchableOpacity>
          </>
        )}

        {isOwner && (
          <>
            <Text style={[styles.section, { color: colors.textMuted }]}>STAFF</Text>
            <TouchableOpacity onPress={() => router.push('/users')}>
              <Card style={[styles.linkRow, { marginBottom: 10 }]}>
                <Ionicons name="people-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Manage staff & PINs</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Change PINs, add employees, set discount limits
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Card>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/activity')}>
              <Card style={styles.linkRow}>
                <Ionicons name="receipt-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Activity log</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Who sold, edited, deleted, or opened shifts
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Card>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.section, { color: colors.textMuted }]}>APPEARANCE</Text>
        <Card>
          {modes.map((m, idx) => (
            <TouchableOpacity
              key={m.key}
              onPress={() => setThemeMode(m.key)}
              style={[
                styles.themeRow,
                idx < modes.length - 1 && { borderBottomWidth: 1, borderColor: colors.border },
              ]}
            >
              <Ionicons name={m.icon} size={20} color={colors.text} />
              <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }}>{m.label}</Text>
              {themeMode === m.key && (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </Card>

        <Text style={[styles.section, { color: colors.textMuted }]}>ABOUT</Text>
        <Card>
          <Row label="App" value="QuickBill Pro" colors={colors} />
          <Row label="Version" value="1.0.0" colors={colors} border={false} />
        </Card>

        <Button title="Log Out" variant="danger" onPress={handleLogout} style={{ marginTop: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({
  label,
  value,
  colors,
  border = true,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  border?: boolean;
}) => (
  <View
    style={[
      styles.infoRow,
      border && { borderBottomWidth: 1, borderColor: colors.border },
    ]}
  >
    <Text style={{ color: colors.textMuted }}>{label}</Text>
    <Text style={{ color: colors.text, fontWeight: '600' }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, fontWeight: '700', marginTop: 24, marginBottom: 8, letterSpacing: 1 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
});
