import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Desktop (web) USB barcode scanners act as a keyboard: they "type" the code
 * very fast and press Enter. This hook captures that burst anywhere on the page
 * and calls onScan(code) — so a scan adds a product without focusing any field.
 *
 * A human can't type 6+ digits in well under a second, so we only treat a fast
 * run of characters ending in Enter as a scan; ordinary typing is ignored.
 * No-op on native (mobile scans with the camera instead).
 */
export function useBarcodeWedge(onScan: (code: string) => void, enabled = true): void {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    let buffer = '';
    let lastTime = 0;

    const onKey = (e: KeyboardEvent) => {
      const now = Date.now();
      // A gap longer than a scanner's speed means a fresh (human) input.
      if (now - lastTime > 60) buffer = '';
      lastTime = now;

      if (e.key === 'Enter') {
        const code = buffer;
        buffer = '';
        // Scanners fire keys ~<20ms apart; require a real code length.
        if (code.length >= 4) {
          cb.current(code);
          e.preventDefault();
        }
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
