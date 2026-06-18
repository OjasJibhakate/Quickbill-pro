import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { snapshotToJson, importSnapshot } from '@/database/backup';
import { shareTextFile, pickAndReadTextFile } from '@/utils/share';
import {
  isDriveConfigured,
  driveRestoreSession,
  driveSignIn,
  driveSignOut,
  driveBackup,
  driveRestore,
} from '@/utils/drivesync';
import { Card, Button, EmptyState } from '@/components/ui';

export default function BackupScreen() {
  const { colors } = useTheme();
  const { isOwner } = useAuth();
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);

  // Google Drive sync state
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [driveBusy, setDriveBusy] = useState<'backup' | 'restore' | null>(null);

  useEffect(() => {
    if (isDriveConfigured()) {
      driveRestoreSession()
        .then(setDriveEmail)
        .catch(() => {});
    }
  }, []);

  if (!isOwner) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState icon="🔒" title="Owner only" subtitle="Only the owner can back up or restore." />
      </View>
    );
  }

  /* ----------------------------- Google Drive ----------------------------- */
  const connectDrive = async () => {
    setConnecting(true);
    try {
      const email = await driveSignIn();
      setDriveEmail(email);
    } catch (e: any) {
      if (e?.message !== 'cancelled') {
        Alert.alert('Sign-in failed', 'Could not sign in to Google. Please try again.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const cloudBackup = async () => {
    setDriveBusy('backup');
    try {
      await driveBackup();
      Alert.alert('Backed up to Drive', 'Your shop data is safely saved in your Google Drive.');
    } catch (e: any) {
      Alert.alert('Backup failed', e?.message ?? 'Could not back up to Drive.');
    } finally {
      setDriveBusy(null);
    }
  };

  const cloudRestore = () => {
    Alert.alert(
      'Restore from Drive',
      'This REPLACES all data on this device with the copy in your Google Drive. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setDriveBusy('restore');
            try {
              const r = await driveRestore();
              if (!r.found) {
                Alert.alert(
                  'Nothing in Drive yet',
                  'No cloud backup found. Tap "Back up to Drive" first.'
                );
              } else {
                Alert.alert(
                  'Restored',
                  `Loaded ${r.rows} records from Drive. Please close and reopen the app so every screen refreshes.`
                );
              }
            } catch (e: any) {
              Alert.alert('Restore failed', e?.message ?? 'Could not restore from Drive.');
            } finally {
              setDriveBusy(null);
            }
          },
        },
      ]
    );
  };

  const disconnectDrive = async () => {
    await driveSignOut();
    setDriveEmail(null);
  };

  /* -------------------------- Manual backup file -------------------------- */
  const backup = async () => {
    setBusy('backup');
    try {
      const json = await snapshotToJson();
      const date = new Date().toISOString().slice(0, 10);
      await shareTextFile(`quickbill-backup-${date}.json`, json);
      Alert.alert(
        'Backup file saved',
        'You can store this file anywhere. Tip: the Google Drive sync above is easier — it needs no file to manage.'
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Backup failed', 'Could not create the backup file.');
    } finally {
      setBusy(null);
    }
  };

  const restore = () => {
    Alert.alert(
      'Restore from a file',
      'This REPLACES all data on this device with the chosen backup file. Continue?',
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
        {/* Google Drive auto-sync (primary) */}
        {isDriveConfigured() && (
          <Card style={{ marginBottom: 16 }}>
            <View style={styles.headerRow}>
              <Ionicons name="cloud-done-outline" size={22} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Google Drive sync</Text>
            </View>

            {driveEmail ? (
              <>
                <View style={[styles.connectedPill, { backgroundColor: colors.success + '18' }]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 13, flex: 1 }} numberOfLines={1}>
                    Connected · {driveEmail}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted, lineHeight: 20, marginBottom: 14 }}>
                  Saved privately in your Drive (a hidden app folder — nothing to find or star). On
                  another phone, sign in with the same Google account and tap Restore.
                </Text>
                <Button
                  title="Back up to Drive"
                  onPress={cloudBackup}
                  loading={driveBusy === 'backup'}
                  style={{ marginBottom: 10 }}
                />
                <Button
                  title="Restore from Drive"
                  variant="outline"
                  onPress={cloudRestore}
                  loading={driveBusy === 'restore'}
                />
                <TouchableOpacity onPress={disconnectDrive} style={{ alignSelf: 'center', marginTop: 14 }}>
                  <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Disconnect</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ color: colors.textMuted, lineHeight: 20, marginBottom: 14 }}>
                  Sign in once with your shop's Google account. Your data syncs to a private, hidden
                  folder in your own Drive — no monthly fees, and no file to star.
                </Text>
                <Button title="Connect Google Drive" onPress={connectDrive} loading={connecting} />
              </>
            )}
          </Card>
        )}

        {/* Manual backup file (offline fallback) */}
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.headerRow}>
            <Ionicons name="document-outline" size={22} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Manual backup file</Text>
          </View>
          <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
            Save your whole shop — products, sales, customers, udhaar, suppliers — into one file you
            can keep anywhere. Useful offline or as an extra copy.
          </Text>
        </Card>

        <Button title="Back up now" onPress={backup} loading={busy === 'backup'} style={{ marginBottom: 12 }} />
        <Button title="Restore from file" variant="outline" onPress={restore} loading={busy === 'restore'} />

        <Card style={{ marginTop: 24, backgroundColor: colors.warning + '18', borderColor: colors.warning }}>
          <Text style={{ color: colors.warning, fontWeight: '700', marginBottom: 4 }}>Coming next</Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>
            Drive sync above is one-tap backup & restore. Live, automatic multi-device merge (two
            phones billing at the same time, changes flowing both ways) is the next step.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardTitle: { fontWeight: '800', fontSize: 16 },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 12,
  },
});
