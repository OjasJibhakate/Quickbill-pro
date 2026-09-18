import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  card: string;
  /** Slightly raised surface for grouped rows inside a card (e.g. list rows). */
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryTint: string; // primary at low opacity, precomputed for chips/icons
  primaryText: string;
  success: string;
  successTint: string;
  danger: string;
  dangerTint: string;
  warning: string;
  warningTint: string;
  info: string;
  infoTint: string;
  shadow: string;
}

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  colors: ThemeColors;
}

const STORAGE_KEY = 'qbp_theme_mode';

// Shared spacing/radius tokens so every screen uses the same rhythm.
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

const lightColors: ThemeColors = {
  background: '#F6F7FB',
  card: '#FFFFFF',
  surface: '#F1F3F8',
  text: '#14161B',
  textMuted: '#6B7280',
  border: '#EAECF1',
  primary: '#2563EB',
  primaryTint: '#2563EB1A',
  primaryText: '#FFFFFF',
  success: '#0E9F6E',
  successTint: '#0E9F6E1F',
  danger: '#E11D48',
  dangerTint: '#E11D481F',
  warning: '#D97706',
  warningTint: '#D977061F',
  info: '#0284C7',
  infoTint: '#0284C71F',
  shadow: 'rgba(20, 22, 27, 0.08)',
};

const darkColors: ThemeColors = {
  background: '#0B0D12',
  card: '#161922',
  surface: '#1D2029',
  text: '#F5F6FA',
  textMuted: '#9AA1B1',
  border: '#262A35',
  primary: '#5B9CFF',
  primaryTint: '#5B9CFF26',
  primaryText: '#0B0D12',
  success: '#34D399',
  successTint: '#34D39926',
  danger: '#FB7185',
  dangerTint: '#FB718526',
  warning: '#FBBF24',
  warningTint: '#FBBF2426',
  info: '#38BDF8',
  infoTint: '#38BDF826',
  shadow: 'rgba(0, 0, 0, 0.45)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(STORAGE_KEY)) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeModeState(saved);
      }
    })();
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  };

  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};