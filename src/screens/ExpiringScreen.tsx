import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useReload } from '@/hooks/useReload';
import { getExpiringBatches, ExpiringBatch } from '@/database/repo';
import { formatDate } from '@/utils/format';
import { Card, EmptyState } from '@/components/ui';

const daysUntil = (iso: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d.getTime() - today.getTime()) / 86400000);
};

export default function ExpiringScreen() {
  const { colors } = useTheme();
  const [batches, setBatches] = useState<ExpiringBatch[]>([]);

  useReload(async () => {
    setBatches(await getExpiringBatches(30));
  });

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={batches}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
            Batches expiring within 30 days (and already expired). Sell, discount, or return these first to cut waste.
          </Text>
        }
        ListEmptyComponent={
          <EmptyState icon="✅" title="Nothing expiring soon" subtitle="No tracked batches expire in the next 30 days." />
        }
        renderItem={({ item }) => {
          const left = item.expiryDate ? daysUntil(item.expiryDate) : 0;
          const expired = left < 0;
          const color = expired ? colors.danger : left <= 7 ? colors.warning : colors.info;
          return (
            <Card style={styles.row}>
              <View style={[styles.tag, { backgroundColor: color + '22' }]}>
                <Text style={{ color, fontWeight: '800', fontSize: 13 }}>
                  {expired ? 'EXPIRED' : `${left}d`}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.productName ?? 'Product'}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {item.batchNo ? `Batch ${item.batchNo} · ` : ''}
                  {item.quantityRemaining} {item.unit ?? ''} left
                </Text>
              </View>
              <Text style={{ color, fontWeight: '700', fontSize: 13 }}>
                {item.expiryDate ? formatDate(item.expiryDate) : '-'}
              </Text>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, minWidth: 56, alignItems: 'center' },
});
