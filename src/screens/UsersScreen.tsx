import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useReload } from '@/hooks/useReload';
import { getUsers, saveUser, deleteUser } from '@/database/repo';
import { User, Role } from '@/types';
import { Card, Button, Field, EmptyState } from '@/components/ui';

interface FormState {
  id?: string;
  name: string;
  role: Role;
  maxDiscount: string;
  pin: string;
}

const newEmployee: FormState = { name: '', role: 'employee', maxDiscount: '10', pin: '' };

export default function UsersScreen() {
  const { colors } = useTheme();
  const { user, isOwner, refreshUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(newEmployee);
  const [busy, setBusy] = useState(false);

  const reload = useReload(async () => {
    setUsers(await getUsers());
  });

  if (!isOwner) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState icon="🔒" title="Owner only" subtitle="Only the owner can manage staff." />
      </View>
    );
  }

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => {
    setForm(newEmployee);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setForm({
      id: u.id,
      name: u.name,
      role: u.role,
      maxDiscount: String(u.maxDiscount),
      pin: u.pin,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing name', 'Enter the staff name.');
      return;
    }
    setBusy(true);
    try {
      await saveUser({
        id: form.id,
        name: form.name.trim(),
        role: form.role,
        // Owners are effectively unlimited; store 100 for them.
        maxDiscount: form.role === 'owner' ? 100 : parseFloat(form.maxDiscount) || 0,
        pin: form.pin.trim(),
      });
      if (form.id === user?.id) await refreshUser();
      setModalOpen(false);
      reload();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (u: User) => {
    if (u.id === user?.id) {
      Alert.alert('Not allowed', 'You cannot delete your own account.');
      return;
    }
    Alert.alert('Remove staff', `Remove ${u.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(u.id);
            reload();
          } catch (e: any) {
            Alert.alert('Could not remove', e?.message ?? 'Unknown error.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        ListHeaderComponent={
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
            Set 4-digit PINs and per-employee discount limits. Tap a person to edit.
          </Text>
        }
        ListEmptyComponent={<EmptyState icon="👥" title="No staff yet" />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openEdit(item)}>
            <Card style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                  {item.name}
                  {item.id === user?.id ? ' (you)' : ''}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, textTransform: 'capitalize' }}>
                  {item.role}
                  {item.role === 'employee' ? ` · max ${item.maxDiscount}% off` : ' · unlimited'}
                </Text>
              </View>
              <View style={[styles.pinPill, { backgroundColor: colors.border }]}>
                <Ionicons name="key-outline" size={13} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>••••</Text>
              </View>
              {item.id !== user?.id && (
                <TouchableOpacity onPress={() => remove(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
            </Card>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openAdd}>
        <Ionicons name="person-add" size={26} color="#FFF" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                {form.id ? 'Edit Staff' : 'Add Staff'}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <Field label="Name *" value={form.name} onChangeText={(t) => set('name', t)} placeholder="Staff name" />

              <Text style={[styles.label, { color: colors.textMuted }]}>Role</Text>
              <View style={[styles.roleToggle, { borderColor: colors.border }]}>
                {(['employee', 'owner'] as Role[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => set('role', r)}
                    style={[
                      styles.roleBtn,
                      { backgroundColor: form.role === r ? colors.primary : 'transparent' },
                    ]}
                  >
                    <Text
                      style={{
                        color: form.role === r ? '#FFF' : colors.text,
                        fontWeight: '700',
                        textTransform: 'capitalize',
                      }}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.role === 'employee' && (
                <Field
                  label="Max discount % on a bill"
                  value={form.maxDiscount}
                  onChangeText={(t) => set('maxDiscount', t)}
                  keyboardType="numeric"
                  placeholder="e.g. 10"
                  containerStyle={{ marginTop: 14 }}
                />
              )}

              <Field
                label="4-digit PIN"
                value={form.pin}
                onChangeText={(t) => set('pin', t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                maxLength={4}
                placeholder="e.g. 1234"
                containerStyle={{ marginTop: form.role === 'employee' ? 0 : 14 }}
              />

              <Button
                title={form.id ? 'Save' : 'Add Staff'}
                onPress={save}
                loading={busy}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pinPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  roleToggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  roleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
});
