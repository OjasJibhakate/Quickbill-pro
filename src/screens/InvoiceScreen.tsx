import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { TouchableOpacity } from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/context/ThemeContext';
import { useStore } from '@/context/StoreContext';
import { getSaleDetail, SaleItemDetail } from '@/database/repo';
import { Sale } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { breakdownFromSale } from '@/utils/tax';
import { buildInvoiceHtml } from '@/utils/invoice';
import { shareHtmlAsPdf } from '@/utils/share';
import { Card, Button } from '@/components/ui';

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { store } = useStore();
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItemDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const qrRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const detail = id ? await getSaleDetail(id) : null;
      if (detail) {
        setSale(detail.sale);
        setItems(detail.items);
      }
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
  if (!sale) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Sale not found.</Text>
      </View>
    );
  }

  const storeName = store.name.trim() || 'QuickBill Pro';
  const invoiceNo = sale.id.replace(/^sale-/, '').slice(0, 8).toUpperCase();
  const hasWebsite = !!store.website.trim();
  const gstNo = store.gstNumber.trim();

  // The service charge + GST that were actually added on top of this bill.
  const b = breakdownFromSale(sale);
  const showService = b.serviceCharge > 0;
  const showGst = b.tax > 0;

  const getQrDataUrl = (): Promise<string | null> =>
    new Promise((resolve) => {
      const ref = qrRef.current;
      if (!hasWebsite || !ref || typeof ref.toDataURL !== 'function') return resolve(null);
      try {
        ref.toDataURL((b64: string) => resolve(`data:image/png;base64,${b64}`));
      } catch {
        resolve(null);
      }
    });

  const sharePdf = async () => {
    setBusy(true);
    try {
      const qrDataUrl = await getQrDataUrl();
      const html = buildInvoiceHtml({
        invoiceNo,
        date: formatDateTime(sale.date),
        store,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        customerAddress: sale.customerAddress,
        paymentMethod: sale.paymentMethod,
        items: items.map((it) => ({
          name: it.name ?? 'Item',
          quantity: it.quantity,
          price: it.priceAtSale,
        })),
        subtotal: sale.totalAmount,
        discount: sale.discountAmount,
        serviceCharge: sale.serviceCharge ?? 0,
        taxAmount: sale.taxAmount ?? 0,
        total: sale.finalAmount,
        qrDataUrl,
      });
      await shareHtmlAsPdf(html);
    } catch (e) {
      console.error(e);
      dialog.alert('Error', 'Could not generate the invoice PDF.');
    } finally {
      setBusy(false);
    }
  };

  const whatsappText = () => {
    const phone = sale.customerPhone;
    if (!phone) return;
    const digits = phone.replace(/\D/g, '');
    const wa = digits.length === 10 ? `91${digits}` : digits;
    const lines = [
      `*${storeName}*`,
      `Invoice #${invoiceNo}`,
      `Total: ${formatCurrency(sale.finalAmount)} (${sale.paymentMethod.toUpperCase()})`,
      'Thank you for shopping! Please visit again.',
      store.website.trim() ? store.website.trim() : '',
    ].filter(Boolean);
    Linking.openURL(`https://wa.me/${wa}?text=${encodeURIComponent(lines.join('\n'))}`).catch(() =>
      dialog.alert('Could not open WhatsApp', 'Make sure WhatsApp is installed.')
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.navBar, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={goBack} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>Invoice</Text>
        <View style={{ width: 64 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {/* Preview */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={[styles.head, { backgroundColor: colors.primary }]}>
            <Text style={styles.storeName}>{storeName}</Text>
            {store.address ? <Text style={styles.headMuted}>{store.address}</Text> : null}
            {(store.phone || store.website) && (
              <Text style={styles.headMuted}>
                {[store.phone, store.website].filter(Boolean).join('  •  ')}
              </Text>
            )}
            {gstNo ? <Text style={styles.headMuted}>GSTIN: {gstNo}</Text> : null}
          </View>

          <View style={{ padding: 16 }}>
            <View style={styles.metaRow}>
              <View>
                {sale.customerName || sale.customerPhone ? (
                  <>
                    <Text style={[styles.tinyLabel, { color: colors.textMuted }]}>BILL TO</Text>
                    {sale.customerName ? (
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{sale.customerName}</Text>
                    ) : null}
                    {sale.customerPhone ? (
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{sale.customerPhone}</Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={{ color: colors.textMuted }}>Walk-in customer</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>INVOICE</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>#{invoiceNo}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDateTime(sale.date)}</Text>
              </View>
            </View>

            <View style={[styles.tableHead, { borderColor: colors.border }]}>
              <Text style={[styles.th, { color: colors.textMuted, flex: 1 }]}>Item</Text>
              <Text style={[styles.th, { color: colors.textMuted, width: 36, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.th, { color: colors.textMuted, width: 80, textAlign: 'right' }]}>Amount</Text>
            </View>
            {items.map((it) => (
              <View key={it.id} style={styles.tr}>
                <Text style={{ color: colors.text, flex: 1 }}>{it.name ?? 'Item'}</Text>
                <Text style={{ color: colors.text, width: 36, textAlign: 'center' }}>{it.quantity}</Text>
                <Text style={{ color: colors.text, width: 80, textAlign: 'right' }}>
                  {formatCurrency(it.priceAtSale * it.quantity)}
                </Text>
              </View>
            ))}

            <View style={[styles.totals, { borderColor: colors.border }]}>
              <Row label="Subtotal" value={formatCurrency(sale.totalAmount)} colors={colors} />
              {sale.discountAmount > 0 && (
                <Row label="Discount" value={`- ${formatCurrency(sale.discountAmount)}`} colors={colors} />
              )}
              {showService && (
                <Row
                  label={`Service charge (${b.serviceRate}%)`}
                  value={formatCurrency(b.serviceCharge)}
                  colors={colors}
                />
              )}
              {showGst && (
                <>
                  <Row label={`CGST @ ${b.gstRate / 2}%`} value={formatCurrency(b.halfTax)} colors={colors} />
                  <Row label={`SGST @ ${b.gstRate / 2}%`} value={formatCurrency(b.halfTax)} colors={colors} />
                </>
              )}
              <View style={styles.grandRow}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Total</Text>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
                  {formatCurrency(sale.finalAmount)}
                </Text>
              </View>
            </View>

            {hasWebsite && (
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <QRCode value={store.website.trim()} size={110} getRef={(c) => (qrRef.current = c)} />
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                  Scan to visit our store
                </Text>
              </View>
            )}
          </View>
        </Card>

        <Button title="Share Invoice (PDF)" onPress={sharePdf} loading={busy} style={{ marginTop: 16 }} />
        {sale.customerPhone ? (
          <Button
            title="Send text on WhatsApp"
            variant="outline"
            onPress={whatsappText}
            style={{ marginTop: 10 }}
          />
        ) : null}
        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
          "Share Invoice" opens your share sheet — pick WhatsApp, Gmail, Drive, or Print.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) => (
  <View style={styles.row}>
    <Text style={{ color: colors.textMuted }}>{label}</Text>
    <Text style={{ color: colors.text }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 64 },
  head: { padding: 18 },
  storeName: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  headMuted: { color: '#FFFFFFE0', fontSize: 12, marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  tinyLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 8, marginBottom: 6 },
  th: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  tr: { flexDirection: 'row', paddingVertical: 6 },
  totals: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
});
