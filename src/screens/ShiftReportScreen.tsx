import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTheme, ThemeColors } from '@/context/ThemeContext';
import { getShiftReport, ShiftReport } from '@/database/repo';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { Card } from '@/components/ui';

export default function ShiftReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (id) setReport(await getShiftReport(id));
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!report) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Shift not found.</Text>
      </View>
    );
  }

  const { shift, totals, byMethod, cashSales, expectedCash, variance } = report;
  const closed = shift.status === 'closed';

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Card>
          <Text style={styles.zTitle}>Z-REPORT</Text>
          <Row label="Cashier" value={shift.userName ?? 'Staff'} colors={colors} />
          <Row label="Opened" value={formatDateTime(shift.startTime)} colors={colors} />
          <Row label="Closed" value={closed ? formatDateTime(shift.endTime) : 'Still open'} colors={colors} />
        </Card>

        <Text style={[styles.section, { color: colors.text }]}>Sales</Text>
        <Card>
          <Row label="Total sales" value={formatCurrency(totals.total)} colors={colors} strong />
          <Row label="Orders" value={String(totals.orders)} colors={colors} />
          <Row label="Items sold" value={String(totals.itemsSold)} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row label="Cash" value={formatCurrency(byMethod.cash)} colors={colors} />
          <Row label="UPI" value={formatCurrency(byMethod.upi)} colors={colors} />
          <Row label="Card" value={formatCurrency(byMethod.card)} colors={colors} />
          <Row label="Credit (udhaar)" value={formatCurrency(byMethod.credit)} colors={colors} />
        </Card>

        <Text style={[styles.section, { color: colors.text }]}>Cash Drawer</Text>
        <Card>
          <Row label="Opening float" value={formatCurrency(shift.openingBalance)} colors={colors} />
          <Row label="+ Cash sales" value={formatCurrency(cashSales)} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row label="Expected in drawer" value={formatCurrency(expectedCash)} colors={colors} strong />
          {closed && (
            <>
              <Row label="Counted in drawer" value={formatCurrency(shift.closingBalance ?? 0)} colors={colors} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.rowBetween}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>Variance</Text>
                <Text
                  style={{
                    fontWeight: '800',
                    color:
                      variance == null || Math.abs(variance) < 0.01
                        ? colors.success
                        : variance > 0
                        ? colors.warning
                        : colors.danger,
                  }}
                >
                  {variance == null || Math.abs(variance) < 0.01
                    ? 'Tally ✓'
                    : variance > 0
                    ? `Over ${formatCurrency(variance)}`
                    : `Short ${formatCurrency(Math.abs(variance))}`}
                </Text>
              </View>
            </>
          )}
        </Card>

        {!closed && (
          <Text style={{ color: colors.textMuted, marginTop: 14, textAlign: 'center' }}>
            This shift is still open. Close it from the Shift screen to finalise the drawer tally.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({
  label,
  value,
  colors,
  strong,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  strong?: boolean;
}) => (
  <View style={styles.rowBetween}>
    <Text style={{ color: colors.textMuted }}>{label}</Text>
    <Text style={{ color: colors.text, fontWeight: strong ? '800' : '600', fontSize: strong ? 16 : 14 }}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zTitle: { color: '#888', fontWeight: '800', letterSpacing: 2, marginBottom: 8, fontSize: 12 },
  section: { fontSize: 17, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  divider: { height: 1, marginVertical: 8 },
});
