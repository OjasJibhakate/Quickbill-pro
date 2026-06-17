import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useReload } from '@/hooks/useReload';
import { getActivityLogs, ActivityRow } from '@/database/repo';
import { formatDateTime } from '@/utils/format';
import { Card, EmptyState } from '@/components/ui';

const META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: (c: any) => string }> = {
  LOGIN: { icon: 'log-in-outline', color: (c) => c.textMuted },
  LOGOUT: { icon: 'log-out-outline', color: (c) => c.textMuted },
  SALE: { icon: 'cart-outline', color: (c) => c.success },
  EDIT_SALE: { icon: 'create-outline', color: (c) => c.warning },
  DELETE_SALE: { icon: 'trash-outline', color: (c) => c.danger },
  PAYMENT: { icon: 'cash-outline', color: (c) => c.success },
  SHIFT_OPEN: { icon: 'time-outline', color: (c) => c.primary },
  SHIFT_CLOSE: { icon: 'time-outline', color: (c) => c.danger },
};

export default function ActivityLogScreen() {
  const { colors } = useTheme();
  const { isOwner } = useAuth();
  const [logs, setLogs] = useState<ActivityRow[]>([]);

  useReload(async () => {
    setLogs(await getActivityLogs(200));
  });

  if (!isOwner) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState icon="🔒" title="Owner only" subtitle="Only the owner can view the activity log." />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={logs}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<EmptyState icon="📋" title="No activity yet" />}
        renderItem={({ item }) => {
          const meta = META[item.action] ?? { icon: 'ellipse-outline', color: (c: any) => c.textMuted };
          return (
            <Card style={styles.row}>
              <Ionicons name={meta.icon} size={22} color={meta.color(colors)} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {item.action.replace(/_/g, ' ')}
                </Text>
                {item.details ? (
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{item.details}</Text>
                ) : null}
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  {item.userName ?? 'Unknown'} · {formatDateTime(item.timestamp)}
                </Text>
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
});
