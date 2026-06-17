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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useReload } from '@/hooks/useReload';
import { getProducts, saveProduct, deleteProduct } from '@/database/repo';
import { Product } from '@/types';
import { formatCurrency } from '@/utils/format';
import { Button, Field, EmptyState } from '@/components/ui';

interface FormState {
  id?: string;
  name: string;
  barcode: string;
  buyPrice: string;
  sellPrice: string;
  stock: string;
  unit: string;
  category: string;
  expiryDate: string;
}

const emptyForm: FormState = {
  name: '',
  barcode: '',
  buyPrice: '',
  sellPrice: '',
  stock: '',
  unit: 'pcs',
  category: '',
  expiryDate: '',
};

export default function ProductsScreen() {
  const { colors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const reload = useReload(async () => {
    setProducts(await getProducts(search));
  });

  // Re-query when the search text changes.
  React.useEffect(() => {
    getProducts(search).then(setProducts).catch(console.error);
  }, [search]);

  const openAdd = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setForm({
      id: p.id,
      name: p.name,
      barcode: p.barcode ?? '',
      buyPrice: String(p.buyPrice),
      sellPrice: String(p.sellPrice),
      stock: String(p.stock),
      unit: p.unit,
      category: p.category ?? '',
      expiryDate: p.expiryDate ?? '',
    });
    setModalOpen(true);
  };

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing name', 'Please enter a product name.');
      return;
    }
    setSaving(true);
    try {
      await saveProduct({
        id: form.id,
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        buyPrice: parseFloat(form.buyPrice) || 0,
        sellPrice: parseFloat(form.sellPrice) || 0,
        stock: parseInt(form.stock, 10) || 0,
        unit: form.unit.trim() || 'pcs',
        category: form.category.trim() || null,
        expiryDate: form.expiryDate.trim() || null,
      });
      setModalOpen(false);
      reload();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save the product.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (p: Product) => {
    Alert.alert('Delete product', `Remove "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProduct(p.id);
          reload();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 16 }}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search products"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={
            <EmptyState icon="📦" title="No products yet" subtitle="Tap + to add your first product." />
          }
          renderItem={({ item }) => {
            const margin = item.sellPrice - item.buyPrice;
            return (
              <TouchableOpacity
                onPress={() => openEdit(item)}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {item.category || 'Uncategorized'}
                    {item.barcode ? ` · ${item.barcode}` : ''}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    Buy {formatCurrency(item.buyPrice)} · Margin{' '}
                    <Text style={{ color: margin >= 0 ? colors.success : colors.danger }}>
                      {formatCurrency(margin)}
                    </Text>
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>
                    {formatCurrency(item.sellPrice)}
                  </Text>
                  <View
                    style={[
                      styles.stockPill,
                      { backgroundColor: (item.stock <= 5 ? colors.danger : colors.success) + '22' },
                    ]}
                  >
                    <Text style={{ color: item.stock <= 5 ? colors.danger : colors.success, fontSize: 12, fontWeight: '700' }}>
                      {item.stock} {item.unit}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => remove(item)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openAdd}>
        <Ionicons name="add" size={30} color="#FFF" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                {form.id ? 'Edit Product' : 'Add Product'}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Field label="Name *" value={form.name} onChangeText={(t) => set('name', t)} placeholder="e.g. Parle-G Biscuit" />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Field label="Buy Price" containerStyle={{ flex: 1 }} value={form.buyPrice} onChangeText={(t) => set('buyPrice', t)} keyboardType="numeric" placeholder="0" />
                <Field label="Sell Price" containerStyle={{ flex: 1 }} value={form.sellPrice} onChangeText={(t) => set('sellPrice', t)} keyboardType="numeric" placeholder="0" />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Field label="Stock" containerStyle={{ flex: 1 }} value={form.stock} onChangeText={(t) => set('stock', t)} keyboardType="numeric" placeholder="0" />
                <Field label="Unit" containerStyle={{ flex: 1 }} value={form.unit} onChangeText={(t) => set('unit', t)} placeholder="pcs / kg / L" />
              </View>
              <Field label="Category" value={form.category} onChangeText={(t) => set('category', t)} placeholder="e.g. Snacks" />
              <Field label="Barcode" value={form.barcode} onChangeText={(t) => set('barcode', t)} keyboardType="numeric" placeholder="Optional" />
              <Field label="Expiry Date" value={form.expiryDate} onChangeText={(t) => set('expiryDate', t)} placeholder="YYYY-MM-DD (optional)" />
              <Button title={form.id ? 'Save Changes' : 'Add Product'} onPress={save} loading={saving} style={{ marginTop: 8 }} />
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
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  stockPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
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
