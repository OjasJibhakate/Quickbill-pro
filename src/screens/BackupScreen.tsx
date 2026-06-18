import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { snapshotToJson, importSnapshot } from '@/database/backup';
import { shareTextFile, pickAndReadTextFile } from '@/utils/share';
import { Card, Button, EmptyState } from '@/components/ui';

export default function BackupScreen() {
  const { colors } = useTheme();
  const { isOwner } = useAuth();
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);

  if (!isOwner) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState icon="🔒" title="Owner only" subtitle="Only the owner can back up or restore." />
      </View>
    );
  }

  const backup = async () => {
    setBusy('backup');
    try {
      const json = await snapshotToJson();
      const date = new Date().toISOString().slice(0, 10);
      await shareTextFile(`quickbill-backup-${date}.json`, json);
    } catch (e) {
      console.error(e);
      Alert.alert('Backup failed', 'Could not create the backup file.');
    } finally {
      setBusy(null);
    }
  };

  const restore = () => {
    Alert.alert(
      'Restore from backup',
      'This REPLACES all data on this device with the backup file. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file',
          style: 'destructive',
          onPress: async () => {
            setBusy('restore');
            try {
              const json = await pickAndReadTextFile();
              if (!json) {
                setBusy(null);
                return;
              }
              const summary = await importSnapshot(json);
              Alert.alert(
                'Restored',
                `Loaded ${summary.rows} records. Please close and reopen the app so every screen refreshes.`
              );
            } catch (e: any) {
              console.error(e);
              Alert.alert('Restore failed', e?.message ?? 'That file could not be restored.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
              Your data, your Google Drive
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
            Save your whole shop — products, sales, customers, udhaar, suppliers — into one
            backup file, then store it on your own Google Drive. No monthly fees. Switch phones
            or reinstall? Just restore the file and everything is back.
          </Text>
        </Card>

        <Button
          title="Back up now"
          onPress={backup}
          loading={busy === 'backup'}
          style={{ marginBottom: 12 }}
        />
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 22 }}>
          Tip: in the share sheet, pick <Text style={{ fontWeight: '700' }}>Save to Drive</Text> to
          keep the backup in your Google account.
        </Text>

        <Button title="Restore from backup" variant="outline" onPress={restore} loading={busy === 'restore'} />
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
          Pick a backup file (e.g. from Google Drive). This replaces the data on this device.
        </Text>

        <Card style={{ marginTop: 24, backgroundColor: colors.warning + '18', borderColor: colors.warning }}>
          <Text style={{ color: colors.warning, fontWeight: '700', marginBottom: 4 }}>Coming next</Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>
            Automatic Google Drive sign-in and live multi-device sync are the next steps — they
            need a one-time Google setup and an installable app build (Google sign-in can't run
            inside Expo Go). This backup file is the foundation they'll use.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
