import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useTheme, ThemeColors } from '@/context/ThemeContext';
import {
  getProfitSummary,
  getSalesTrend,
  getSalesByHour,
  getBestSellers,
  getTopCustomers,
  getDeadStock,
  ProfitSummary,
  DailySales,
  HourlySales,
  TopProduct,
  TopCustomer,
} from '@/database/repo';
import { Product } from '@/types';
import { formatCurrency } from '@/utils/format';
import { Card, EmptyState } from '@/components/ui';

type Period = 7 | 30 | 90;
const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7 Days' },
  { value: 30, label: '30 Days' },
  { value: 90, label: '90 Days' },
];

const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
const CHART_W = Dimensions.get('window').width - 32;

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const [period, setPeriod] = useState<Period>(7);
  const [pl, setPl] = useState<ProfitSummary>({
    revenue: 0,
    cogs: 0,
    profit: 0,
    marginPct: 0,
    orders: 0,
    itemsSold: 0,
  });
  const [trend, setTrend] = useState<DailySales[]>([]);
  const [byHour, setByHour] = useState<HourlySales[]>([]);
  const [best, setBest] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [deadStock, setDeadStock] = useState<Product[]>([]);

  const load = useCallback(async () => {
    const [p, t, h, b, c, d] = await Promise.all([
      getProfitSummary(period),
      getSalesTrend(period),
      getSalesByHour(period),
      getBestSellers(period, 6),
      getTopCustomers(period, 5),
      getDeadStock(period),
    ]);
    setPl(p);
    setTrend(t);
    setByHour(h);
    setBest(b);
    setTopCustomers(c);
    setDeadStock(d);
  }, [period]);

  // Reloads on focus and whenever the period changes.
  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.error('Dashboard load error:', e));
    }, [load])
  );

  const hasSales = pl.orders > 0;

  const chartConfig = {
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (o = 1) => (isDark ? `rgba(96,165,250,${o})` : `rgba(37,99,235,${o})`),
    labelColor: () => colors.textMuted,
    barPercentage: 0.6,
    propsForDots: { r: '3' },
  };

  // Show only a few x-axis labels so longer ranges stay readable.
  const trendStep = Math.max(1, Math.ceil(trend.length / 6));
  const trendLabels = trend.map((d, i) => (i % trendStep === 0 ? d.day.slice(5) : ''));
  const hourLabels = byHour.map((h) => (h.hour % 3 === 0 ? `${h.hour}` : ''));

  const pieData = best.map((b, i) => ({
    name: b.name.length > 12 ? b.name.slice(0, 11) + '…' : b.name,
    population: b.revenue,
    color: PIE_COLORS[i % PIE_COLORS.length],
    legendFontColor: colors.textMuted,
    legendFontSize: 12,
  }));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <Text style={[styles.h1, { color: colors.text }]}>Reports</Text>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.value}
              onPress={() => setPeriod(p.value)}
              style={[
                styles.periodBtn,
                {
                  backgroundColor: period === p.value ? colors.primary : colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: period === p.value ? '#FFF' : colors.text, fontWeight: '700' }}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Profit & Loss */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>PROFIT & LOSS</Text>
          <View style={styles.plMain}>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Net Profit</Text>
              <Text
                style={{
                  color: pl.profit >= 0 ? colors.success : colors.danger,
                  fontSize: 28,
                  fontWeight: '800',
                }}
              >
                {formatCurrency(pl.profit)}
              </Text>
            </View>
            <View style={[styles.marginPill, { backgroundColor: (pl.profit >= 0 ? colors.success : colors.danger) + '22' }]}>
              <Text style={{ color: pl.profit >= 0 ? colors.success : colors.danger, fontWeight: '800' }}>
                {pl.marginPct.toFixed(1)}%
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>margin</Text>
            </View>
          </View>
          <View style={[styles.plRow, { borderTopColor: colors.border }]}>
            <PlCell label="Revenue" value={formatCurrency(pl.revenue)} colors={colors} />
            <PlCell label="Cost" value={formatCurrency(pl.cogs)} colors={colors} />
            <PlCell label="Orders" value={String(pl.orders)} colors={colors} />
            <PlCell label="Items" value={String(pl.itemsSold)} colors={colors} />
          </View>
        </Card>

        {/* Sales trend */}
        <Text style={[styles.h2, { color: colors.text }]}>Sales Trend</Text>
        <Card style={styles.chartCard}>
          {hasSales ? (
            <LineChart
              data={{ labels: trendLabels, datasets: [{ data: trend.map((d) => d.total) }] }}
              width={CHART_W - 8}
              height={200}
              chartConfig={chartConfig}
              bezier
              fromZero
              style={{ borderRadius: 12 }}
            />
          ) : (
            <EmptyState icon="📈" title="No sales in this period" />
          )}
        </Card>

        {/* Sales by hour */}
        <Text style={[styles.h2, { color: colors.text }]}>Sales by Hour</Text>
        <Card style={styles.chartCard}>
          {hasSales ? (
            <BarChart
              data={{ labels: hourLabels, datasets: [{ data: byHour.map((h) => h.total) }] }}
              width={CHART_W - 8}
              height={210}
              chartConfig={chartConfig}
              fromZero
              yAxisLabel="₹"
              yAxisSuffix=""
              showValuesOnTopOfBars={false}
              style={{ borderRadius: 12 }}
            />
          ) : (
            <EmptyState icon="🕐" title="No sales in this period" />
          )}
        </Card>

        {/* Best sellers pie */}
        <Text style={[styles.h2, { color: colors.text }]}>Best Sellers</Text>
        <Card style={styles.chartCard}>
          {pieData.length > 0 ? (
            <PieChart
              data={pieData}
              width={CHART_W - 8}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="8"
              absolute={false}
            />
          ) : (
            <EmptyState icon="🏆" title="No products sold yet" />
          )}
        </Card>

        {/* Top customers */}
        <Text style={[styles.h2, { color: colors.text }]}>Top Customers</Text>
        {topCustomers.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted }}>
              No customer-linked sales in this period yet. Pick a customer on the bill to rank them here.
            </Text>
          </Card>
        ) : (
          topCustomers.map((c, i) => (
            <Card key={c.name + i} style={styles.listRow}>
              <View style={[styles.rank, { backgroundColor: colors.info + '22' }]}>
                <Text style={{ color: colors.info, fontWeight: '800' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{c.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.orders} orders</Text>
              </View>
              <Text style={{ color: colors.success, fontWeight: '800' }}>{formatCurrency(c.total)}</Text>
            </Card>
          ))
        )}

        {/* Dead stock */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, marginBottom: 12 }}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={[styles.h2, { color: colors.text, marginTop: 0, marginBottom: 0 }]}>
            Dead Stock
          </Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>
          In stock but unsold in the last {period} days.
        </Text>
        {deadStock.length === 0 ? (
          <Card>
            <Text style={{ color: colors.success, fontWeight: '600' }}>
              🎉 Everything is selling — no dead stock!
            </Text>
          </Card>
        ) : (
          deadStock.slice(0, 12).map((p) => (
            <Card key={p.id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{p.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {p.stock} {p.unit} · {p.category || 'Uncategorized'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.warning, fontWeight: '700' }}>
                  {formatCurrency(p.buyPrice * p.stock)}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>locked</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const PlCell = ({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) => (
  <View style={{ flex: 1 }}>
    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', marginBottom: 14 },
  h2: { fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  periodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  cardLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  plMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  marginPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  plRow: { flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, gap: 6 },
  chartCard: { paddingHorizontal: 4, paddingVertical: 12, alignItems: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
