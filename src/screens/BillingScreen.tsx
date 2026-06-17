import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useReload } from '@/hooks/useReload';
import { getProducts, checkout } from '@/database/repo';
import { Product, CartItem, PaymentMethod } from '@/types';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui';

type DiscountMode = 'amount' | 'percent';

export default function BillingScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('amount');
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ amount: number; method: PaymentMethod } | null>(
    null
  );

  const reload = useReload(async () => {
    setProducts(await getProducts());
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q)
    );
  }, [products, search]);

  const subtotal = useMemo(
    () => cart.reduce((s, it) => s + it.product.sellPrice * it.quantity, 0),
    [cart]
  );

  // Resolve whatever the cashier typed (₹ or %) into an absolute rupee value.
  const discountValue = useMemo(() => {
    const raw = parseFloat(discount) || 0;
    if (raw <= 0) return 0;
    const val = discountMode === 'percent' ? (subtotal * raw) / 100 : raw;
    return Math.min(Math.max(val, 0), subtotal);
  }, [discount, discountMode, subtotal]);

  const discountPct = subtotal > 0 ? (discountValue / subtotal) * 100 : 0;
  const total = subtotal - discountValue;
  const maxDiscountAllowed = subtotal * ((user?.maxDiscount ?? 0) / 100);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      Alert.alert('Out of stock', `${product.name} has no stock left.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          Alert.alert('Limit reached', `Only ${product.stock} in stock.`);
          return prev;
        }
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== id) return c;
          const q = c.quantity + delta;
          if (q > c.product.stock) {
            Alert.alert('Limit reached', `Only ${c.product.stock} in stock.`);
            return c;
          }
          return { ...c, quantity: q };
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscount('');
  };

  const confirmPayment = async (method: PaymentMethod) => {
    if (!user) return;
    if (discountValue > maxDiscountAllowed + 0.001) {
      setPayOpen(false);
      Alert.alert(
        'Discount too high',
        `You may only discount up to ${user.maxDiscount}% (${formatCurrency(
          maxDiscountAllowed
        )}).`
      );
      return;
    }
    setBusy(true);
    try {
      const charged = total;
      await checkout({
        items: cart,
        discountAmount: discountValue,
        paymentMethod: method,
        userId: user.id,
      });
      setPayOpen(false);
      clearCart();
      reload();
      setSuccess({ amount: charged, method });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not complete the sale.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 16 }}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search product or barcode"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          style={{ flexGrow: 0, maxHeight: 220 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, padding: 12 }}>
              No products. Add some in the Products tab.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.prodRow, { borderColor: colors.border }]}
              onPress={() => addToCart(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {formatCurrency(item.sellPrice)} · {item.stock} {item.unit} left
                </Text>
              </View>
              <Ionicons name="add-circle" size={26} color={colors.primary} />
            </TouchableOpacity>
          )}
        />

        <Text style={[styles.cartTitle, { color: colors.text }]}>
          Cart ({cart.reduce((s, c) => s + c.quantity, 0)})
        </Text>

        <FlatList
          data={cart}
          keyExtractor={(c) => c.product.id}
          style={{ flex: 1 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, paddingVertical: 20, textAlign: 'center' }}>
              Tap a product above to add it to the bill.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.cartRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{item.product.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {formatCurrency(item.product.sellPrice)} each
                </Text>
              </View>
              <View style={styles.qtyControls}>
                <TouchableOpacity onPress={() => changeQty(item.product.id, -1)}>
                  <Ionicons name="remove-circle-outline" size={26} color={colors.danger} />
                </TouchableOpacity>
                <Text style={{ color: colors.text, fontWeight: '700', minWidth: 24, textAlign: 'center' }}>
                  {item.quantity}
                </Text>
                <TouchableOpacity onPress={() => changeQty(item.product.id, 1)}>
                  <Ionicons name="add-circle-outline" size={26} color={colors.success} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.text, fontWeight: '700', minWidth: 78, textAlign: 'right' }}>
                {formatCurrency(item.product.sellPrice * item.quantity)}
              </Text>
            </View>
          )}
        />

        {cart.length > 0 && (
          <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sumRow}>
              <Text style={{ color: colors.textMuted }}>Subtotal</Text>
              <Text style={{ color: colors.text }}>{formatCurrency(subtotal)}</Text>
            </View>

            <View style={styles.sumRow}>
              <Text style={{ color: colors.textMuted }}>Discount</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.toggle, { borderColor: colors.border }]}>
                  {(['amount', 'percent'] as DiscountMode[]).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setDiscountMode(m)}
                      style={[
                        styles.toggleBtn,
                        discountMode === m && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={{
                          color: discountMode === m ? '#FFF' : colors.textMuted,
                          fontWeight: '700',
                        }}
                      >
                        {m === 'amount' ? '₹' : '%'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={discount}
                  onChangeText={setDiscount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.discountInput, { color: colors.text, borderColor: colors.border }]}
                />
              </View>
            </View>

            {discountValue > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'right' }}>
                {discountMode === 'amount'
                  ? `≈ ${discountPct.toFixed(1)}% off`
                  : `= ${formatCurrency(discountValue)} off`}
              </Text>
            )}

            <View style={[styles.sumRow, { marginTop: 4 }]}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Total</Text>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
                {formatCurrency(total)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button title="Clear" variant="outline" onPress={clearCart} style={{ flex: 1 }} />
              <Button title="Charge" variant="success" onPress={() => setPayOpen(true)} style={{ flex: 2 }} />
            </View>
          </View>
        )}
      </View>

      {/* Payment method picker */}
      <Modal visible={payOpen} transparent animationType="slide" onRequestClose={() => setPayOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Collect {formatCurrency(total)}
            </Text>
            <Text style={{ color: colors.textMuted, marginBottom: 16 }}>Select payment method</Text>
            <ScrollView>
              {(['cash', 'upi', 'card', 'credit'] as PaymentMethod[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  disabled={busy}
                  onPress={() => confirmPayment(m)}
                  style={[styles.payOption, { borderColor: colors.border }]}
                >
                  <Ionicons
                    name={
                      m === 'cash'
                        ? 'cash-outline'
                        : m === 'upi'
                        ? 'phone-portrait-outline'
                        : m === 'card'
                        ? 'card-outline'
                        : 'time-outline'
                    }
                    size={22}
                    color={colors.primary}
                  />
                  <Text style={{ color: colors.text, fontWeight: '600', textTransform: 'uppercase' }}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button title="Cancel" variant="outline" onPress={() => setPayOpen(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>

      {/* Themed success confirmation (replaces the native "charged" alert) */}
      <Modal visible={!!success} transparent animationType="fade" onRequestClose={() => setSuccess(null)}>
        <View style={styles.centerBackdrop}>
          <View style={[styles.successCard, { backgroundColor: colors.card }]}>
            <View style={[styles.successIcon, { backgroundColor: colors.success + '22' }]}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Payment Received</Text>
            <Text style={[styles.successAmount, { color: colors.success }]}>
              {formatCurrency(success?.amount ?? 0)}
            </Text>
            <Text style={{ color: colors.textMuted, marginBottom: 20 }}>
              Paid via {success?.method.toUpperCase()}
            </Text>
            <Button title="Done" variant="success" onPress={() => setSuccess(null)} style={{ alignSelf: 'stretch' }} />
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
  prodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  cartTitle: { fontSize: 16, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  cartRow: {
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
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 4, minWidth: 34, alignItems: 'center' },
  discountInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 80,
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
  centerBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0009',
    padding: 32,
  },
  successCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: { fontSize: 18, fontWeight: '700' },
  successAmount: { fontSize: 32, fontWeight: '800', marginVertical: 4 },
});
