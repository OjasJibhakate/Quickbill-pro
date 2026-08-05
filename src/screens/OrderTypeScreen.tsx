import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useReload } from '@/hooks/useReload';
import { getOpenP2POrders } from '@/database/repo';
import { TableWithOrder } from '@/types';
import { formatCurrency } from '@/utils/format';

export default function OrderTypeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [openOrders, setOpenOrders] = useState<TableWithOrder[]>([]);

  const reload = useReload(async () => {
    setOpenOrders(await getOpenP2POrders());
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>New Order</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          Choose how this order should be started
        </Text>
      </View>

      <View style={styles.choiceRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/tables-list')}
          style={[styles.choiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="restaurant" size={32} color={colors.primary} />
          <Text style={[styles.choiceLabel, { color: colors.text }]}>Tables</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
            Dine-in, seated at a table
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/p2p-new')}
          style={[styles.choiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="person" size={32} color={colors.primary} />
          <Text style={[styles.choiceLabel, { color: colors.text }]}>P2P</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
            Takeaway, walk-in, counter order
          </Text>
        </TouchableOpacity>
      </View>

      {openOrders.length > 0 && (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Open P2P orders</Text>
          <FlatList
            data={openOrders}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/table/[id]', params: { id: item.id } })}
                style={[styles.openRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Ionicons name="person-circle-outline" size={26} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {item.itemCount} item{item.itemCount > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>
                  {formatCurrency(item.orderTotal)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  choiceRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, marginBottom: 20 },
  choiceCard: {
    flex: 1,
    minHeight: 130,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
  },
  choiceLabel: { fontSize: 17, fontWeight: '800' },
  section: { fontSize: 15, fontWeight: '800', paddingHorizontal: 16, marginBottom: 10 },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
});