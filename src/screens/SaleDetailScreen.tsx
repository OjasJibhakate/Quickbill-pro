import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { getSaleDetail, updateSale, deleteSale, SaleDetail } from '@/database/repo';
import { Sale } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { Card, Button } from '@/components/ui';

interface EditLine {
  productId: string;
  name: string;
  unit: string;
  origPrice: number; // unit price as originally billed
  price: number; // current (possibly edited) unit price
  priceStr: string; // raw text in the price field
  origQty: number; // quantity as originally billed
  quantity: number;
  maxQty: number; // how high we can go without driving stock negative
  deleted: boolean; // product no longer exists
}

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isOwner } = useAuth();
  const router = useRouter();
  const canEdit = isOwner || !!user?.canEditBills;

  const [sale, setSale] = useState<Sale | null>(null);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const detail: SaleDetail | null = id ? await getSaleDetail(id) : null;
      if (detail) {
        setSale(detail.sale);
        setLines(
          detail.items.map((it) => ({
            productId: it.productId,
            name: it.name ?? 'Deleted product',
            unit: it.unit ?? '',
            origPrice: it.priceAtSale,
            price: it.priceAtSale,
            priceStr: String(it.priceAtSale),
            origQty: it.quantity,
            quantity: it.quantity,
            // Can restore up to current stock plus what this sale already holds.
            maxQty: it.currentStock != null ? it.currentStock + it.quantity : it.quantity,
            deleted: it.currentStock == null,
          }))
        );
      }
      setLoading(false);
    })();
  }, [id]);

  const setQty = (productId: string, qty: number) =>
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, quantity: Math.max(0, Math.min(qty, l.maxQty)) } : l
      )
    );

  const setPrice = (productId: string, text: string) => {
    // Allow only digits and a single decimal point.
    const clean = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, priceStr: clean, price: parseFloat(clean) || 0 } : l
      )
    );
  };

  const newTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const discount = sale ? Math.min(sale.discountAmount, newTotal) : 0;
  const newFinal = newTotal - discount;
  const changed = lines.some((l) => l.quantity !== l.origQty || l.price !== l.origPrice);

  const save = async () => {
    if (!sale || !user) return;
    setSaving(true);
    try {
      await updateSale(
        sale.id,
        lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          priceAtSale: l.price,
        })),
        user.id
      );
      router.back();
    } catch (e) {
      console.error(e);
      dialog.alert('Error', 'Could not update the sale.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!sale || !user) return;
    dialog.alert(
      'Delete sale',
      'This removes the bill and returns all its items to stock. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSale(sale.id, user.id);
            router.back();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Sale not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Card style={{ marginBottom: 14 }}>
          <View style={styles.rowBetween}>
            <Text style={{ color: colors.textMuted }}>{formatDateTime(sale.date)}</Text>
            <View style={[styles.badge, { backgroundColor: colors.primary + '22' }]}>
              <Text style={{ color: colors.primary, fontWeight: '700', textTransform: 'uppercase' }}>
                {sale.paymentMethod}
              </Text>
            </View>
          </View>
          {(sale.customerName || sale.customerPhone || sale.customerAddress) && (
            <View style={{ marginTop: 10, gap: 2 }}>
              {sale.customerName ? (
                <Text style={{ color: colors.text, fontWeight: '700' }}>{sale.customerName}</Text>
              ) : null}
              {sale.customerPhone ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>📞 {sale.customerPhone}</Text>
              ) : null}
              {sale.customerAddress ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>📍 {sale.customerAddress}</Text>
              ) : null}
            </View>
          )}
        </Card>

        <Text style={[styles.section, { color: colors.text }]}>Items</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>
          {canEdit
            ? 'Adjust quantity for returns or corrections. Set to 0 to remove an item. Tap a price to give extra discount or correct it.'
            : 'Bill details (read-only). Ask the owner for edit access.'}
        </Text>

        {lines.map((l) => (
          <Card key={l.productId} style={[styles.itemRow, { opacity: l.quantity === 0 ? 0.5 : 1 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{l.name}</Text>
              <View style={styles.priceRow}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>₹</Text>
                {canEdit ? (
                  <TextInput
                    value={l.priceStr}
                    onChangeText={(t) => setPrice(l.productId, t)}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.priceInput,
                      { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                    ]}
                  />
                ) : (
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{l.price}</Text>
                )}
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  each{l.price !== l.origPrice ? ` · was ${formatCurrency(l.origPrice)}` : ''}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {l.deleted ? 'product deleted' : `up to ${l.maxQty} ${l.unit}`}
              </Text>
              <Text style={{ color: colors.text, fontSize: 12, marginTop: 2 }}>
                Line: {formatCurrency(l.price * l.quantity)}
              </Text>
            </View>
            <View style={styles.qtyControls}>
              {canEdit ? (
                <>
                  <TouchableOpacity onPress={() => setQty(l.productId, l.quantity - 1)}>
                    <Ionicons name="remove-circle-outline" size={28} color={colors.danger} />
                  </TouchableOpacity>
                  <Text style={{ color: colors.text, fontWeight: '800', minWidth: 26, textAlign: 'center' }}>
                    {l.quantity}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setQty(l.productId, l.quantity + 1)}
                    disabled={l.quantity >= l.maxQty}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={28}
                      color={l.quantity >= l.maxQty ? colors.textMuted : colors.success}
                    />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>×{l.quantity}</Text>
              )}
            </View>
          </Card>
        ))}

        <Card style={{ marginTop: 8 }}>
          <Row label="Subtotal" value={formatCurrency(newTotal)} colors={colors} />
          <Row label="Discount" value={`- ${formatCurrency(discount)}`} colors={colors} />
          <View style={[styles.rowBetween, { marginTop: 6 }]}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Total</Text>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
              {formatCurrency(newFinal)}
            </Text>
          </View>
          {changed && (
            <Text style={{ color: colors.warning, fontSize: 12, marginTop: 6 }}>
              Was {formatCurrency(sale.finalAmount)} — stock and totals update on save.
            </Text>
          )}
        </Card>

        {canEdit && (
          <Button
            title={changed ? 'Save Changes' : 'No Changes'}
            onPress={save}
            loading={saving}
            disabled={!changed}
            style={{ marginTop: 16 }}
          />
        )}

        <Button
          title="Share Invoice"
          variant="outline"
          onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: sale.id } })}
          style={{ marginTop: 10 }}
        />

        {isOwner && (
          <Button
            title="Delete Sale (full return)"
            variant="danger"
            onPress={confirmDelete}
            style={{ marginTop: 10 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) => (
  <View style={styles.rowBetween}>
    <Text style={{ color: colors.textMuted }}>{label}</Text>
    <Text style={{ color: colors.text }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  section: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  priceInput: {
    minWidth: 64,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '700',
  },
});
