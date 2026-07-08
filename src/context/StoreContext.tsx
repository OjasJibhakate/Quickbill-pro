import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = 'qbp_store_profile';
const LEGACY_NAME_KEY = 'qbp_store_name';

export interface StoreProfile {
  name: string;
  address: string;
  phone: string;
  website: string; // optional; used for the invoice QR code
  gstNumber: string; // optional GSTIN, shown on the bill
  gstRate: string; // optional GST % — added on top of the bill (CGST+SGST split)
  serviceCharge: string; // optional service charge % — added before GST (restaurant)
}

const EMPTY: StoreProfile = {
  name: '',
  address: '',
  phone: '',
  website: '',
  gstNumber: '',
  gstRate: '',
  serviceCharge: '',
};

interface StoreContextType {
  store: StoreProfile;
  /** Store name, or a sensible default — used in the header. */
  displayName: string;
  setStoreName: (name: string) => void;
  updateStore: (patch: Partial<StoreProfile>) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<StoreProfile>(EMPTY);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (raw) {
          setStore({ ...EMPTY, ...JSON.parse(raw) });
          return;
        }
        // Migrate the old name-only setting, if present.
        const legacyName = await AsyncStorage.getItem(LEGACY_NAME_KEY);
        if (legacyName) setStore({ ...EMPTY, name: legacyName });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const persist = (next: StoreProfile) => {
    setStore(next);
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const updateStore = (patch: Partial<StoreProfile>) => persist({ ...store, ...patch });
  const setStoreName = (name: string) => updateStore({ name });

  const displayName = store.name.trim() || 'QuickBill Pro';

  return (
    <StoreContext.Provider value={{ store, displayName, setStoreName, updateStore }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
