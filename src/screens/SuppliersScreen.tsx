import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useReload } from '@/hooks/useReload';
import { getSuppliers, saveSupplier, getTotalPayable } from '@/database/repo';
import { Supplier } from '@/types';
import { formatCurrency } from '@/utils/format';
import { Card, Button, Field, EmptyState } from '@/components/ui';

interface FormState {
  name: string;
  phone: string;
  contactPerson: string;
  address: string;
  notes: string;
}

const emptyForm: FormState = { name: '', phone: '', contactPerson: '', address: '', notes: '' };

export default function SuppliersScreen() {
  const { colors } = useTheme();
  const { user, isOwner } = useAuth();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payable, setPayable] = useState(0);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const reload = useReload(async () => {
    const [list, total] = await Promise.all([getSuppliers(search), getTotalPayable()]);
    setSuppliers(list);
    setPayable(total);
  });

  React.useEffect(() => {
    getSuppliers(search).then(setSuppliers).catch(console.error);
  }, [search]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) {
      dialog.alert('Missing name', 'Enter the supplier name.');
      return;
    }
    setSaving(true);
    try {
      await saveSupplier({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        contactPerson: form.contactPerson.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      });
      setModalOpen(false);
      setForm(emptyForm);
      reload();
    } catch (e) {
      console.error(e);
      dialog.alert('Error', 'Could not save the supplier.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner && !user?.canSuppliers) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <EmptyState icon="🔒" title="No access" subtitle="Ask the owner for supplier access." />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Card style={{ marginBottom: 14, backgroundColor: colors.danger }}>
          <Text style={{ color: '#FFF', opacity: 0.85, fontSize: 13 }}>Total Payable (you owe)</Text>
          <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '800' }}>{formatCurrency(payable)}</Text>
        </Card>

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search suppliers"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <FlatList
          data={suppliers}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={
            <EmptyState icon="🚚" title="No suppliers yet" subtitle="Tap + to add a supplier." />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/supplier/[id]', params: { id: item.id } })}
            >
              <Card style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                  <Ionicons name="business-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {item.phone || item.contactPerson || 'No contact'}
                  </Text>
                </View>
                {item.currentPayable > 0 ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.danger, fontWeight: '800' }}>
                      {formatCurrency(item.currentPayable)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>payable</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                )}
              </Card>
            </TouchableOpacity>
          )}
        />
      </View>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          setForm(emptyForm);
          setModalOpen(true);
        }}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>New Supplier</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <Field label="Name *" value={form.name} onChangeText={(t) => set('name', t)} placeholder="Supplier / distributor" />
              <Field label="Phone" value={form.phone} onChangeText={(t) => set('phone', t)} keyboardType="phone-pad" placeholder="Optional" />
              <Field label="Contact person" value={form.contactPerson} onChangeText={(t) => set('contactPerson', t)} placeholder="Optional" />
              <Field label="Address" value={form.address} onChangeText={(t) => set('address', t)} placeholder="Optional" />
              <Field label="Notes" value={form.notes} onChangeText={(t) => set('notes', t)} placeholder="Optional" />
              <Button title="Add Supplier" onPress={save} loading={saving} style={{ marginTop: 8 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
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
