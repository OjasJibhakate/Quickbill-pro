import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '@/context/ThemeContext';
import { useReload } from '@/hooks/useReload';
import {
  getSalesTrend,
  getTopProducts,
  getSummary,
  DailySales,
  TopProduct,
  SalesSummary,
} from '@/database/repo';
import { formatCurrency } from '@/utils/format';
import { Card, EmptyState } from '@/components/ui';

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const [trend, setTrend] = useState<DailySales[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [week, setWeek] = useState<SalesSummary>({ total: 0, orders: 0, itemsSold: 0 });
  const [month, setMonth] = useState<SalesSummary>({ total: 0, orders: 0, itemsSold: 0 });

  useReload(async () => {
    const [t, p, w, m] = await Promise.all([
      getSalesTrend(7),
      getTopProducts(5),
      getSummary(7),
      getSummary(30),
    ]);
    setTrend(t);
    setTop(p);
    setWeek(w);
    setMonth(m);
  });

  const hasSales = trend.some((d) => d.total > 0);
  const chartWidth = Dimensions.get('window').width - 32;

  const chartConfig = {
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (o = 1) => (isDark ? `rgba(96,165,250,${o})` : `rgba(37,99,235,${o})`),
    labelColor: () => colors.textMuted,
    propsForDots: { r: '4' },
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={[styles.h1, { color: colors.text }]}>Reports</Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
          <SummaryCard title="This Week" data={week} colors={colors} />
          <SummaryCard title="Last 30 Days" data={month} colors={colors} />
        </View>

        <Text style={[styles.h2, { color: colors.text }]}>Sales — Last 7 Days</Text>
        <Card style={{ paddingHorizontal: 4, paddingVertical: 12 }}>
          {hasSales ? (
            <LineChart
              data={{
                labels: trend.map((d) => d.day.slice(5)),
                datasets: [{ data: trend.map((d) => d.total) }],
              }}
              width={chartWidth - 8}
              height={210}
              chartConfig={chartConfig}
              bezier
              fromZero
              style={{ borderRadius: 12 }}
            />
          ) : (
            <EmptyState icon="📈" title="No sales data yet" subtitle="Charts appear once you record sales." />
          )}
        </Card>

        <Text style={[styles.h2, { color: colors.text }]}>Top Products</Text>
        {top.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No products sold yet.</Text>
        ) : (
          top.map((p, i) => (
            <Card key={p.name + i} style={styles.topRow}>
              <View style={[styles.rank, { backgroundColor: colors.primary + '22' }]}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{p.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{p.qty} sold</Text>
              </View>
              <Text style={{ color: colors.success, fontWeight: '800' }}>
                {formatCurrency(p.revenue)}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SummaryCard = ({
  title,
  data,
  colors,
}: {
  title: string;
  data: SalesSummary;
  colors: ReturnType<typeof useTheme>['colors'];
}) => (
  <Card style={{ flex: 1, gap: 4 }}>
    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{title}</Text>
    <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>
      {formatCurrency(data.total)}
    </Text>
    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
      {data.orders} orders · {data.itemsSold} items
    </Text>
  </Card>
);

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', marginBottom: 14 },
  h2: { fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
