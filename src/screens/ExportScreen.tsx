import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { getSales, getProducts, getCustomers } from '@/database/repo';
import { exportXlsx, ExportSheet } from '@/utils/share';
import { formatDateTime, formatDate } from '@/utils/format';
import { Card, EmptyState } from '@/components/ui';

export default function ExportScreen() {
  const { colors } = useTheme();
  const { isOwner } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  if (!isOwner) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState icon="🔒" title="Owner only" subtitle="Only the owner can export data." />
      </View>
    );
  }

  const salesSheet = async (): Promise<ExportSheet> => {
    const sales = await getSales(2000);
    return {
      name: 'Sales',
      rows: sales.map((s) => ({
        Date: formatDateTime(s.date),
        Invoice: s.id.replace(/^sale-/, '').slice(0, 8).toUpperCase(),
        Customer: s.customerName ?? '',
        Phone: s.customerPhone ?? '',
        Payment: s.paymentMethod.toUpperCase(),
        Items: s.itemCount,
        Subtotal: s.totalAmount,
        Discount: s.discountAmount,
        Total: s.finalAmount,
      })),
    };
  };

  const inventorySheet = async (): Promise<ExportSheet> => {
    const products = await getProducts();
    return {
      name: 'Inventory',
      rows: products.map((p) => ({
        Name: p.name,
        Category: p.category ?? '',
        Unit: p.unit,
        Stock: p.stock,
        BuyPrice: p.buyPrice,
        SellPrice: p.sellPrice,
        Margin: p.sellPrice - p.buyPrice,
        StockValue: p.buyPrice * p.stock,
        Barcode: p.barcode ?? '',
        Expiry: p.expiryDate ? formatDate(p.expiryDate) : '',
      })),
    };
  };

  const customersSheet = async (): Promise<ExportSheet> => {
    const customers = await getCustomers();
    return {
      name: 'Customers',
      rows: customers.map((c) => ({
        Name: c.name,
        Phone: c.phone ?? '',
        CreditLimit: c.creditLimit,
        CurrentDue: c.currentDue,
        DiscountPct: c.discountPct,
      })),
    };
  };

  const run = async (key: string, build: () => Promise<ExportSheet[]>, file: string) => {
    setBusy(key);
    try {
      const sheets = await build();
      await exportXlsx(file, sheets);
    } catch (e) {
      console.error(e);
      dialog.alert('Export failed', 'Could not create the Excel file.');
    } finally {
      setBusy(null);
    }
  };

  const date = new Date().toISOString().slice(0, 10);

  const options: { key: string; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; build: () => Promise<ExportSheet[]>; file: string }[] = [
    { key: 'sales', label: 'Sales', sub: 'Every bill with totals & payment', icon: 'cart-outline', build: async () => [await salesSheet()], file: `quickbill-sales-${date}` },
    { key: 'inventory', label: 'Inventory', sub: 'Products, stock & stock value', icon: 'cube-outline', build: async () => [await inventorySheet()], file: `quickbill-inventory-${date}` },
    { key: 'customers', label: 'Customers', sub: 'Khata, dues & credit limits', icon: 'people-outline', build: async () => [await customersSheet()], file: `quickbill-customers-${date}` },
    {
      key: 'all',
      label: 'Everything (one file)',
      sub: 'Sales + Inventory + Customers',
      icon: 'documents-outline',
      build: async () => [await salesSheet(), await inventorySheet(), await customersSheet()],
      file: `quickbill-backup-${date}`,
    },
  ];

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
          Export your data to Excel (.xlsx) and share it via Drive, email, or WhatsApp — perfect for your accountant.
        </Text>
        {options.map((o) => (
          <TouchableOpacity key={o.key} disabled={!!busy} onPress={() => run(o.key, o.build, o.file)}>
            <Card style={styles.row}>
              <View style={[styles.icon, { backgroundColor: colors.primary + '22' }]}>
                <Ionicons name={o.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{o.label}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{o.sub}</Text>
              </View>
              <Ionicons
                name={busy === o.key ? 'hourglass-outline' : 'download-outline'}
                size={20}
                color={colors.textMuted}
              />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
