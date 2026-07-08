import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useReload } from '@/hooks/useReload';
import { getProducts, saveProduct, deleteProduct, getCategories } from '@/database/repo';
import { Product } from '@/types';
import { formatCurrency, formatDateInput, validateExpiryDate } from '@/utils/format';
import { isRestaurant } from '@/utils/mode';
import { Button, Field, EmptyState } from '@/components/ui';
import { BarcodeScanner } from '@/components/BarcodeScanner';

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
  maxDiscount: string;
  trackStock: boolean;
}

const emptyForm: FormState = {
  name: '',
  barcode: '',
  buyPrice: '',
  sellPrice: '',
  stock: '',
  unit: isRestaurant ? 'plate' : 'pcs',
  category: '',
  expiryDate: '',
  maxDiscount: '',
  // Retail tracks stock by default; a restaurant dish does not.
  trackStock: !isRestaurant,
};

export default function ProductsScreen() {
  const { colors } = useTheme();
  const { isOwner } = useAuth();
  const itemLabel = isRestaurant ? 'Menu Item' : 'Product';
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const reload = useReload(async () => {
    const [list, cats] = await Promise.all([getProducts(search), getCategories()]);
    setProducts(list);
    setCategories(cats);
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
      maxDiscount: p.maxDiscount != null ? String(p.maxDiscount) : '',
      trackStock: p.trackStock !== 0,
    });
    setModalOpen(true);
  };

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Auto-mask the expiry date, but let backspace remove an auto-inserted dash.
  const onExpiryChange = (text: string) => {
    if (text.length < form.expiryDate.length) {
      set('expiryDate', text.endsWith('-') ? text.slice(0, -1) : text);
    } else {
      set('expiryDate', formatDateInput(text));
    }
  };

  const expiryError = validateExpiryDate(form.expiryDate);

  // Existing categories that match what's typed (helps avoid duplicates).
  const categorySuggestions = categories.filter((c) => {
    const typed = form.category.trim().toLowerCase();
    if (c.toLowerCase() === typed) return false;
    return typed === '' || c.toLowerCase().includes(typed);
  });

  const save = async () => {
    if (!form.name.trim()) {
      dialog.alert('Missing name', 'Please enter a product name.');
      return;
    }
    if (expiryError) {
      dialog.alert('Invalid expiry date', expiryError);
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
        stock: form.trackStock ? parseInt(form.stock, 10) || 0 : 0,
        unit: form.unit.trim() || 'pcs',
        category: form.category.trim() || null,
        expiryDate: form.expiryDate.trim() || null,
        maxDiscount: form.maxDiscount.trim() === '' ? null : parseFloat(form.maxDiscount) || 0,
        trackStock: form.trackStock ? 1 : 0,
      });
      setModalOpen(false);
      reload();
    } catch (e) {
      console.error(e);
      dialog.alert('Error', 'Could not save the product.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (p: Product) => {
    dialog.alert('Delete product', `Remove "${p.name}"?`, [
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

  // Restaurant menu is grouped by category (Starters, Main Course, Drinks…).
  const sections = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const cat = (p.category || 'Other').trim() || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, data]) => ({
        title,
        data: [...data].sort((x, y) => x.name.localeCompare(y.name)),
      }));
  }, [products]);

  const emptyList = (
    <EmptyState
      icon={isRestaurant ? '🍽️' : '📦'}
      title={isRestaurant ? 'No menu items yet' : 'No products yet'}
      subtitle={`Tap + to add your first ${itemLabel.toLowerCase()}.`}
    />
  );

  const renderCard = (item: Product) => {
    const margin = item.sellPrice - item.buyPrice;
    return (
      <TouchableOpacity
        onPress={() => openEdit(item)}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {item.category || 'Uncategorized'}
            {item.barcode ? ` · ${item.barcode}` : ''}
          </Text>
          {isOwner && (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              Buy {formatCurrency(item.buyPrice)} · Margin{' '}
              <Text style={{ color: margin >= 0 ? colors.success : colors.danger }}>
                {formatCurrency(margin)}
              </Text>
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: colors.primary, fontWeight: '800' }}>{formatCurrency(item.sellPrice)}</Text>
          {item.trackStock === 0 ? (
            <View style={[styles.stockPill, { backgroundColor: colors.textMuted + '22' }]}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>{item.unit}</Text>
            </View>
          ) : (
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
          )}
          <TouchableOpacity onPress={() => remove(item)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
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

        {isRestaurant ? (
          <SectionList
            sections={sections}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingBottom: 90 }}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={emptyList}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>
                  {section.title.toUpperCase()}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{section.data.length}</Text>
              </View>
            )}
            renderItem={({ item }) => renderCard(item)}
          />
        ) : (
          <FlatList
            data={products}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingBottom: 90 }}
            ListEmptyComponent={emptyList}
            renderItem={({ item }) => renderCard(item)}
          />
        )}
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
                {form.id ? `Edit ${itemLabel}` : `Add ${itemLabel}`}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <Field label="Name *" value={form.name} onChangeText={(t) => set('name', t)} placeholder={isRestaurant ? 'e.g. Butter Chicken' : 'e.g. Parle-G Biscuit'} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(isOwner || !form.id) && (
                  <Field
                    label={isOwner ? 'Buy Price' : 'Buy Price (optional)'}
                    containerStyle={{ flex: 1 }}
                    value={form.buyPrice}
                    onChangeText={(t) => set('buyPrice', t)}
                    keyboardType="numeric"
                    placeholder={isOwner ? '0' : 'Owner can set'}
                  />
                )}
                <Field label="Sell Price" containerStyle={{ flex: 1 }} value={form.sellPrice} onChangeText={(t) => set('sellPrice', t)} keyboardType="numeric" placeholder="0" />
              </View>
              {isRestaurant && (
                <View style={[styles.trackRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>Track stock</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      For bottles, packs, cigarettes. Leave off for dishes.
                    </Text>
                  </View>
                  <Switch
                    value={form.trackStock}
                    onValueChange={(v) => setForm((f) => ({ ...f, trackStock: v }))}
                  />
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {form.trackStock && (
                  <Field label="Stock" containerStyle={{ flex: 1 }} value={form.stock} onChangeText={(t) => set('stock', t)} keyboardType="numeric" placeholder="0" />
                )}
                <Field label="Unit" containerStyle={{ flex: 1 }} value={form.unit} onChangeText={(t) => set('unit', t)} placeholder={isRestaurant ? 'plate / pcs' : 'pcs / kg / L'} />
              </View>

              <Field label="Category" value={form.category} onChangeText={(t) => set('category', t)} placeholder={isRestaurant ? 'e.g. Starters / Main Course / Drinks' : 'e.g. Snacks'} />
              {categorySuggestions.length > 0 && (
                <View style={styles.chipRow}>
                  {categorySuggestions.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => set('category', c)}
                      style={[styles.chip, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '55' }]}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 }}>
                <Field
                  label="Barcode"
                  containerStyle={{ flex: 1, marginBottom: 0 }}
                  value={form.barcode}
                  onChangeText={(t) => set('barcode', t)}
                  keyboardType="numeric"
                  placeholder="Optional"
                />
                <TouchableOpacity
                  onPress={() => setScanOpen(true)}
                  style={[styles.scanBtn, { backgroundColor: colors.primary }]}
                >
                  <Ionicons name="barcode-outline" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              {isOwner && (
                <Field
                  label="Max employee discount % (optional)"
                  value={form.maxDiscount}
                  onChangeText={(t) => set('maxDiscount', t)}
                  keyboardType="numeric"
                  placeholder="Blank = use employee's global limit"
                />
              )}

              <Field
                label="Expiry Date"
                value={form.expiryDate}
                onChangeText={onExpiryChange}
                keyboardType="numeric"
                maxLength={10}
                placeholder="YYYY-MM-DD (optional)"
                style={expiryError ? { borderColor: colors.danger } : undefined}
                containerStyle={{ marginBottom: expiryError ? 4 : 14 }}
              />
              {expiryError && (
                <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 14 }}>
                  {expiryError}
                </Text>
              )}

              <Button title={form.id ? 'Save Changes' : `Add ${itemLabel}`} onPress={save} loading={saving} style={{ marginTop: 8 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <BarcodeScanner
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={(code) => {
          set('barcode', code);
          setScanOpen(false);
        }}
        title="Scan the product's barcode"
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  scanBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
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
