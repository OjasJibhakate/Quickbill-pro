import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { dialog } from '@/components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useReload } from '@/hooks/useReload';
import {
  getTablesWithOrders,
  addTable,
  renameTable,
  deleteTable,
  seedDefaultTables,
} from '@/database/repo';
import { TableWithOrder } from '@/types';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui';

const SEEDED_KEY = 'qbp_tables_seeded';

export default function TablesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tables, setTables] = useState<TableWithOrder[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TableWithOrder | null>(null);
  const [nameText, setNameText] = useState('');

  const reload = useReload(async () => {
    // Seed a few starter tables the very first time only.
    const seeded = await AsyncStorage.getItem(SEEDED_KEY);
    if (!seeded) {
      await seedDefaultTables();
      await AsyncStorage.setItem(SEEDED_KEY, '1');
    }
    setTables(await getTablesWithOrders());
  });

  const occupied = tables.filter((t) => t.itemCount > 0).length;

  const onAdd = async () => {
    await addTable(`Table ${tables.length + 1}`);
    reload();
  };

  const onDelete = (t: TableWithOrder) => {
    const warn =
      t.itemCount > 0
        ? `${t.name} has an open order of ${formatCurrency(t.orderTotal)}. Deleting it will discard that order. Continue?`
        : `Delete ${t.name}?`;
    dialog.alert('Delete table', warn, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTable(t.id);
          reload();
        },
      },
    ]);
  };

  const openRename = (t: TableWithOrder) => {
    setRenameTarget(t);
    setNameText(t.name);
  };

  const saveRename = async () => {
    if (renameTarget && nameText.trim()) {
      await renameTable(renameTarget.id, nameText.trim());
    }
    setRenameTarget(null);
    setNameText('');
    reload();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Tables</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {occupied} running · {tables.length} total
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setEditMode((v) => !v)}
          style={[styles.editBtn, { borderColor: colors.border, backgroundColor: editMode ? colors.primary : colors.card }]}
        >
          <Ionicons
            name={editMode ? 'checkmark' : 'create-outline'}
            size={16}
            color={editMode ? '#FFF' : colors.primary}
          />
          <Text style={{ color: editMode ? '#FFF' : colors.primary, fontWeight: '700' }}>
            {editMode ? 'Done' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }}>
        <View style={styles.grid}>
          {tables.map((t) => {
            const busy = t.itemCount > 0;
            return (
              <TouchableOpacity
                key={t.id}
                activeOpacity={0.8}
                onPress={() =>
                  editMode
                    ? openRename(t)
                    : router.push({ pathname: '/table/[id]', params: { id: t.id } })
                }
                style={[
                  styles.card,
                  {
                    backgroundColor: busy ? colors.primary + '14' : colors.card,
                    borderColor: busy ? colors.primary : colors.border,
                  },
                ]}
              >
                {editMode && (
                  <TouchableOpacity
                    onPress={() => onDelete(t)}
                    hitSlop={8}
                    style={[styles.delBadge, { backgroundColor: colors.danger }]}
                  >
                    <Ionicons name="trash" size={13} color="#FFF" />
                  </TouchableOpacity>
                )}
                <Ionicons
                  name={busy ? 'restaurant' : 'restaurant-outline'}
                  size={26}
                  color={busy ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                  {t.name}
                </Text>
                {busy ? (
                  <>
                    <Text style={{ color: colors.primary, fontWeight: '800' }}>
                      {formatCurrency(t.orderTotal)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {t.itemCount} item{t.itemCount > 1 ? 's' : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {editMode ? 'Tap to rename' : 'Empty · tap to open'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Add-table card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onAdd}
            style={[styles.card, styles.addCard, { borderColor: colors.primary }]}
          >
            <Ionicons name="add-circle" size={30} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>Add table</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Rename modal */}
      <Modal
        visible={!!renameTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 12 }}>
              Rename table
            </Text>
            <TextInput
              value={nameText}
              onChangeText={setNameText}
              autoFocus
              placeholder="Table name"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setRenameTarget(null)}
                style={{ flex: 1 }}
              />
              <Button title="Save" onPress={saveRename} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '800' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    flexGrow: 1,
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  addCard: { borderStyle: 'dashed', minHeight: 120 },
  cardName: { fontWeight: '800', fontSize: 15, marginTop: 2 },
  delBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0009',
    padding: 28,
  },
  modalCard: { width: '100%', borderRadius: 18, padding: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
