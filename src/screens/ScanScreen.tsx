import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { getProductByBarcode } from '@/database/repo';
import { formatCurrency } from '@/utils/format';

/**
 * Standalone "scan to look up" screen opened from the Home header. Finds the
 * product by barcode and offers to start a new bill with it.
 */
export default function ScanScreen() {
  const router = useRouter();
  const [resetSignal, setResetSignal] = useState(0);

  const scanAgain = () => setResetSignal((n) => n + 1);

  const handle = async (code: string) => {
    const product = await getProductByBarcode(code);
    if (product) {
      Alert.alert(
        product.name,
        `${formatCurrency(product.sellPrice)} · ${product.stock} ${product.unit} in stock`,
        [
          { text: 'Scan again', onPress: scanAgain },
          {
            text: 'New bill',
            onPress: () => router.replace({ pathname: '/billing', params: { add: product.id } }),
          },
        ]
      );
    } else {
      Alert.alert('No match', `No product has the barcode ${code}.`, [
        { text: 'Scan again', onPress: scanAgain },
        { text: 'Add product', onPress: () => router.replace('/products') },
      ]);
    }
  };

  return (
    <BarcodeScanner
      visible
      resetSignal={resetSignal}
      onClose={() => router.back()}
      onScanned={handle}
      title="Scan to look up a product"
    />
  );
}
