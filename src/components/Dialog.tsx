/**
 * Themed, imperative dialog that replaces React Native's OS-styled Alert.
 *
 * Usage mirrors Alert.alert so call sites barely change:
 *   import { dialog } from '@/components/Dialog';
 *   dialog.alert('Title', 'Message');
 *   dialog.alert('Delete?', 'Are you sure?', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'Delete', style: 'destructive', onPress: doDelete },
 *   ]);
 *
 * <DialogHost /> is mounted once at the app root; it follows the light/dark
 * theme automatically.
 */
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';
export interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: DialogButtonStyle;
}
interface DialogOptions {
  title: string;
  message?: string;
  buttons?: DialogButton[];
}

let showHandler: ((opts: DialogOptions) => void) | null = null;

export const dialog = {
  alert(title: string, message?: string, buttons?: DialogButton[]) {
    showHandler?.({ title, message, buttons });
  },
};

export function DialogHost() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<DialogOptions>({ title: '' });

  useEffect(() => {
    showHandler = (o) => {
      setOpts(o);
      setVisible(true);
    };
    return () => {
      showHandler = null;
    };
  }, []);

  const buttons: DialogButton[] = opts.buttons?.length ? opts.buttons : [{ text: 'OK' }];
  const stacked = buttons.length > 2;

  const press = (b: DialogButton) => {
    setVisible(false);
    // Let the modal close before running the action (which may open another dialog).
    if (b.onPress) setTimeout(b.onPress, 60);
  };

  const colorFor = (style?: DialogButtonStyle) =>
    style === 'destructive' ? colors.danger : style === 'cancel' ? colors.textMuted : colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setVisible(false)}
    >
      <Pressable style={styles.scrim} onPress={() => setVisible(false)}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: colors.text }]}>{opts.title}</Text>
          {opts.message ? (
            <Text style={[styles.message, { color: colors.textMuted }]}>{opts.message}</Text>
          ) : null}
          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {buttons.map((b, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.btn, stacked && styles.btnStacked]}
                onPress={() => press(b)}
              >
                <Text
                  style={[
                    styles.btnText,
                    { color: colorFor(b.style), fontWeight: b.style === 'cancel' ? '600' : '700' },
                  ]}
                >
                  {b.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: { width: '100%', maxWidth: 360, borderRadius: 16, borderWidth: 1, padding: 20 },
  title: { fontSize: 17, fontWeight: '800' },
  message: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 18, flexWrap: 'wrap' },
  buttonsStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 2 },
  btn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8 },
  btnStacked: { alignItems: 'center' },
  btnText: { fontSize: 15 },
});
