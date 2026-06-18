import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useReload } from '@/hooks/useReload';
import {
  getHomeStats,
  getRecentSales,
  getLowStockProducts,
  getTotalOutstanding,
  getOpenShift,
  RecentSale,
} from '@/database/repo';
import { HomeStats, Product } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { Card } from '@/components/ui';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<HomeStats>({
    todaySales: 0,
    todayOrders: 0,
    lowStock: 0,
    totalProducts: 0,
  });
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [shiftOpen, setShiftOpen] = useState(false);

  useReload(async () => {
    const [s, r, l, due, shift] = await Promise.all([
      getHomeStats(),
      getRecentSales(6),
      getLowStockProducts(),
      getTotalOutstanding(),
      user ? getOpenShift(user.id) : Promise.resolve(null),
    ]);
    setStats(s);
    setRecent(r);
    setLowStock(l);
    setOutstanding(due);
    setShiftOpen(!!shift);
  });

  const StatCard = ({
    label,
    value,
    color,
    icon,
  }: {
    label: string;
    value: string;
    color: string;
    icon: keyof typeof Ionicons.glyphMap;
  }) => (
    <Card style={styles.statCard}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </Card>
  );

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.greetRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>
              Hello, {user?.name} 👋
            </Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>
              {new Date().toDateString()}
            </Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: colors.primary + '22' }]}>
            <Text style={{ color: colors.primary, fontWeight: '700', textTransform: 'capitalize' }}>
              {user?.role}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Today's Sales" value={formatCurrency(stats.todaySales)} color={colors.success} icon="cash-outline" />
          <StatCard label="Today's Orders" value={String(stats.todayOrders)} color={colors.primary} icon="receipt-outline" />
          <StatCard label="Low Stock" value={String(stats.lowStock)} color={colors.danger} icon="alert-circle-outline" />
          <StatCard label="Products" value={String(stats.totalProducts)} color={colors.info} icon="cube-outline" />
        </View>

        <Text style={[styles.section, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.action, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/billing')}
          >
            <Ionicons name="add-circle-outline" size={24} color="#FFF" />
            <Text style={styles.actionText}>New Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.action, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => router.push('/products')}
          >
            <Ionicons name="cube-outline" size={24} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Add Product</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/customers')}>
          <Card style={styles.udhaarCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.udhaarIcon, { backgroundColor: colors.primary + '22' }]}>
                <Ionicons name="people-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                  Customers & Udhaar
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                  Total outstanding
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
              <Text
                style={{
                  color: outstanding > 0 ? colors.danger : colors.success,
                  fontWeight: '800',
                  fontSize: 16,
                }}
              >
                {formatCurrency(outstanding)}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/shift')}>
          <Card style={[styles.udhaarCard, { marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.udhaarIcon, { backgroundColor: colors.primary + '22' }]}>
                <Ionicons name="time-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                  Shift & Day Close
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                  Optional · cash drawer & Z-report
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
              <View
                style={[
                  styles.shiftPill,
                  { backgroundColor: (shiftOpen ? colors.success : colors.textMuted) + '22' },
                ]}
              >
                <Text
                  style={{ color: shiftOpen ? colors.success : colors.textMuted, fontWeight: '700', fontSize: 12 }}
                >
                  {shiftOpen ? 'Open' : 'Closed'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        {lowStock.length > 0 && (
          <Card style={{ marginTop: 18, backgroundColor: colors.warning + '18', borderColor: colors.warning }}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning-outline" size={18} color={colors.warning} />
              <Text style={[styles.alertTitle, { color: colors.warning }]}>
                {lowStock.length} item(s) running low
              </Text>
            </View>
            {lowStock.slice(0, 4).map((p) => (
              <View key={p.id} style={styles.lowRow}>
                <Text style={{ color: colors.text }}>{p.name}</Text>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>
                  {p.stock} {p.unit}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <View style={styles.sectionRow}>
          <Text style={[styles.section, { color: colors.text, marginTop: 0, marginBottom: 0 }]}>
            Recent Sales
          </Text>
          {recent.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/sales')}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>View all</Text>
            </TouchableOpacity>
          )}
        </View>
        {recent.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No sales yet. Create your first bill!</Text>
        ) : (
          recent.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => router.push({ pathname: '/sale/[id]', params: { id: s.id } })}
            >
              <Card style={styles.saleRow}>
                <View>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {formatCurrency(s.finalAmount)}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {s.itemCount} item(s) · {s.paymentMethod.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {formatDateTime(s.date)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  greetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  greeting: { fontSize: 22, fontWeight: '800' },
  date: { fontSize: 13, marginTop: 2 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', flexGrow: 1, gap: 6 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 13 },
  section: { fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12 },
  actionText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  udhaarCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  udhaarIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  shiftPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  alertTitle: { fontWeight: '700' },
  lowRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  saleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
});
