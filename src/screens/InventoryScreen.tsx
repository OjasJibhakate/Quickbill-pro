import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useReload } from '@/hooks/useReload';
import { getProducts, adjustStock } from '@/database/repo';
import { Product } from '@/types';
import { formatCurrency } from '@/utils/format';
import { Card, EmptyState } from '@/components/ui';

type FilterMode = 'all' | 'low';

export default function InventoryScreen() {
  const { colors } = useTheme();
  const { isOwner } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const reload = useReload(async () => {
    setProducts(await getProducts());
  });

  const stockValue = useMemo(
    () => products.reduce((s, p) => s + p.buyPrice * p.stock, 0),
    [products]
  );
  const totalUnits = useMemo(() => products.reduce((s, p) => s + p.stock, 0), [products]);
  const lowCount = useMemo(() => products.filter((p) => p.stock <= 5).length, [products]);

  const shown = filter === 'low' ? products.filter((p) => p.stock <= 5) : products;

  const quickAdjust = async (p: Product, delta: number) => {
    await adjustStock(p.id, delta);
    reload();
  };

  const applyRestock = async (p: Product) => {
    const raw = drafts[p.id];
    const amount = parseInt(raw, 10);
    if (!amount || isNaN(amount)) {
      dialog.alert('Enter a quantity', 'Type the number of units to add (or use - to remove).');
      return;
    }
    await adjustStock(p.id, amount);
    setDrafts((d) => ({ ...d, [p.id]: '' }));
    reload();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
          <Card style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {isOwner ? 'Stock Value' : 'Units in Stock'}
            </Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              {isOwner ? formatCurrency(stockValue) : totalUnits}
            </Text>
          </Card>
          <Card style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Low Stock</Text>
            <Text style={{ color: lowCount ? colors.danger : colors.success, fontSize: 18, fontWeight: '800' }}>
              {lowCount} item(s)
            </Text>
          </Card>
        </View>

        <View style={styles.quickLinks}>
          {[
            ...(isOwner
              ? ([
                  { label: 'Stock In', icon: 'download-outline' as const, href: '/stock-in' as const },
                  { label: 'Suppliers', icon: 'business-outline' as const, href: '/suppliers' as const },
                ] as const)
              : []),
            { label: 'Expiring', icon: 'alert-circle-outline' as const, href: '/expiring' as const },
          ].map((q) => (
            <TouchableOpacity
              key={q.label}
              onPress={() => router.push(q.href)}
              style={[styles.quickLink, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name={q.icon} size={20} color={colors.primary} />
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12 }}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tabs}>
          {(['all', 'low'] as FilterMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setFilter(m)}
              style={[
                styles.tab,
                {
                  backgroundColor: filter === m ? colors.primary : colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: filter === m ? '#FFF' : colors.text, fontWeight: '700' }}>
                {m === 'all' ? 'All Items' : 'Low Stock'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <EmptyState icon="🏷️" title="Nothing here" subtitle="Add products to start tracking stock." />
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {item.category || 'Uncategorized'}
                  </Text>
                </View>
                <Text
                  style={{
                    color: item.stock <= 5 ? colors.danger : colors.success,
                    fontWeight: '800',
                    fontSize: 16,
                  }}
                >
                  {item.stock} {item.unit}
                </Text>
              </View>

              <View style={styles.adjustRow}>
                <TouchableOpacity onPress={() => quickAdjust(item, -1)} style={[styles.stepBtn, { borderColor: colors.border }]}>
                  <Ionicons name="remove" size={20} color={colors.danger} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => quickAdjust(item, 1)} style={[styles.stepBtn, { borderColor: colors.border }]}>
                  <Ionicons name="add" size={20} color={colors.success} />
                </TouchableOpacity>

                <TextInput
                  placeholder="qty"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={drafts[item.id] ?? ''}
                  onChangeText={(t) => setDrafts((d) => ({ ...d, [item.id]: t }))}
                  style={[styles.restockInput, { color: colors.text, borderColor: colors.border }]}
                />
                <TouchableOpacity
                  onPress={() => applyRestock(item)}
                  style={[styles.applyBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Update</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  quickLinks: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restockInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  applyBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
});
