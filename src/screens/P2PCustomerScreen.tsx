import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { dialog } from '@/components/Dialog';
import { useTheme } from '@/context/ThemeContext';
import { createP2POrder } from '@/database/repo';
import { Field, Button } from '@/components/ui';

export default function P2PCustomerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (!name.trim()) {
      dialog.alert('Name required', "Enter the customer's name to continue.");
      return;
    }
    setBusy(true);
    try {
      const id = await createP2POrder(name, phone);
      router.replace({ pathname: '/table/[id]', params: { id } });
    } catch (e) {
      console.error(e);
      dialog.alert('Error', 'Could not start the order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ padding: 16 }}>
          <Text style={[styles.title, { color: colors.text }]}>Customer Details</Text>
          <Text style={{ color: colors.textMuted, marginBottom: 20 }}>
            For takeaway, walk-in or counter orders
          </Text>
          <Field label="Customer Name *" value={name} onChangeText={setName} placeholder="e.g. Rahul" />
          <Field
            label="Contact Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Optional"
          />
          <Button title="Continue" onPress={onContinue} loading={busy} style={{ marginTop: 12 }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800' },
});