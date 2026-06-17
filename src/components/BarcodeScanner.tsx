import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  title?: string;
  /** Bump this to re-arm the scanner after handling a code (for "scan again"). */
  resetSignal?: number;
}

const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'qr',
] as const;

/**
 * Full-screen camera barcode scanner in a modal. Calls `onScanned` once per
 * detected code (locked until closed or `resetSignal` changes). Handles the
 * camera permission prompt itself.
 */
export const BarcodeScanner: React.FC<Props> = ({
  visible,
  onClose,
  onScanned,
  title = 'Point the camera at a barcode',
  resetSignal = 0,
}) => {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const locked = useRef(false);

  // Re-arm when (re)opened or when the parent asks to scan again.
  useEffect(() => {
    locked.current = false;
  }, [visible, resetSignal]);

  // Ask for permission the first time the scanner is opened.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleScan = ({ data }: { data: string }) => {
    if (locked.current || !data) return;
    locked.current = true;
    onScanned(data);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          />
        ) : (
          <View style={styles.permission}>
            <Ionicons name="camera-outline" size={56} color="#FFF" />
            <Text style={styles.permText}>
              {permission && !permission.canAskAgain
                ? 'Camera permission was denied. Enable it for QuickBill Pro in your phone Settings.'
                : 'Camera access is needed to scan barcodes.'}
            </Text>
            {permission && permission.canAskAgain && (
              <Button title="Allow Camera" onPress={requestPermission} style={{ marginTop: 12 }} />
            )}
          </View>
        )}

        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.frame, { borderColor: colors.primary }]} />
          <Text style={styles.title}>{title}</Text>
        </View>

        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText: { color: '#FFF', textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 22 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 260,
    height: 170,
    borderWidth: 3,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  title: {
    color: '#FFF',
    marginTop: 20,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  close: {
    position: 'absolute',
    top: 48,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0008',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
