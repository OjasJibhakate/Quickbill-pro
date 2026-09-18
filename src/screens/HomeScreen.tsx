import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
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
import { Card, SectionHeader, Badge, EmptyState } from '@/components/ui';

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KPICard: React.FC<{
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  onPress?: () => void;
  trend?: string;
}> = ({ label, value, icon, iconBg, iconColor, onPress, trend }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={[
        styles.kpiCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          ...cardShadow,
        },
      ]}
    >
      <View style={[styles.kpiIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.kpiValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{label}</Text>
      {trend ? (
        <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
          {trend}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

// ─── Quick Action Button ──────────────────────────────────────────────────────

const QuickAction: React.FC<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  onPress: () => void;
}> = ({ label, icon, color, bg, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border, ...cardShadow }]}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.quickActionLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
};

// ─── Shadow helper ────────────────────────────────────────────────────────────

const cardShadow = Platform.select({
  web: { boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)' } as any,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { displayName } = useStore();
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

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const payMethodColor = (m: string) =>
    m === 'cash' ? '#22C55E'
    : m === 'upi' ? '#2563EB'
    : m === 'card' ? '#8B5CF6'
    : '#F97316';

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.storeName, { color: colors.text }]}>{displayName}</Text>
            <Text style={[styles.dateText, { color: colors.textMuted }]}>{todayStr}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push('/shift')}
              style={[
                styles.shiftChip,
                {
                  backgroundColor: shiftOpen ? '#22C55E15' : colors.border + '44',
                  borderColor: shiftOpen ? '#22C55E44' : colors.border,
                },
              ]}
            >
              <View style={[styles.shiftDot, { backgroundColor: shiftOpen ? '#22C55E' : colors.textMuted }]} />
              <Text style={{ color: shiftOpen ? '#22C55E' : colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                {shiftOpen ? 'Shift Open' : 'No Shift'}
              </Text>
            </TouchableOpacity>
            <View style={[styles.avatar, { backgroundColor: '#2563EB' }]}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>

          {/* ── Today's Sales Hero ──────────────────────────────────────── */}
          <View style={[styles.heroCard, { backgroundColor: '#2563EB' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={styles.heroLabel}>Today's Revenue</Text>
                <Text style={styles.heroValue}>{formatCurrency(stats.todaySales)}</Text>
              </View>
              <View style={styles.heroIconCircle}>
                <Ionicons name="trending-up" size={22} color="#2563EB" />
              </View>
            </View>
            <View style={styles.heroFooter}>
              <View style={styles.heroStat}>
                <Ionicons name="receipt-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.heroStatText}>{stats.todayOrders} orders today</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/sales', params: { filter: 'today' } })}
                style={styles.heroBtn}
              >
                <Text style={{ color: '#2563EB', fontSize: 12, fontWeight: '800' }}>View All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── KPI Grid ────────────────────────────────────────────────── */}
          <View style={styles.kpiGrid}>
            <KPICard
              label="Orders Today"
              value={String(stats.todayOrders)}
              icon="receipt-outline"
              iconBg="#2563EB15"
              iconColor="#2563EB"
              onPress={() => router.push({ pathname: '/sales', params: { filter: 'today' } })}
            />
            <KPICard
              label="Low Stock"
              value={String(stats.lowStock)}
              icon="alert-circle-outline"
              iconBg={stats.lowStock > 0 ? '#EF444415' : '#22C55E15'}
              iconColor={stats.lowStock > 0 ? '#EF4444' : '#22C55E'}
              onPress={() => router.push({ pathname: '/inventory', params: { filter: 'low' } })}
            />
            <KPICard
              label="Menu Items"
              value={String(stats.totalProducts)}
              icon="cube-outline"
              iconBg="#8B5CF615"
              iconColor="#8B5CF6"
              onPress={() => router.push('/products')}
            />
            <KPICard
              label="Udhaar Due"
              value={formatCurrency(outstanding)}
              icon="people-outline"
              iconBg={outstanding > 0 ? '#F5950B15' : '#22C55E15'}
              iconColor={outstanding > 0 ? '#F59E0B' : '#22C55E'}
              onPress={() => router.push('/customers')}
            />
          </View>

          {/* ── Quick Actions ────────────────────────────────────────────── */}
          <SectionHeader title="Quick Actions" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActionsRow}
          >
            <QuickAction
              label="New Order"
              icon="add-circle"
              color="#2563EB"
              bg="#2563EB15"
              onPress={() => router.push('/(tabs)/tables')}
            />
            <QuickAction
              label="Tables"
              icon="grid-outline"
              color="#10B981"
              bg="#10B98115"
              onPress={() => router.push('/tables-list')}
            />
            <QuickAction
              label="Menu"
              icon="fast-food-outline"
              color="#F59E0B"
              bg="#F59E0B15"
              onPress={() => router.push('/products')}
            />
            <QuickAction
              label="Reports"
              icon="stats-chart-outline"
              color="#8B5CF6"
              bg="#8B5CF615"
              onPress={() => router.push('/(tabs)/dashboard')}
            />
            <QuickAction
              label="Customers"
              icon="people-outline"
              color="#EF4444"
              bg="#EF444415"
              onPress={() => router.push('/customers')}
            />
          </ScrollView>

          {/* ── Shift & Udhaar ──────────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push('/shift')}
              style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1, ...cardShadow }]}
            >
              <View style={[styles.infoCardIcon, { backgroundColor: shiftOpen ? '#22C55E15' : colors.border + '44' }]}>
                <Ionicons name="time-outline" size={20} color={shiftOpen ? '#22C55E' : colors.textMuted} />
              </View>
              <Text style={[styles.infoCardLabel, { color: colors.textMuted }]}>Shift</Text>
              <Text style={[styles.infoCardValue, { color: shiftOpen ? '#22C55E' : colors.textMuted }]}>
                {shiftOpen ? 'Open' : 'Closed'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/customers')}
              style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1, ...cardShadow }]}
            >
              <View style={[styles.infoCardIcon, { backgroundColor: outstanding > 0 ? '#F59E0B15' : '#22C55E15' }]}>
                <Ionicons name="wallet-outline" size={20} color={outstanding > 0 ? '#F59E0B' : '#22C55E'} />
              </View>
              <Text style={[styles.infoCardLabel, { color: colors.textMuted }]}>Udhaar Due</Text>
              <Text style={[styles.infoCardValue, { color: outstanding > 0 ? '#F59E0B' : '#22C55E' }]}>
                {formatCurrency(outstanding)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Low Stock Alert ──────────────────────────────────────────── */}
          {lowStock.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/inventory', params: { filter: 'low' } })}
              style={[styles.alertBanner, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
            >
              <View style={styles.alertLeft}>
                <Ionicons name="warning" size={18} color="#D97706" />
                <View>
                  <Text style={{ color: '#92400E', fontWeight: '700', fontSize: 14 }}>
                    {lowStock.length} item{lowStock.length > 1 ? 's' : ''} running low
                  </Text>
                  <Text style={{ color: '#B45309', fontSize: 12, marginTop: 1 }}>
                    {lowStock.slice(0, 2).map(p => p.name).join(', ')}
                    {lowStock.length > 2 ? ` +${lowStock.length - 2} more` : ''}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D97706" />
            </TouchableOpacity>
          )}

          {/* ── Recent Orders ────────────────────────────────────────────── */}
          <SectionHeader
            title="Recent Orders"
            action={
              recent.length > 0
                ? { label: 'View all', onPress: () => router.push('/sales') }
                : undefined
            }
          />

          {recent.length === 0 ? (
            <Card>
              <EmptyState
                icon="🧾"
                title="No orders yet"
                subtitle="Your recent orders will appear here"
              />
            </Card>
          ) : (
            <View style={{ gap: 8 }}>
              {recent.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/sale/[id]', params: { id: s.id } })}
                  style={[styles.saleRow, { backgroundColor: colors.card, borderColor: colors.border, ...cardShadow }]}
                >
                  <View style={[styles.saleMethodDot, { backgroundColor: payMethodColor(s.paymentMethod) + '20' }]}>
                    <Ionicons
                      name={
                        s.paymentMethod === 'cash' ? 'cash-outline'
                        : s.paymentMethod === 'upi' ? 'phone-portrait-outline'
                        : s.paymentMethod === 'card' ? 'card-outline'
                        : 'time-outline'
                      }
                      size={16}
                      color={payMethodColor(s.paymentMethod)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                      {formatCurrency(s.finalAmount)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
                      {s.itemCount} item{s.itemCount > 1 ? 's' : ''} · {formatDateTime(s.date)}
                    </Text>
                  </View>
                  <Badge
                    label={s.paymentMethod.toUpperCase()}
                    bg={payMethodColor(s.paymentMethod) + '18'}
                    color={payMethodColor(s.paymentMethod)}
                    size="sm"
                  />
                  <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Bottom spacer ────────────────────────────────────────────── */}
          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  storeName: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  dateText: { fontSize: 12, marginTop: 2 },
  shiftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  shiftDot: { width: 6, height: 6, borderRadius: 3 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  body: { padding: 16, gap: 16 },

  // Hero card
  heroCard: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', marginTop: 4 },
  heroIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroStatText: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  heroBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '47.5%',
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  kpiIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 12, fontWeight: '500' },

  // Quick actions
  quickActionsRow: { gap: 10, paddingVertical: 4 },
  quickAction: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 8,
    minWidth: 80,
  },
  quickActionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Info cards (shift + udhaar)
  infoCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 4,
    alignItems: 'flex-start',
  },
  infoCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  infoCardLabel: { fontSize: 12 },
  infoCardValue: { fontSize: 16, fontWeight: '800' },

  // Alert banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  alertLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },

  // Sale rows
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  saleMethodDot: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});