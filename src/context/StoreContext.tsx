import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'qbp_store_name';

interface StoreContextType {
  storeName: string;
  /** What to show in the header — store name, or a sensible default. */
  displayName: string;
  setStoreName: (name: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storeName, setStoreNameState] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v) setStoreNameState(v);
      })
      .catch(() => {});
  }, []);

  const setStoreName = (name: string) => {
    setStoreNameState(name);
    AsyncStorage.setItem(STORAGE_KEY, name).catch(() => {});
  };

  const displayName = storeName.trim() || 'QuickBill Pro';

  return (
    <StoreContext.Provider value={{ storeName, displayName, setStoreName }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
