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

// ─── Types ────────────────────────────────────────────────────────────────────

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
  trackStock: !isRestaurant,
};

// ─── Shadow helper ─────────────────────────────────────────────────────────────

const cardShadow = Platform.select({
  web: {
    boxShadow: '0 1px 6px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)',
  } as any,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
});

// ─── Menu Item Card ───────────────────────────────────────────────────────────

const MenuCard: React.FC<{
  item: Product;
  isOwner: boolean;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}> = ({ item, isOwner, onEdit, onDelete }) => {
  const { colors } = useTheme();
  const margin = item.sellPrice - item.buyPrice;
  const marginPct = item.buyPrice > 0
    ? Math.round(((item.sellPrice - item.buyPrice) / item.buyPrice) * 100)
    : null;
  const isTracked = item.trackStock !== 0;
  const isLowStock = isTracked && item.stock <= 5;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onEdit(item)}
      style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border, ...cardShadow }]}
    >
      {/* Left: Food placeholder icon */}
      <View style={[styles.foodIcon, { backgroundColor: '#2563EB10' }]}>
        <Text style={{ fontSize: 24 }}>
          {item.category?.toLowerCase().includes('drink') ? '🥤'
           : item.category?.toLowerCase().includes('starter') ? '🍢'
           : item.category?.toLowerCase().includes('dessert') ? '🍮'
           : item.category?.toLowerCase().includes('soup') ? '🍲'
           : isRestaurant ? '🍽️' : '📦'}
        </Text>
      </View>

      {/* Middle: Info */}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          {/* Veg/Non-veg badge (restaurant only) */}
          {isRestaurant && (
            <View style={[
              styles.vegBadge,
              { borderColor: item.category?.toLowerCase().includes('chicken')
                  || item.category?.toLowerCase().includes('mutton')
                  || item.category?.toLowerCase().includes('fish')
                  || item.category?.toLowerCase().includes('egg')
                  ? '#EF4444' : '#22C55E' }
            ]}>
              <View style={[
                styles.vegDot,
                { backgroundColor: item.category?.toLowerCase().includes('chicken')
                    || item.category?.toLowerCase().includes('mutton')
                    || item.category?.toLowerCase().includes('fish')
                    || item.category?.toLowerCase().includes('egg')
                    ? '#EF4444' : '#22C55E' }
              ]} />
            </View>
          )}
        </View>

        {/* Category */}
        <Text style={[styles.itemCategory, { color: colors.textMuted }]}>
          {item.category || 'Uncategorized'}
          {item.barcode ? ` · ${item.barcode}` : ''}
        </Text>

        {/* Owner price info */}
        {isOwner && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={[styles.priceDetail, { color: colors.textMuted }]}>
              Cost {formatCurrency(item.buyPrice)}
            </Text>
            <View style={[
              styles.marginChip,
              { backgroundColor: margin >= 0 ? '#22C55E15' : '#EF444415' }
            ]}>
              <Text style={{
                color: margin >= 0 ? '#22C55E' : '#EF4444',
                fontSize: 11,
                fontWeight: '700',
              }}>
                {margin >= 0 ? '+' : ''}{formatCurrency(margin)}
                {marginPct !== null ? ` (${marginPct}%)` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Stock badge */}
        {isTracked && (
          <View style={[
            styles.stockBadge,
            { backgroundColor: isLowStock ? '#EF444415' : '#22C55E15' }
          ]}>
            <Ionicons
              name={isLowStock ? 'warning-outline' : 'checkmark-circle-outline'}
              size={11}
              color={isLowStock ? '#EF4444' : '#22C55E'}
            />
            <Text style={{
              color: isLowStock ? '#EF4444' : '#22C55E',
              fontSize: 11,
              fontWeight: '700',
            }}>
              {item.stock} {item.unit} {isLowStock ? '· Low' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Right: Price + actions */}
      <View style={styles.cardRight}>
        <Text style={[styles.sellPrice, { color: '#2563EB' }]}>
          {formatCurrency(item.sellPrice)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <TouchableOpacity
            onPress={() => onEdit(item)}
            hitSlop={8}
            style={[styles.actionBtn, { backgroundColor: '#2563EB15' }]}
          >
            <Ionicons name="create-outline" size={15} color="#2563EB" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(item)}
            hitSlop={8}
            style={[styles.actionBtn, { backgroundColor: '#EF444415' }]}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const { colors } = useTheme();
  const { isOwner } = useAuth();
  const itemLabel = isRestaurant ? 'Menu Item' : 'Product';

  // ── All existing state preserved exactly ─────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  // ── All existing logic preserved exactly ─────────────────────────────────
  const reload = useReload(async () => {
    const [list, cats] = await Promise.all([getProducts(search), getCategories()]);
    setProducts(list);
    setCategories(cats);
  });

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

  const onExpiryChange = (text: string) => {
    if (text.length < form.expiryDate.length) {
      set('expiryDate', text.endsWith('-') ? text.slice(0, -1) : text);
    } else {
      set('expiryDate', formatDateInput(text));
    }
  };

  const expiryError = validateExpiryDate(form.expiryDate);

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

  // ── Filtered products by selected category chip ───────────────────────────
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter(
      (p) => (p.category || 'Other').toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [products, selectedCategory]);

  // ── Restaurant: grouped by category ──────────────────────────────────────
  const sections = useMemo(() => {
    const source = selectedCategory ? filteredProducts : products;
    const map = new Map<string, Product[]>();
    for (const p of source) {
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
  }, [products, filteredProducts, selectedCategory]);

  const allCategories = useMemo(() => {
    const cats = new Set(products.map((p) => (p.category || 'Other').trim() || 'Other'));
    return ['All', ...Array.from(cats).sort()];
  }, [products]);

  const emptyList = (
    <EmptyState
      icon={isRestaurant ? '🍽️' : '📦'}
      title={isRestaurant ? 'No menu items yet' : 'No products yet'}
      subtitle={`Tap + to add your first ${itemLabel.toLowerCase()}.`}
      action={{ label: `Add ${itemLabel}`, onPress: openAdd }}
    />
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            placeholder={`Search ${isRestaurant ? 'dishes' : 'products'}...`}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: '#2563EB12', borderColor: '#2563EB25' }]}>
            <Ionicons name="cube-outline" size={13} color="#2563EB" />
            <Text style={{ color: '#2563EB', fontSize: 12, fontWeight: '700' }}>
              {products.length} {isRestaurant ? 'Dishes' : 'Products'}
            </Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#22C55E12', borderColor: '#22C55E25' }]}>
            <Ionicons name="grid-outline" size={13} color="#22C55E" />
            <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '700' }}>
              {categories.length} Categories
            </Text>
          </View>
        </View>

        {/* Category filter chips */}
        {allCategories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChips}
          >
            {allCategories.map((cat) => {
              const active = cat === 'All' ? !selectedCategory : selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat === 'All' ? null : cat)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? '#2563EB' : colors.card,
                      borderColor: active ? '#2563EB' : colors.border,
                    },
                  ]}
                >
                  <Text style={{
                    color: active ? '#FFF' : colors.text,
                    fontSize: 13,
                    fontWeight: '700',
                  }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {isRestaurant ? (
          <SectionList
            sections={sections}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={emptyList}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionDot, { backgroundColor: '#2563EB' }]} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {section.title}
                  </Text>
                </View>
                <View style={[styles.sectionCount, { backgroundColor: '#2563EB15' }]}>
                  <Text style={{ color: '#2563EB', fontSize: 12, fontWeight: '700' }}>
                    {section.data.length}
                  </Text>
                </View>
              </View>
            )}
            renderItem={({ item }) => (
              <MenuCard
                item={item}
                isOwner={isOwner}
                onEdit={openEdit}
                onDelete={remove}
              />
            )}
          />
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
            ListEmptyComponent={emptyList}
            renderItem={({ item }) => (
              <MenuCard
                item={item}
                isOwner={isOwner}
                onEdit={openEdit}
                onDelete={remove}
              />
            )}
          />
        )}
      </View>

      {/* ── FAB ───────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#2563EB' }]}
        onPress={openAdd}
        activeOpacity={0.88}
      >
        <Ionicons name="add" size={28} color="#FFF" />
        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>
          Add {itemLabel}
        </Text>
      </TouchableOpacity>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Modal header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {form.id ? `Edit ${itemLabel}` : `Add ${itemLabel}`}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {form.id ? 'Update item details below' : 'Fill in the details to add to menu'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                style={[styles.closeBtn, { backgroundColor: colors.border + '88' }]}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <Field
                label="Name *"
                value={form.name}
                onChangeText={(t: string) => set('name', t)}
                placeholder={isRestaurant ? 'e.g. Butter Chicken' : 'e.g. Parle-G Biscuit'}
              />

              {/* Prices */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(isOwner || !form.id) && (
                  <Field
                    label={isOwner ? 'Buy Price (₹)' : 'Buy Price (optional)'}
                    containerStyle={{ flex: 1 }}
                    value={form.buyPrice}
                    onChangeText={(t: string) => set('buyPrice', t)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                )}
                <Field
                  label="Sell Price (₹) *"
                  containerStyle={{ flex: 1 }}
                  value={form.sellPrice}
                  onChangeText={(t: string) => set('sellPrice', t)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>

              {/* Profit preview */}
              {isOwner && form.buyPrice && form.sellPrice && (
                <View style={[styles.profitPreview, {
                  backgroundColor: (parseFloat(form.sellPrice) - parseFloat(form.buyPrice)) >= 0
                    ? '#22C55E12' : '#EF444412',
                  borderColor: (parseFloat(form.sellPrice) - parseFloat(form.buyPrice)) >= 0
                    ? '#22C55E30' : '#EF444430',
                }]}>
                  <Ionicons
                    name="trending-up"
                    size={16}
                    color={(parseFloat(form.sellPrice) - parseFloat(form.buyPrice)) >= 0 ? '#22C55E' : '#EF4444'}
                  />
                  <Text style={{
                    color: (parseFloat(form.sellPrice) - parseFloat(form.buyPrice)) >= 0 ? '#22C55E' : '#EF4444',
                    fontWeight: '700',
                    fontSize: 13,
                  }}>
                    Margin: {formatCurrency(parseFloat(form.sellPrice || '0') - parseFloat(form.buyPrice || '0'))}
                    {parseFloat(form.buyPrice) > 0
                      ? ` (${Math.round(((parseFloat(form.sellPrice || '0') - parseFloat(form.buyPrice || '0')) / parseFloat(form.buyPrice)) * 100)}%)`
                      : ''}
                  </Text>
                </View>
              )}

              {/* Track stock toggle (restaurant only) */}
              {isRestaurant && (
                <View style={[styles.trackRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                      Track stock
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      For bottles, packs, cigarettes. Leave off for dishes.
                    </Text>
                  </View>
                  <Switch
                    value={form.trackStock}
                    onValueChange={(v) => setForm((f) => ({ ...f, trackStock: v }))}
                    trackColor={{ false: colors.border, true: '#2563EB' }}
                  />
                </View>
              )}

              {/* Stock + Unit */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {form.trackStock && (
                  <Field
                    label="Stock"
                    containerStyle={{ flex: 1 }}
                    value={form.stock}
                    onChangeText={(t: string) => set('stock', t)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                )}
                <Field
                  label="Unit"
                  containerStyle={{ flex: 1 }}
                  value={form.unit}
                  onChangeText={(t: string) => set('unit', t)}
                  placeholder={isRestaurant ? 'plate / pcs' : 'pcs / kg / L'}
                />
              </View>

              {/* Category */}
              <Field
                label="Category"
                value={form.category}
                onChangeText={(t: string) => set('category', t)}
                placeholder={isRestaurant ? 'e.g. Starters / Main Course / Drinks' : 'e.g. Snacks'}
              />
              {categorySuggestions.length > 0 && (
                <View style={styles.chipRow}>
                  {categorySuggestions.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => set('category', c)}
                      style={[styles.chip, { backgroundColor: '#2563EB15', borderColor: '#2563EB40' }]}
                    >
                      <Text style={{ color: '#2563EB', fontWeight: '600', fontSize: 13 }}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Barcode */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 }}>
                <Field
                  label="Barcode"
                  containerStyle={{ flex: 1, marginBottom: 0 }}
                  value={form.barcode}
                  onChangeText={(t: string) => set('barcode', t)}
                  keyboardType="numeric"
                  placeholder="Optional"
                />
                <TouchableOpacity
                  onPress={() => setScanOpen(true)}
                  style={[styles.scanBtn, { backgroundColor: '#2563EB' }]}
                >
                  <Ionicons name="barcode-outline" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Max discount (owner only) */}
              {isOwner && (
                <Field
                  label="Max employee discount % (optional)"
                  value={form.maxDiscount}
                  onChangeText={(t: string) => set('maxDiscount', t)}
                  keyboardType="numeric"
                  placeholder="Blank = use employee's global limit"
                />
              )}

              {/* Expiry date */}
              <Field
                label="Expiry Date"
                value={form.expiryDate}
                onChangeText={onExpiryChange}
                keyboardType="numeric"
                maxLength={10}
                placeholder="YYYY-MM-DD (optional)"
                style={expiryError ? { borderColor: '#EF4444' } : undefined}
                containerStyle={{ marginBottom: expiryError ? 4 : 16 }}
              />
              {expiryError && (
                <Text style={{ color: '#EF4444', fontSize: 13, marginBottom: 14 }}>
                  {expiryError}
                </Text>
              )}

              {/* Save button */}
              <Button
                title={form.id ? 'Save Changes' : `Add ${itemLabel}`}
                onPress={save}
                loading={saving}
                style={{ marginTop: 8 }}
              />

              <View style={{ height: 32 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Barcode Scanner ───────────────────────────────────────────────── */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChips: { gap: 8, paddingBottom: 4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  // Menu card
  menuCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    alignItems: 'flex-start',
  },
  foodIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemCategory: { fontSize: 12 },
  priceDetail: { fontSize: 12 },
  marginChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  vegBadge: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardRight: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  sellPrice: { fontSize: 16, fontWeight: '800' },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 4,
  },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { padding: 16 },

  // Track row
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  // Profit preview
  profitPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 16,
    marginTop: -8,
  },

  // Category chips (in modal)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },

  // Barcode scan button
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});