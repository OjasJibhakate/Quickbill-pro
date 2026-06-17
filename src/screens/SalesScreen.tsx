import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useReload } from '@/hooks/useReload';
import { getSales, RecentSale } from '@/database/repo';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { Card, EmptyState } from '@/components/ui';

export default function SalesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [sales, setSales] = useState<RecentSale[]>([]);

  useReload(async () => {
    setSales(await getSales(200));
  });

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={sales}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <EmptyState icon="🧾" title="No sales yet" subtitle="Bills you create will appear here." />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/sale/[id]', params: { id: item.id } })}
          >
            <Card style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
                  {formatCurrency(item.finalAmount)}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {item.itemCount} item(s) · {item.paymentMethod.toUpperCase()}
                  {item.customerName ? ` · ${item.customerName}` : ''}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {formatDateTime(item.date)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
});
