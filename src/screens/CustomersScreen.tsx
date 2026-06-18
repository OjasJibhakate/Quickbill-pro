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
import { useReload } from '@/hooks/useReload';
import { getCustomers, saveCustomer, getTotalOutstanding } from '@/database/repo';
import { Customer } from '@/types';
import { formatCurrency } from '@/utils/format';
import { Card, Button, Field, EmptyState } from '@/components/ui';

interface FormState {
  id?: string;
  name: string;
  phone: string;
  creditLimit: string;
  discountPct: string;
}

const emptyForm: FormState = { name: '', phone: '', creditLimit: '', discountPct: '' };

export default function CustomersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const reload = useReload(async () => {
    const [list, total] = await Promise.all([getCustomers(search), getTotalOutstanding()]);
    setCustomers(list);
    setOutstanding(total);
  });

  React.useEffect(() => {
    getCustomers(search).then(setCustomers).catch(console.error);
  }, [search]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) {
      dialog.alert('Missing name', 'Please enter the customer name.');
      return;
    }
    setSaving(true);
    try {
      await saveCustomer({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        creditLimit: parseFloat(form.creditLimit) || 0,
        discountPct: parseFloat(form.discountPct) || 0,
      });
      setModalOpen(false);
      setForm(emptyForm);
      reload();
    } catch (e) {
      console.error(e);
      dialog.alert('Error', 'Could not save the customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Card style={{ marginBottom: 14, backgroundColor: colors.primary }}>
          <Text style={{ color: '#FFF', opacity: 0.85, fontSize: 13 }}>Total Udhaar (outstanding)</Text>
          <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '800' }}>
            {formatCurrency(outstanding)}
          </Text>
        </Card>

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search by name or phone"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={
            <EmptyState icon="🧑‍🤝‍🧑" title="No customers yet" subtitle="Tap + to add a customer / khata." />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/customer/[id]', params: { id: item.id } })}
            >
              <Card style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {item.phone || 'No phone'}
                    {item.discountPct > 0 ? ` · ${item.discountPct}% off` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {item.currentDue > 0 ? (
                    <>
                      <Text style={{ color: colors.danger, fontWeight: '800' }}>
                        {formatCurrency(item.currentDue)}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>due</Text>
                    </>
                  ) : (
                    <View style={[styles.clearPill, { backgroundColor: colors.success + '22' }]}>
                      <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>Clear</Text>
                    </View>
                  )}
                </View>
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
        <Ionicons name="person-add" size={26} color="#FFF" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>New Customer</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <Field label="Name *" value={form.name} onChangeText={(t) => set('name', t)} placeholder="Customer name" />
              <Field label="Phone" value={form.phone} onChangeText={(t) => set('phone', t)} keyboardType="phone-pad" placeholder="10-digit mobile (for reminders)" />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Field label="Credit Limit (₹)" containerStyle={{ flex: 1 }} value={form.creditLimit} onChangeText={(t) => set('creditLimit', t)} keyboardType="numeric" placeholder="0 = no limit" />
                <Field label="Discount %" containerStyle={{ flex: 1 }} value={form.discountPct} onChangeText={(t) => set('discountPct', t)} keyboardType="numeric" placeholder="0" />
              </View>
              <Button title="Add Customer" onPress={save} loading={saving} style={{ marginTop: 8 }} />
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
  clearPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
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
