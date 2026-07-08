import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { useReload } from '@/hooks/useReload';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';
import { computeTax } from '@/utils/tax';
import {
  getProducts,
  checkout,
  getCustomers,
  saveCustomer,
  getOpenShift,
  getProductByBarcode,
} from '@/database/repo';
import { Product, CartItem, PaymentMethod, Customer } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { newId } from '@/utils/id';
import { Button, Field } from '@/components/ui';
import { BarcodeScanner } from '@/components/BarcodeScanner';

type DiscountMode = 'amount' | 'percent';

interface HeldBill {
  id: string;
  items: CartItem[];
  discount: string;
  discountMode: DiscountMode;
  customer: Customer | null;
  custName: string;
  custPhone: string;
  custAddress: string;
  heldAt: string;
}

const HELD_KEY = 'qbp_held_bills';

export default function BillingScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { store } = useStore();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('amount');
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{
    amount: number;
    method: PaymentMethod;
    saleId: string;
  } | null>(null);
  const [showCustomer, setShowCustomer] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');

  // Saved-customer link (for udhaar / customer discount).
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Open shift (sales attach to it) + held bills.
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [held, setHeld] = useState<HeldBill[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  // When opened from the Home scanner with ?add=<productId>, add that product.
  const params = useLocalSearchParams<{ add?: string }>();
  const handledAdd = useRef<string | null>(null);

  const reload = useReload(async () => {
    const [prods, custs] = await Promise.all([getProducts(), getCustomers()]);
    setProducts(prods);
    setCustomers(custs);
    if (user) setShiftId((await getOpenShift(user.id))?.id ?? null);
  });

  // Restore held bills once, then persist whenever they change.
  useEffect(() => {
    AsyncStorage.getItem(HELD_KEY)
      .then((raw) => {
        if (raw) setHeld(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(HELD_KEY, JSON.stringify(held)).catch(() => {});
  }, [held]);

  const holdBill = () => {
    if (cart.length === 0) return;
    const bill: HeldBill = {
      id: newId('held'),
      items: cart,
      discount,
      discountMode,
      customer,
      custName,
      custPhone,
      custAddress,
      heldAt: new Date().toISOString(),
    };
    setHeld((prev) => [bill, ...prev]);
    clearCart();
  };

  const applyHeld = (bill: HeldBill) => {
    setCart(bill.items);
    setDiscount(bill.discount);
    setDiscountMode(bill.discountMode);
    setCustomer(bill.customer);
    setCustName(bill.custName);
    setCustPhone(bill.custPhone);
    setCustAddress(bill.custAddress);
    setHeld((prev) => prev.filter((b) => b.id !== bill.id));
    setHeldOpen(false);
  };

  const resumeBill = (bill: HeldBill) => {
    if (cart.length > 0) {
      dialog.alert('Cart not empty', 'Hold the current cart and open this one?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hold & Open',
          onPress: () => {
            holdBill();
            applyHeld(bill);
          },
        },
      ]);
    } else {
      applyHeld(bill);
    }
  };

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
  // GST (and service charge, if configured) added on top of the discounted total.
  const bill = useMemo(
    () => computeTax(total, store.gstRate, store.serviceCharge),
    [total, store.gstRate, store.serviceCharge]
  );
  const grandTotal = bill.grandTotal;

  // Owner is unlimited; employees are capped per line by the product's own
  // max discount when set, otherwise by their global limit.
  const maxDiscountAllowed = useMemo(() => {
    if (user?.role === 'owner') return subtotal;
    return cart.reduce((sum, it) => {
      const cap = it.product.maxDiscount ?? user?.maxDiscount ?? 0;
      return sum + (it.product.sellPrice * it.quantity * cap) / 100;
    }, 0);
  }, [cart, subtotal, user]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      dialog.alert('Out of stock', `${product.name} has no stock left.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          dialog.alert('Limit reached', `Only ${product.stock} in stock.`);
          return prev;
        }
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Add a product passed in from the Home scanner (?add=<productId>).
  useEffect(() => {
    if (params.add && params.add !== handledAdd.current) {
      handledAdd.current = String(params.add);
      const p = products.find((x) => x.id === params.add);
      if (p) addToCart(p);
    }
  }, [params.add, products]);

  const onScanned = async (code: string) => {
    setScanOpen(false);
    const found = products.find((p) => p.barcode === code) ?? (await getProductByBarcode(code));
    if (found) {
      addToCart(found);
    } else {
      dialog.alert('Not found', `No product has the barcode ${code}. Add it in Products first.`);
    }
  };

  // Desktop USB barcode scanner (web): a scan adds the product directly.
  useBarcodeWedge(async (code: string) => {
    const found = products.find((p) => p.barcode === code) ?? (await getProductByBarcode(code));
    if (found) {
      addToCart(found);
      setSearch('');
    }
  });

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== id) return c;
          const q = c.quantity + delta;
          if (q > c.product.stock) {
            dialog.alert('Limit reached', `Only ${c.product.stock} in stock.`);
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
    setShowCustomer(false);
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustomer(null);
  };

  const selectCustomer = (c: Customer) => {
    setCustomer(c);
    setPickerOpen(false);
    setShowCustomer(false);
    setCustName('');
    setCustPhone('');
    // Auto-apply the customer's standing discount if none typed yet.
    if (c.discountPct > 0 && !discount) {
      setDiscountMode('percent');
      setDiscount(String(c.discountPct));
    }
  };

  const quickAddCustomer = async () => {
    if (!newName.trim()) {
      dialog.alert('Missing name', 'Enter a customer name.');
      return;
    }
    const id = await saveCustomer({
      name: newName.trim(),
      phone: newPhone.trim() || null,
      creditLimit: 0,
      discountPct: 0,
    });
    const list = await getCustomers();
    setCustomers(list);
    setNewName('');
    setNewPhone('');
    const created = list.find((c) => c.id === id);
    if (created) selectCustomer(created);
  };

  const confirmPayment = async (method: PaymentMethod) => {
    if (!user) return;
    if (discountValue > maxDiscountAllowed + 0.001) {
      setPayOpen(false);
      dialog.alert(
        'Discount too high',
        `You may only discount up to ${user.maxDiscount}% (${formatCurrency(
          maxDiscountAllowed
        )}).`
      );
      return;
    }
    // Udhaar must be tied to a saved customer, and must respect their limit.
    if (method === 'credit') {
      if (!customer) {
        setPayOpen(false);
        dialog.alert('Customer needed', 'Select a saved customer to put this bill on udhaar.');
        return;
      }
      if (customer.creditLimit > 0 && customer.currentDue + grandTotal > customer.creditLimit) {
        setPayOpen(false);
        dialog.alert(
          'Credit limit exceeded',
          `${customer.name} can owe up to ${formatCurrency(customer.creditLimit)}. Current due is ${formatCurrency(
            customer.currentDue
          )}.`
        );
        return;
      }
    }
    setBusy(true);
    try {
      const charged = grandTotal;
      const saleId = await checkout({
        items: cart,
        discountAmount: discountValue,
        paymentMethod: method,
        userId: user.id,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? custName,
        customerPhone: customer?.phone ?? custPhone,
        customerAddress: custAddress,
        shiftId,
        serviceChargeAmount: bill.serviceCharge,
        taxAmount: bill.tax,
      });
      setPayOpen(false);
      clearCart();
      reload();
      setSuccess({ amount: charged, method, saleId });
    } catch (e) {
      console.error(e);
      dialog.alert('Error', 'Could not complete the sale.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
          <TouchableOpacity onPress={() => setScanOpen(true)} hitSlop={8}>
            <Ionicons name="barcode-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {held.length > 0 && (
          <TouchableOpacity
            onPress={() => setHeldOpen(true)}
            style={[styles.heldBanner, { backgroundColor: colors.warning + '22', borderColor: colors.warning }]}
          >
            <Ionicons name="pause-circle-outline" size={18} color={colors.warning} />
            <Text style={{ color: colors.warning, fontWeight: '700', flex: 1 }}>
              {held.length} bill{held.length > 1 ? 's' : ''} on hold
            </Text>
            <Text style={{ color: colors.warning, fontWeight: '700' }}>Resume ›</Text>
          </TouchableOpacity>
        )}

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

            {bill.serviceCharge > 0 && (
              <View style={styles.sumRow}>
                <Text style={{ color: colors.textMuted }}>Service charge ({bill.serviceRate}%)</Text>
                <Text style={{ color: colors.text }}>{formatCurrency(bill.serviceCharge)}</Text>
              </View>
            )}
            {bill.tax > 0 && (
              <>
                <View style={styles.sumRow}>
                  <Text style={{ color: colors.textMuted }}>CGST ({bill.gstRate / 2}%)</Text>
                  <Text style={{ color: colors.text }}>{formatCurrency(bill.halfTax)}</Text>
                </View>
                <View style={styles.sumRow}>
                  <Text style={{ color: colors.textMuted }}>SGST ({bill.gstRate / 2}%)</Text>
                  <Text style={{ color: colors.text }}>{formatCurrency(bill.halfTax)}</Text>
                </View>
              </>
            )}

            <View style={[styles.sumRow, { marginTop: 4 }]}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Total</Text>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
                {formatCurrency(grandTotal)}
              </Text>
            </View>
            {/* Saved customer chip, or: add name first (frequent), then credit/udhaar link */}
            {customer ? (
              <View style={[styles.custChip, { borderColor: colors.border }]}>
                <Ionicons name="person-circle" size={28} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{customer.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {customer.currentDue > 0 ? `Due ${formatCurrency(customer.currentDue)}` : 'No dues'}
                    {customer.discountPct > 0 ? ` · ${customer.discountPct}% off` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setCustomer(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Add name / phone for the invoice — most frequent, so shown first */}
                <TouchableOpacity onPress={() => setShowCustomer((v) => !v)} style={styles.customerToggle}>
                  <Ionicons
                    name={showCustomer ? 'chevron-down' : 'chevron-forward'}
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {custName || custPhone
                      ? `Walk-in: ${custName || custPhone}`
                      : 'Add name / phone for invoice (optional)'}
                  </Text>
                </TouchableOpacity>
                {showCustomer && (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    <TextInput
                      placeholder="Name"
                      placeholderTextColor={colors.textMuted}
                      value={custName}
                      onChangeText={setCustName}
                      style={[styles.custInput, { color: colors.text, borderColor: colors.border }]}
                    />
                    <TextInput
                      placeholder="Phone (for WhatsApp invoice)"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      value={custPhone}
                      onChangeText={setCustPhone}
                      style={[styles.custInput, { color: colors.text, borderColor: colors.border }]}
                    />
                    <TextInput
                      placeholder="Address"
                      placeholderTextColor={colors.textMuted}
                      value={custAddress}
                      onChangeText={setCustAddress}
                      style={[styles.custInput, { color: colors.text, borderColor: colors.border }]}
                    />
                  </View>
                )}

                {/* Then link a saved customer for credit / udhaar / loan */}
                <TouchableOpacity
                  style={[styles.customerToggle, { marginTop: 4 }]}
                  onPress={() => setPickerOpen(true)}
                >
                  <Ionicons name="person-add-outline" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    Add customer (credit / udhaar / loan)
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button title="Clear" variant="outline" onPress={clearCart} style={{ flex: 1 }} />
              <Button title="Hold" variant="outline" onPress={holdBill} style={{ flex: 1 }} />
              <Button title="Charge" variant="success" onPress={() => setPayOpen(true)} style={{ flex: 2 }} />
            </View>
          </View>
        )}
      </View>
      </KeyboardAvoidingView>

      {/* Payment method picker */}
      <Modal visible={payOpen} transparent animationType="slide" onRequestClose={() => setPayOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Collect {formatCurrency(grandTotal)}
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
            <Button
              title="Share Invoice"
              onPress={() => {
                const sid = success?.saleId;
                setSuccess(null);
                if (sid) router.push({ pathname: '/invoice/[id]', params: { id: sid } });
              }}
              style={{ alignSelf: 'stretch' }}
            />
            <Button
              title="Done"
              variant="outline"
              onPress={() => setSuccess(null)}
              style={{ alignSelf: 'stretch', marginTop: 10 }}
            />
          </View>
        </View>
      </Modal>

      {/* Customer picker */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.pickerHeader, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Select Customer</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16 }}>
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                placeholder="Search customers"
                placeholderTextColor={colors.textMuted}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>

            <View style={[styles.quickAdd, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                NEW CUSTOMER
              </Text>
              <Field
                value={newName}
                onChangeText={setNewName}
                placeholder="Name"
                containerStyle={{ marginBottom: 8 }}
              />
              <Field
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="Phone (optional)"
                keyboardType="phone-pad"
                containerStyle={{ marginBottom: 8 }}
              />
              <Button title="Add & Select" onPress={quickAddCustomer} />
            </View>
          </View>

          <FlatList
            data={customers.filter((c) => {
              const q = pickerSearch.trim().toLowerCase();
              return !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q);
            })}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>
                No customers. Add one above.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => selectCustomer(item)}
                style={[styles.pickerRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {item.phone || 'No phone'}
                    {item.currentDue > 0 ? ` · Due ${formatCurrency(item.currentDue)}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Held bills */}
      <Modal visible={heldOpen} animationType="slide" onRequestClose={() => setHeldOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.pickerHeader, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Held Bills</Text>
            <TouchableOpacity onPress={() => setHeldOpen(false)}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={held}
            keyExtractor={(b) => b.id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>
                No bills on hold.
              </Text>
            }
            renderItem={({ item }) => {
              const billTotal = item.items.reduce((s, it) => s + it.product.sellPrice * it.quantity, 0);
              const count = item.items.reduce((s, it) => s + it.quantity, 0);
              return (
                <TouchableOpacity
                  onPress={() => resumeBill(item)}
                  style={[styles.pickerRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {formatCurrency(billTotal)} · {count} item{count > 1 ? 's' : ''}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {item.customer?.name || item.custName || 'Walk-in'} · held {formatDateTime(item.heldAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setHeld((prev) => prev.filter((b) => b.id !== item.id))}
                    hitSlop={8}
                    style={{ marginRight: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                  <Ionicons name="arrow-forward-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <BarcodeScanner
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={onScanned}
        title="Scan a product barcode to add it to the bill"
      />
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
  heldBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  customerToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  custInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  custChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  quickAdd: { borderWidth: 1, borderRadius: 12, padding: 12 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
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
