import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  getOpenShift,
  getShiftReport,
  getShifts,
  openShift,
  closeShift,
  ShiftReport,
  ShiftRow,
} from '@/database/repo';
import { Shift } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { Card, Button } from '@/components/ui';

export default function ShiftScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState<Shift | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [history, setHistory] = useState<ShiftRow[]>([]);

  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [floatAmount, setFloatAmount] = useState('');
  const [countAmount, setCountAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const current = await getOpenShift(user.id);
    setOpen(current);
    setReport(current ? await getShiftReport(current.id) : null);
    setHistory(await getShifts(30));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.error('Shift load error:', e));
    }, [load])
  );

  const doOpen = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await openShift(user.id, parseFloat(floatAmount) || 0);
      setOpenModal(false);
      setFloatAmount('');
      load();
    } finally {
      setBusy(false);
    }
  };

  const counted = parseFloat(countAmount) || 0;
  const expected = report?.expectedCash ?? 0;
  const previewVariance = counted - expected;

  const doClose = async () => {
    if (!user || !open) return;
    setBusy(true);
    try {
      const id = open.id;
      await closeShift(id, counted, user.id);
      setCloseModal(false);
      setCountAmount('');
      await load();
      router.push({ pathname: '/shift/[id]', params: { id } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {open && report ? (
          <Card>
            <View style={styles.rowBetween}>
              <View style={[styles.badge, { backgroundColor: colors.success + '22' }]}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text style={{ color: colors.success, fontWeight: '700' }}>Shift Open</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                since {formatDateTime(open.startTime)}
              </Text>
            </View>

            <View style={styles.bigStat}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Sales this shift</Text>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>
                {formatCurrency(report.totals.total)}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {report.totals.orders} orders · {report.totals.itemsSold} items
              </Text>
            </View>

            <View style={[styles.methodGrid, { borderTopColor: colors.border }]}>
              <Method label="Cash" value={report.byMethod.cash} colors={colors} />
              <Method label="UPI" value={report.byMethod.upi} colors={colors} />
              <Method label="Card" value={report.byMethod.card} colors={colors} />
              <Method label="Credit" value={report.byMethod.credit} colors={colors} />
            </View>

            <View style={[styles.expectedRow, { borderTopColor: colors.border }]}>
              <Text style={{ color: colors.textMuted }}>
                Expected cash (float {formatCurrency(open.openingBalance)} + cash sales)
              </Text>
              <Text style={{ color: colors.text, fontWeight: '800' }}>
                {formatCurrency(report.expectedCash)}
              </Text>
            </View>

            <Button title="Close Shift (Z-Report)" variant="danger" onPress={() => setCloseModal(true)} style={{ marginTop: 14 }} />
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Ionicons name="time-outline" size={44} color={colors.textMuted} />
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, marginTop: 8 }}>
              No shift open
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
              Shifts are optional. Open one only if you want to track the cash drawer and a Z-report for your session.
            </Text>
            <Button title="Open Shift" onPress={() => setOpenModal(true)} style={{ alignSelf: 'stretch' }} />
          </Card>
        )}

        <Text style={[styles.section, { color: colors.text }]}>History</Text>
        {history.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No shifts yet.</Text>
        ) : (
          history.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => router.push({ pathname: '/shift/[id]', params: { id: s.id } })}
            >
              <Card style={styles.histRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {formatDateTime(s.startTime)}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {s.userName ?? 'Staff'} · {s.status === 'open' ? 'Open now' : 'Closed'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Open shift modal */}
      <Modal visible={openModal} transparent animationType="fade" onRequestClose={() => setOpenModal(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
              Open Shift
            </Text>
            <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
              Opening cash is optional — leave it blank if you don't know the amount.
            </Text>
            <TextInput
              placeholder="Opening cash (optional)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={floatAmount}
              onChangeText={setFloatAmount}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button title="Cancel" variant="outline" onPress={() => setOpenModal(false)} style={{ flex: 1 }} />
              <Button title="Open" onPress={doOpen} loading={busy} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Close shift modal */}
      <Modal visible={closeModal} transparent animationType="fade" onRequestClose={() => setCloseModal(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
              Close Shift
            </Text>
            <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
              Expected cash in drawer: {formatCurrency(expected)}
            </Text>
            <TextInput
              placeholder="Counted cash in drawer"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={countAmount}
              onChangeText={setCountAmount}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            {countAmount !== '' && (
              <Text
                style={{
                  marginTop: 10,
                  fontWeight: '700',
                  color:
                    Math.abs(previewVariance) < 0.01
                      ? colors.success
                      : previewVariance > 0
                      ? colors.warning
                      : colors.danger,
                }}
              >
                {Math.abs(previewVariance) < 0.01
                  ? 'Tally matches 🎉'
                  : previewVariance > 0
                  ? `Over by ${formatCurrency(previewVariance)}`
                  : `Short by ${formatCurrency(Math.abs(previewVariance))}`}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button title="Cancel" variant="outline" onPress={() => setCloseModal(false)} style={{ flex: 1 }} />
              <Button title="Close Shift" variant="danger" onPress={doClose} loading={busy} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const Method = ({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useTheme>['colors'];
}) => (
  <View style={styles.methodCell}>
    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCurrency(value)}</Text>
  </View>
);

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bigStat: { alignItems: 'center', paddingVertical: 16 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, paddingTop: 12, gap: 8 },
  methodCell: { width: '47%', flexGrow: 1 },
  expectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, marginTop: 12, paddingTop: 12, gap: 8 },
  section: { fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  histRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' },
  sheet: { borderRadius: 18, padding: 20 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18 },
});
