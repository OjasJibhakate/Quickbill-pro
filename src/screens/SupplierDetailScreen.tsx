import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  getSupplierById,
  getPurchasesBySupplier,
  recordSupplierPayment,
  saveSupplier,
  deleteSupplier,
  PurchaseRow,
} from '@/database/repo';
import { Supplier } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { Card, Button, Field, EmptyState } from '@/components/ui';

export default function SupplierDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isOwner } = useAuth();
  const router = useRouter();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', contactPerson: '', address: '', notes: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [s, p] = await Promise.all([getSupplierById(id), getPurchasesBySupplier(id)]);
    setSupplier(s);
    setPurchases(p);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.error('Supplier load error:', e));
    }, [load])
  );

  const submitPayment = async () => {
    if (!supplier || !user) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      dialog.alert('Enter amount', 'Enter how much you paid the supplier.');
      return;
    }
    setBusy(true);
    try {
      await recordSupplierPayment(supplier.id, amount, user.id);
      setPayOpen(false);
      setPayAmount('');
      load();
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    if (!supplier) return;
    setEditForm({
      name: supplier.name,
      phone: supplier.phone ?? '',
      contactPerson: supplier.contactPerson ?? '',
      address: supplier.address ?? '',
      notes: supplier.notes ?? '',
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!supplier) return;
    if (!editForm.name.trim()) {
      dialog.alert('Missing name', 'Name cannot be empty.');
      return;
    }
    setBusy(true);
    try {
      await saveSupplier({
        id: supplier.id,
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        contactPerson: editForm.contactPerson.trim() || null,
        address: editForm.address.trim() || null,
        notes: editForm.notes.trim() || null,
      });
      setEditOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!supplier) return;
    dialog.alert('Delete supplier', `Remove ${supplier.name}? Past stock-ins stay in records.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSupplier(supplier.id);
          router.back();
        },
      },
    ]);
  };

  if (!isOwner) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState icon="🔒" title="Owner only" subtitle="Only the owner manages suppliers." />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!supplier) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Supplier not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Card style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Ionicons name="business" size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{supplier.name}</Text>
              <Text style={{ color: colors.textMuted }}>
                {supplier.contactPerson ? `${supplier.contactPerson} · ` : ''}
                {supplier.phone || 'No phone'}
              </Text>
            </View>
            <TouchableOpacity onPress={openEdit} hitSlop={8}>
              <Ionicons name="create-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {supplier.address ? (
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 10 }}>📍 {supplier.address}</Text>
          ) : null}

          <View style={[styles.payable, { borderTopColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Outstanding payable</Text>
            <Text
              style={{
                color: supplier.currentPayable > 0 ? colors.danger : colors.success,
                fontSize: 24,
                fontWeight: '800',
              }}
            >
              {formatCurrency(supplier.currentPayable)}
            </Text>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            title="Stock In"
            onPress={() => router.push({ pathname: '/stock-in', params: { supplierId: supplier.id } })}
            style={{ flex: 1 }}
          />
          <Button
            title="Record Payment"
            variant="success"
            onPress={() => setPayOpen(true)}
            style={{ flex: 1 }}
          />
        </View>

        <Text style={[styles.section, { color: colors.text }]}>Stock-In History</Text>
        {purchases.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No stock-ins from this supplier yet.</Text>
        ) : (
          purchases.map((p) => (
            <Card key={p.id} style={styles.purRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCurrency(p.totalAmount)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {p.itemCount} item(s) · {formatDateTime(p.date)}
                </Text>
              </View>
              <View
                style={[
                  styles.tag,
                  { backgroundColor: (p.paid ? colors.success : colors.warning) + '22' },
                ]}
              >
                <Text style={{ color: p.paid ? colors.success : colors.warning, fontSize: 12, fontWeight: '700' }}>
                  {p.paid ? 'Paid' : 'On credit'}
                </Text>
              </View>
            </Card>
          ))
        )}

        {isOwner && (
          <Button title="Delete Supplier" variant="danger" onPress={confirmDelete} style={{ marginTop: 20 }} />
        )}
      </ScrollView>

      {/* Payment modal */}
      <Modal visible={payOpen} transparent animationType="fade" onRequestClose={() => setPayOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
              Pay Supplier
            </Text>
            <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
              Payable: {formatCurrency(supplier.currentPayable)}
            </Text>
            <TextInput
              placeholder="Amount paid"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={payAmount}
              onChangeText={setPayAmount}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TouchableOpacity onPress={() => setPayAmount(String(supplier.currentPayable))} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                Pay full ({formatCurrency(supplier.currentPayable)})
              </Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button title="Cancel" variant="outline" onPress={() => setPayOpen(false)} style={{ flex: 1 }} />
              <Button title="Save" variant="success" onPress={submitPayment} loading={busy} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <ScrollView>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 14 }}>
                Edit Supplier
              </Text>
              <Field label="Name *" value={editForm.name} onChangeText={(t) => setEditForm((f) => ({ ...f, name: t }))} />
              <Field label="Phone" value={editForm.phone} onChangeText={(t) => setEditForm((f) => ({ ...f, phone: t }))} keyboardType="phone-pad" />
              <Field label="Contact person" value={editForm.contactPerson} onChangeText={(t) => setEditForm((f) => ({ ...f, contactPerson: t }))} />
              <Field label="Address" value={editForm.address} onChangeText={(t) => setEditForm((f) => ({ ...f, address: t }))} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Button title="Cancel" variant="outline" onPress={() => setEditOpen(false)} style={{ flex: 1 }} />
                <Button title="Save" onPress={submitEdit} loading={busy} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  payable: { borderTopWidth: 1, marginTop: 14, paddingTop: 14 },
  section: { fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  purRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' },
  sheet: { borderRadius: 18, padding: 20, maxHeight: '85%' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18 },
});
