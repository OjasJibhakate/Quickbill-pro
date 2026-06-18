import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  getProducts,
  getSuppliers,
  getSupplierById,
  saveSupplier,
  createPurchase,
} from '@/database/repo';
import { Product, Supplier } from '@/types';
import { formatCurrency, formatDateInput } from '@/utils/format';
import { newId } from '@/utils/id';
import { Button, Field, EmptyState } from '@/components/ui';

interface Line {
  key: string;
  product: Product;
  quantity: string;
  buyPrice: string;
  batchNo: string;
  expiry: string;
}

const isValidExpiry = (s: string): boolean => {
  if (!s.trim()) return true; // optional
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

export default function StockInScreen() {
  const params = useLocalSearchParams<{ supplierId?: string }>();
  const { colors } = useTheme();
  const { user, isOwner } = useAuth();
  const router = useRouter();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [paid, setPaid] = useState(true);
  const [busy, setBusy] = useState(false);

  const [supPickerOpen, setSupPickerOpen] = useState(false);
  const [prodPickerOpen, setProdPickerOpen] = useState(false);
  const [supSearch, setSupSearch] = useState('');
  const [prodSearch, setProdSearch] = useState('');
  const [newSupplier, setNewSupplier] = useState('');

  useEffect(() => {
    (async () => {
      const [sList, pList] = await Promise.all([getSuppliers(), getProducts()]);
      setSuppliers(sList);
      setProducts(pList);
      if (params.supplierId) {
        const s = await getSupplierById(String(params.supplierId));
        if (s) setSupplier(s);
      }
    })();
  }, [params.supplierId]);

  const total = lines.reduce(
    (s, l) => s + (parseFloat(l.buyPrice) || 0) * (parseInt(l.quantity, 10) || 0),
    0
  );

  const addLine = (product: Product) => {
    setLines((prev) => [
      ...prev,
      {
        key: newId('line'),
        product,
        quantity: '1',
        buyPrice: String(product.buyPrice || ''),
        batchNo: '',
        expiry: '',
      },
    ]);
    setProdPickerOpen(false);
    setProdSearch('');
  };

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const quickAddSupplier = async () => {
    if (!newSupplier.trim()) return;
    const id = await saveSupplier({ name: newSupplier.trim() });
    const list = await getSuppliers();
    setSuppliers(list);
    setNewSupplier('');
    const created = list.find((s) => s.id === id);
    if (created) setSupplier(created);
    setSupPickerOpen(false);
  };

  const save = async () => {
    if (!user) return;
    const valid = lines.filter((l) => (parseInt(l.quantity, 10) || 0) > 0);
    if (valid.length === 0) {
      dialog.alert('No items', 'Add at least one product with a quantity.');
      return;
    }
    for (const l of lines) {
      if (!isValidExpiry(l.expiry)) {
        dialog.alert('Invalid expiry', `Check the expiry date for ${l.product.name} (use YYYY-MM-DD).`);
        return;
      }
    }
    if (!paid && !supplier) {
      dialog.alert('Supplier needed', 'Select a supplier to record an on-credit purchase.');
      return;
    }
    setBusy(true);
    try {
      await createPurchase({
        supplierId: supplier?.id ?? null,
        userId: user.id,
        paid,
        lines: valid.map((l) => ({
          productId: l.product.id,
          quantity: parseInt(l.quantity, 10) || 0,
          buyPrice: parseFloat(l.buyPrice) || 0,
          batchNo: l.batchNo.trim() || null,
          expiryDate: l.expiry.trim() || null,
        })),
      });
      dialog.alert('Stock added', `${formatCurrency(total)} of stock recorded.`);
      router.back();
    } catch (e) {
      console.error(e);
      dialog.alert('Error', 'Could not record the stock-in.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <EmptyState icon="🔒" title="Owner only" subtitle="Only the owner can record stock-in." />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {/* Supplier */}
          <Text style={[styles.label, { color: colors.textMuted }]}>SUPPLIER</Text>
          <TouchableOpacity
            onPress={() => setSupPickerOpen(true)}
            style={[styles.selectRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="business-outline" size={20} color={colors.primary} />
            <Text style={{ color: supplier ? colors.text : colors.textMuted, flex: 1, fontWeight: '600' }}>
              {supplier ? supplier.name : 'Select supplier (optional)'}
            </Text>
            {supplier && (
              <TouchableOpacity onPress={() => setSupplier(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Items */}
          <View style={styles.itemsHead}>
            <Text style={[styles.label, { color: colors.textMuted, marginBottom: 0 }]}>ITEMS</Text>
            <TouchableOpacity
              onPress={() => setProdPickerOpen(true)}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Add product</Text>
            </TouchableOpacity>
          </View>

          {lines.length === 0 ? (
            <Text style={{ color: colors.textMuted, paddingVertical: 12 }}>
              No items yet. Tap "Add product" to receive stock.
            </Text>
          ) : (
            lines.map((l) => (
              <View key={l.key} style={[styles.lineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.lineHead}>
                  <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{l.product.name}</Text>
                  <TouchableOpacity onPress={() => removeLine(l.key)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Field
                    label="Qty"
                    containerStyle={{ flex: 1, marginBottom: 8 }}
                    value={l.quantity}
                    onChangeText={(t) => updateLine(l.key, { quantity: t.replace(/[^0-9]/g, '') })}
                    keyboardType="numeric"
                  />
                  <Field
                    label="Buy price"
                    containerStyle={{ flex: 1, marginBottom: 8 }}
                    value={l.buyPrice}
                    onChangeText={(t) => updateLine(l.key, { buyPrice: t })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Field
                    label="Batch no"
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                    value={l.batchNo}
                    onChangeText={(t) => updateLine(l.key, { batchNo: t })}
                    placeholder="Optional"
                  />
                  <Field
                    label="Expiry"
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                    value={l.expiry}
                    onChangeText={(t) => updateLine(l.key, { expiry: formatDateInput(t) })}
                    keyboardType="numeric"
                    maxLength={10}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
            ))
          )}

          {/* Payment */}
          <Text style={[styles.label, { color: colors.textMuted, marginTop: 18 }]}>PAYMENT</Text>
          <View style={[styles.toggle, { borderColor: colors.border }]}>
            {[
              { v: true, label: 'Paid now' },
              { v: false, label: 'On credit' },
            ].map((opt) => (
              <TouchableOpacity
                key={String(opt.v)}
                onPress={() => setPaid(opt.v)}
                style={[styles.toggleBtn, { backgroundColor: paid === opt.v ? colors.primary : 'transparent' }]}
              >
                <Text style={{ color: paid === opt.v ? '#FFF' : colors.text, fontWeight: '700' }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!paid && (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
              Adds {formatCurrency(total)} to the supplier's payable.
            </Text>
          )}

          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Total</Text>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
              {formatCurrency(total)}
            </Text>
          </View>

          <Button title="Save Stock-In" onPress={save} loading={busy} style={{ marginTop: 14 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Supplier picker */}
      <Modal visible={supPickerOpen} animationType="slide" onRequestClose={() => setSupPickerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Select Supplier</Text>
            <TouchableOpacity onPress={() => setSupPickerOpen(false)}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <View style={[styles.quickAdd, { borderColor: colors.border }]}>
              <Field
                value={newSupplier}
                onChangeText={setNewSupplier}
                placeholder="New supplier name"
                containerStyle={{ marginBottom: 8 }}
              />
              <Button title="Add & Select" onPress={quickAddSupplier} />
            </View>
          </View>
          <FlatList
            data={suppliers.filter(
              (s) => !supSearch || s.name.toLowerCase().includes(supSearch.toLowerCase())
            )}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListHeaderComponent={
              <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  placeholder="Search suppliers"
                  placeholderTextColor={colors.textMuted}
                  value={supSearch}
                  onChangeText={setSupSearch}
                  style={{ flex: 1, paddingVertical: 10, color: colors.text }}
                />
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setSupplier(item);
                  setSupPickerOpen(false);
                }}
                style={[styles.pickRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Product picker */}
      <Modal visible={prodPickerOpen} animationType="slide" onRequestClose={() => setProdPickerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Add Product</Text>
            <TouchableOpacity onPress={() => setProdPickerOpen(false)}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={products.filter(
              (p) => !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase())
            )}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12 }}
            ListHeaderComponent={
              <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  placeholder="Search products"
                  placeholderTextColor={colors.textMuted}
                  value={prodSearch}
                  onChangeText={setProdSearch}
                  style={{ flex: 1, paddingVertical: 10, color: colors.text }}
                />
              </View>
            }
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>
                No products. Add them in the Products tab first.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => addLine(item)}
                style={[styles.pickRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    In stock: {item.stock} {item.unit}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  itemsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  lineCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  lineHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  quickAdd: { borderWidth: 1, borderRadius: 12, padding: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  pickRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8 },
});
