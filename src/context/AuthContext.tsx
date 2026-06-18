import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import { getDB } from '@/database';
import { logActivity } from '@/database/repo';

const STORAGE_KEY = 'qbp_active_user';
const REQUIRE_PIN_KEY = 'qbp_require_pin';

interface AuthContextType {
  user: User | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
  isOwner: boolean;
  requirePin: boolean;
  setRequirePin: (value: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const firstOwner = async (): Promise<User | null> => {
  const db = await getDB();
  return db.getFirstAsync<User>(
    "SELECT * FROM users WHERE role = 'owner' ORDER BY name COLLATE NOCASE LIMIT 1"
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requirePin, setRequirePinState] = useState(true);

  // Auto-login: restore the previous user, or enter as owner if PINs are off.
  useEffect(() => {
    (async () => {
      try {
        const [savedId, reqRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(REQUIRE_PIN_KEY),
        ]);
        const req = reqRaw !== 'false';
        setRequirePinState(req);

        const db = await getDB(); // ensures schema/seed has run
        let active: User | null = null;
        if (savedId) {
          active = await db.getFirstAsync<User>('SELECT * FROM users WHERE id = ?', [savedId]);
        }
        // PIN screen disabled → open straight in as the owner.
        if (!active && !req) {
          active = await firstOwner();
          if (active) await AsyncStorage.setItem(STORAGE_KEY, active.id);
        }
        if (active) setUser(active);
      } catch (err) {
        console.error('Auto-login error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    try {
      const db = await getDB();
      const found = await db.getFirstAsync<User>('SELECT * FROM users WHERE pin = ?', [pin]);
      if (!found) return false;

      setUser(found);
      await AsyncStorage.setItem(STORAGE_KEY, found.id);
      await logActivity(found.id, 'LOGIN', `${found.name} logged in`);
      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  const logout = async () => {
    if (user) await logActivity(user.id, 'LOGOUT', `${user.name} logged out`);
    await AsyncStorage.removeItem(STORAGE_KEY);
    // With the PIN screen off there is no one to log in as but the owner.
    if (!requirePin) {
      const owner = await firstOwner();
      if (owner) {
        setUser(owner);
        await AsyncStorage.setItem(STORAGE_KEY, owner.id);
        return;
      }
    }
    setUser(null);
  };

  // Re-read the active user from the DB after their account is edited.
  const refreshUser = async () => {
    if (!user) return;
    const db = await getDB();
    const fresh = await db.getFirstAsync<User>('SELECT * FROM users WHERE id = ?', [user.id]);
    if (fresh) setUser(fresh);
  };

  const setRequirePin = async (value: boolean) => {
    setRequirePinState(value);
    await AsyncStorage.setItem(REQUIRE_PIN_KEY, value ? 'true' : 'false');
    // Turning protection off while nobody is logged in → enter as owner.
    if (!value && !user) {
      const owner = await firstOwner();
      if (owner) {
        setUser(owner);
        await AsyncStorage.setItem(STORAGE_KEY, owner.id);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        refreshUser,
        isLoading,
        isOwner: user?.role === 'owner',
        requirePin,
        setRequirePin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
