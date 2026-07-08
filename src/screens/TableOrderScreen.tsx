import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useReload } from '@/hooks/useReload';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';
import {
  getProducts,
  getProductByBarcode,
  getTable,
  getTableOrder,
  addToTableOrder,
  setTableOrderQty,
  clearTableOrder,
  settleTable,
  getOpenShift,
} from '@/database/repo';
import { Product, TableOrderLine, PaymentMethod } from '@/types';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui';

export default function TableOrderScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tableId = String(id);

  const [tableName, setTableName] = useState('Table');
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<TableOrderLine[]>([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState('');
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useReload(async () => {
    const [prods, ord, table] = await Promise.all([
      getProducts(),
      getTableOrder(tableId),
      getTable(tableId),
    ]);
    setProducts(prods);
    setOrder(ord);
    if (table) setTableName(table.name);
    if (user) setShiftId((await getOpenShift(user.id))?.id ?? null);
  });

  useEffect(() => {
    navigation.setOptions({ title: tableName });
  }, [navigation, tableName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const subtotal = useMemo(() => order.reduce((s, o) => s + o.price * o.quantity, 0), [order]);
  const discountValue = useMemo(() => {
    const raw = parseFloat(discount) || 0;
    return Math.min(Math.max(raw, 0), subtotal);
  }, [discount, subtotal]);
  const total = subtotal - discountValue;
  const itemCount = order.reduce((s, o) => s + o.quantity, 0);

  const add = async (p: Product) => {
    await addToTableOrder(tableId, p);
    reload();
  };

  // Desktop USB barcode scanner (web): a scan adds the item to this table.
  useBarcodeWedge(async (code: string) => {
    const p = products.find((x) => x.barcode === code) ?? (await getProductByBarcode(code));
    if (p) {
      await addToTableOrder(tableId, p);
      reload();
    }
  });
  const changeQty = async (line: TableOrderLine, delta: number) => {
    await setTableOrderQty(line.id, line.quantity + delta);
    reload();
  };

  const clearAll = () => {
    if (order.length === 0) return;
    dialog.alert('Clear order', `Remove all items from ${tableName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearTableOrder(tableId);
          reload();
        },
      },
    ]);
  };

  const settle = async (method: PaymentMethod) => {
    if (!user) return;
    setBusy(true);
    try {
      const saleId = await settleTable({
        tableId,
        discountAmount: discountValue,
        paymentMethod: method,
        userId: user.id,
        customerName: tableName,
        shiftId,
      });
      setPayOpen(false);
      setBusy(false);
      if (!saleId) {
        router.back();
        return;
      }
      dialog.alert('Table settled', `${tableName} · ${formatCurrency(total)} collected.`, [
        {
          text: 'Share bill',
          onPress: () => {
            router.replace({ pathname: '/invoice/[id]', params: { id: saleId } });
          },
        },
        { text: 'Done', style: 'cancel', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error(e);
      setBusy(false);
      dialog.alert('Error', 'Could not settle the table.');
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, padding: 16 }}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Search dishes / items to add"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            style={{ flexGrow: 0, maxHeight: 200 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, padding: 12 }}>
                No items. Add them in the Menu tab.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.prodRow, { borderColor: colors.border }]}
                onPress={() => add(item)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {formatCurrency(item.sellPrice)}
                    {item.category ? ` · ${item.category}` : ''}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={26} color={colors.primary} />
              </TouchableOpacity>
            )}
          />

          <Text style={[styles.orderTitle, { color: colors.text }]}>Order ({itemCount})</Text>

          <FlatList
            data={order}
            keyExtractor={(o) => o.id}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, paddingVertical: 20, textAlign: 'center' }}>
                Tap an item above to add it to this table.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.orderRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {formatCurrency(item.price)} each
                  </Text>
                </View>
                <View style={styles.qtyControls}>
                  <TouchableOpacity onPress={() => changeQty(item, -1)}>
                    <Ionicons name="remove-circle-outline" size={26} color={colors.danger} />
                  </TouchableOpacity>
                  <Text style={{ color: colors.text, fontWeight: '700', minWidth: 24, textAlign: 'center' }}>
                    {item.quantity}
                  </Text>
                  <TouchableOpacity onPress={() => changeQty(item, 1)}>
                    <Ionicons name="add-circle-outline" size={26} color={colors.success} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: colors.text, fontWeight: '700', minWidth: 74, textAlign: 'right' }}>
                  {formatCurrency(item.price * item.quantity)}
                </Text>
              </View>
            )}
          />

          {order.length > 0 && (
            <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sumRow}>
                <Text style={{ color: colors.textMuted }}>Subtotal</Text>
                <Text style={{ color: colors.text }}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={{ color: colors.textMuted }}>Discount (₹)</Text>
                <TextInput
                  value={discount}
                  onChangeText={setDiscount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.discountInput, { color: colors.text, borderColor: colors.border }]}
                />
              </View>
              <View style={[styles.sumRow, { marginTop: 4 }]}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Total</Text>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
                  {formatCurrency(total)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Button title="Clear" variant="outline" onPress={clearAll} style={{ flex: 1 }} />
                <Button
                  title="Settle & Pay"
                  variant="success"
                  onPress={() => setPayOpen(true)}
                  style={{ flex: 2 }}
                />
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Payment method picker */}
      <Modal visible={payOpen} transparent animationType="slide" onRequestClose={() => setPayOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Collect {formatCurrency(total)}</Text>
            <Text style={{ color: colors.textMuted, marginBottom: 16 }}>Select payment method</Text>
            <ScrollView>
              {(['cash', 'upi', 'card'] as PaymentMethod[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  disabled={busy}
                  onPress={() => settle(m)}
                  style={[styles.payOption, { borderColor: colors.border }]}
                >
                  <Ionicons
                    name={m === 'cash' ? 'cash-outline' : m === 'upi' ? 'phone-portrait-outline' : 'card-outline'}
                    size={22}
                    color={colors.primary}
                  />
                  <Text style={{ color: colors.text, fontWeight: '600', textTransform: 'uppercase' }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button title="Cancel" variant="outline" onPress={() => setPayOpen(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
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
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  prodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  orderTitle: { fontSize: 16, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summary: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  discountInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 90,
    textAlign: 'right',
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
});
