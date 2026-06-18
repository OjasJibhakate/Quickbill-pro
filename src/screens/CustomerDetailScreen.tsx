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
  Linking,
  ActivityIndicator,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import {
  getCustomerById,
  getCustomerTransactions,
  getCustomerSales,
  recordPayment,
  saveCustomer,
  deleteCustomer,
  RecentSale,
} from '@/database/repo';
import { Customer, CreditTransaction } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { Card, Button, Field } from '@/components/ui';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { displayName } = useStore();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [txns, setTxns] = useState<CreditTransaction[]>([]);
  const [sales, setSales] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(true);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', creditLimit: '', discountPct: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [c, t, s] = await Promise.all([
      getCustomerById(id),
      getCustomerTransactions(id),
      getCustomerSales(id),
    ]);
    setCustomer(c);
    setTxns(t);
    setSales(s);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.error('Customer load error:', e));
    }, [load])
  );

  const submitPayment = async () => {
    if (!customer || !user) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      dialog.alert('Enter amount', 'Enter how much the customer is paying.');
      return;
    }
    setBusy(true);
    try {
      await recordPayment(customer.id, amount, user.id);
      setPayOpen(false);
      setPayAmount('');
      load();
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      phone: customer.phone ?? '',
      creditLimit: String(customer.creditLimit),
      discountPct: String(customer.discountPct),
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!customer) return;
    if (!editForm.name.trim()) {
      dialog.alert('Missing name', 'Name cannot be empty.');
      return;
    }
    setBusy(true);
    try {
      await saveCustomer({
        id: customer.id,
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        creditLimit: parseFloat(editForm.creditLimit) || 0,
        discountPct: parseFloat(editForm.discountPct) || 0,
      });
      setEditOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!customer) return;
    const warn =
      customer.currentDue > 0
        ? `${customer.name} still owes ${formatCurrency(customer.currentDue)}. `
        : '';
    dialog.alert('Delete customer', `${warn}This removes the customer and their ledger. Continue?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCustomer(customer.id);
          router.back();
        },
      },
    ]);
  };

  const sendReminder = () => {
    if (!customer?.phone) {
      dialog.alert('No phone number', 'Add a phone number to send a reminder.');
      return;
    }
    const digits = customer.phone.replace(/\D/g, '');
    const wa = digits.length === 10 ? `91${digits}` : digits;
    const msg = `Namaste ${customer.name}, a gentle reminder from ${displayName}: your pending balance is ${formatCurrency(
      customer.currentDue
    )}. Kindly clear it at your convenience. Thank you!`;
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() =>
      dialog.alert('Could not open WhatsApp', 'Make sure WhatsApp is installed.')
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!customer) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Customer not found.</Text>
      </View>
    );
  }

  const overLimit = customer.creditLimit > 0 && customer.currentDue > customer.creditLimit;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Card style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '800' }}>
                {customer.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{customer.name}</Text>
              <Text style={{ color: colors.textMuted }}>{customer.phone || 'No phone'}</Text>
            </View>
            <TouchableOpacity onPress={openEdit} hitSlop={8}>
              <Ionicons name="create-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.dueBox, { borderTopColor: colors.border }]}>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Outstanding Due</Text>
              <Text
                style={{
                  color: customer.currentDue > 0 ? colors.danger : colors.success,
                  fontSize: 28,
                  fontWeight: '800',
                }}
              >
                {formatCurrency(customer.currentDue)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Limit: {customer.creditLimit > 0 ? formatCurrency(customer.creditLimit) : 'None'}
              </Text>
              {customer.discountPct > 0 && (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Discount: {customer.discountPct}%
                </Text>
              )}
              {overLimit && (
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>Over limit!</Text>
              )}
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            title="Record Payment"
            variant="success"
            onPress={() => setPayOpen(true)}
            style={{ flex: 1 }}
          />
          <Button title="Remind" variant="outline" onPress={sendReminder} style={{ flex: 1 }} />
        </View>

        <Text style={[styles.section, { color: colors.text }]}>Ledger</Text>
        {txns.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No credit activity yet.</Text>
        ) : (
          txns.map((t) => (
            <Card key={t.id} style={styles.txnRow}>
              <Ionicons
                name={t.type === 'payment' ? 'arrow-down-circle' : 'arrow-up-circle'}
                size={24}
                color={t.type === 'payment' ? colors.success : colors.danger}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {t.type === 'payment' ? 'Payment received' : 'Credit sale'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDateTime(t.timestamp)}</Text>
              </View>
              <Text style={{ color: t.type === 'payment' ? colors.success : colors.danger, fontWeight: '800' }}>
                {t.type === 'payment' ? '-' : '+'}
                {formatCurrency(t.amount)}
              </Text>
            </Card>
          ))
        )}

        <Text style={[styles.section, { color: colors.text }]}>Purchases</Text>
        {sales.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No purchases linked to this customer yet.</Text>
        ) : (
          sales.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => router.push({ pathname: '/sale/[id]', params: { id: s.id } })}
            >
              <Card style={styles.txnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {formatCurrency(s.finalAmount)}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {s.itemCount} item(s) · {formatDateTime(s.date)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card>
            </TouchableOpacity>
          ))
        )}

        {user?.role === 'owner' && (
          <Button title="Delete Customer" variant="danger" onPress={confirmDelete} style={{ marginTop: 20 }} />
        )}
      </ScrollView>

      {/* Payment modal */}
      <Modal visible={payOpen} transparent animationType="fade" onRequestClose={() => setPayOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
              Record Payment
            </Text>
            <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
              Due: {formatCurrency(customer.currentDue)}
            </Text>
            <TextInput
              placeholder="Amount received"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={payAmount}
              onChangeText={setPayAmount}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TouchableOpacity onPress={() => setPayAmount(String(customer.currentDue))} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                Pay full ({formatCurrency(customer.currentDue)})
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
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 14 }}>
              Edit Customer
            </Text>
            <Field label="Name *" value={editForm.name} onChangeText={(t) => setEditForm((f) => ({ ...f, name: t }))} />
            <Field label="Phone" value={editForm.phone} onChangeText={(t) => setEditForm((f) => ({ ...f, phone: t }))} keyboardType="phone-pad" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field label="Credit Limit (₹)" containerStyle={{ flex: 1 }} value={editForm.creditLimit} onChangeText={(t) => setEditForm((f) => ({ ...f, creditLimit: t }))} keyboardType="numeric" />
              <Field label="Discount %" containerStyle={{ flex: 1 }} value={editForm.discountPct} onChangeText={(t) => setEditForm((f) => ({ ...f, discountPct: t }))} keyboardType="numeric" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <Button title="Cancel" variant="outline" onPress={() => setEditOpen(false)} style={{ flex: 1 }} />
              <Button title="Save" onPress={submitEdit} loading={busy} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  dueBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  section: { fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' },
  sheet: { borderRadius: 18, padding: 20 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18 },
});
