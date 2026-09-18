import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useReload } from '@/hooks/useReload';
import { getOpenP2POrders } from '@/database/repo';
import { TableWithOrder } from '@/types';
import { formatCurrency } from '@/utils/format';

// ─── Shadow helper ────────────────────────────────────────────────────────────
const cardShadow = Platform.select({
  web: {
    boxShadow: '0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
  } as any,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
});

// ─── Order Type Card ──────────────────────────────────────────────────────────
const OrderTypeCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  accent: string;
  badge?: string;
  onPress: () => void;
}> = ({ icon, label, description, accent, badge, onPress }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.orderTypeCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          ...cardShadow,
        },
      ]}
    >
      {/* Accent top bar */}
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={{ padding: 20, gap: 12 }}>
        {/* Icon + Badge row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={[styles.iconCircle, { backgroundColor: accent + '18' }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: accent + '15', borderColor: accent + '30' }]}>
              <Text style={{ color: accent, fontSize: 10, fontWeight: '800' }}>{badge}</Text>
            </View>
          ) : null}
        </View>

        {/* Label + Description */}
        <View style={{ gap: 4 }}>
          <Text style={[styles.orderTypeLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.orderTypeDesc, { color: colors.textMuted }]}>{description}</Text>
        </View>

        {/* CTA Row */}
        <View style={[styles.ctaRow, { backgroundColor: accent + '10', borderColor: accent + '25' }]}>
          <Text style={{ color: accent, fontSize: 13, fontWeight: '700' }}>
            Start Order
          </Text>
          <Ionicons name="arrow-forward" size={14} color={accent} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrderTypeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [openOrders, setOpenOrders] = useState<TableWithOrder[]>([]);

  // ── All existing logic preserved exactly ──────────────────────────────────
  const reload = useReload(async () => {
    setOpenOrders(await getOpenP2POrders());
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>New Order</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Select an order type to begin
          </Text>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: '#2563EB15', borderColor: '#2563EB30' }]}>
          <Ionicons name="flash" size={14} color="#2563EB" />
          <Text style={{ color: '#2563EB', fontSize: 12, fontWeight: '700' }}>Quick Start</Text>
        </View>
      </View>

      {/* ── Scrollable Body ─────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
      >

        {/* ── Order Type Cards ──────────────────────────────────────────────── */}
        <View style={styles.cardsGrid}>
          <OrderTypeCard
            icon="restaurant"
            label="Dine-In Tables"
            description="Seat customers at a table, manage running orders and settle when done."
            accent="#2563EB"
            badge="TABLE"
            onPress={() => router.push('/tables-list')}
          />
          <OrderTypeCard
            icon="bag-handle"
            label="Takeaway / Walk-in"
            description="Quick counter orders, takeaway and walk-in customers without a table."
            accent="#F97316"
            badge="P2P"
            onPress={() => router.push('/p2p-new')}
          />
        </View>

        {/* ── Tips Row ──────────────────────────────────────────────────────── */}
        <View style={[styles.tipsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.tipItem}>
            <View style={[styles.tipDot, { backgroundColor: '#2563EB' }]} />
            <Text style={[styles.tipText, { color: colors.textMuted }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Tables</Text>
              {' '}— order stays open until bill is settled
            </Text>
          </View>
          <View style={[styles.tipDivider, { backgroundColor: colors.border }]} />
          <View style={styles.tipItem}>
            <View style={[styles.tipDot, { backgroundColor: '#F97316' }]} />
            <Text style={[styles.tipText, { color: colors.textMuted }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>P2P</Text>
              {' '}— enter customer name & phone, then bill instantly
            </Text>
          </View>
        </View>

        {/* ── Open P2P Orders ───────────────────────────────────────────────── */}
        {openOrders.length > 0 && (
          <View style={{ gap: 10 }}>
            {/* Section header */}
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.sectionDot, { backgroundColor: '#F97316' }]} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Open P2P Orders
                </Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: '#F9731615' }]}>
                <Text style={{ color: '#F97316', fontSize: 12, fontWeight: '800' }}>
                  {openOrders.length}
                </Text>
              </View>
            </View>

            {/* Order rows */}
            {openOrders.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({ pathname: '/table/[id]', params: { id: item.id } })
                }
                style={[
                  styles.openOrderRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    ...cardShadow,
                  },
                ]}
              >
                {/* Left: avatar + info */}
                <View style={[styles.orderAvatar, { backgroundColor: '#F9731618' }]}>
                  <Text style={{ fontSize: 18 }}>
                    {item.name?.charAt(0).toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.orderName, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.orderMeta, { color: colors.textMuted }]}>
                    {item.itemCount} item{item.itemCount > 1 ? 's' : ''} · Tap to resume
                  </Text>
                </View>

                {/* Right: amount + arrow */}
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.orderAmount, { color: '#F97316' }]}>
                    {formatCurrency(item.orderTotal)}
                  </Text>
                  <View style={[styles.resumeChip, { backgroundColor: '#F9731612', borderColor: '#F9731630' }]}>
                    <Text style={{ color: '#F97316', fontSize: 10, fontWeight: '700' }}>
                      RESUME
                    </Text>
                    <Ionicons name="arrow-forward" size={10} color="#F97316" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 24 }} />

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  subtitle: { fontSize: 13, marginTop: 2 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  body: { padding: 16, gap: 16 },

  // Order type cards
  cardsGrid: { gap: 12 },
  orderTypeCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentBar: { height: 4, width: '100%' },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  orderTypeLabel: { fontSize: 18, fontWeight: '800' },
  orderTypeDesc: { fontSize: 13, lineHeight: 19 },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },

  // Tips card
  tipsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  tipItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },
  tipDivider: { height: 1 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  countBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Open order rows
  openOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  orderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderName: { fontSize: 15, fontWeight: '700' },
  orderMeta: { fontSize: 12, marginTop: 2 },
  orderAmount: { fontSize: 16, fontWeight: '800' },
  resumeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
});