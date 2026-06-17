import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import { getDB } from '@/database';
import { logActivity } from '@/database/repo';

const STORAGE_KEY = 'qbp_active_user';

interface AuthContextType {
  user: User | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auto-login: restore the previously logged-in user, if any.
  useEffect(() => {
    (async () => {
      try {
        const savedId = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const db = await getDB();
          const found = await db.getFirstAsync<User>(
            'SELECT * FROM users WHERE id = ?',
            [savedId]
          );
          if (found) setUser(found);
        } else {
          // Touch the DB so the schema/seed runs before first login.
          await getDB();
        }
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
      const found = await db.getFirstAsync<User>(
        'SELECT * FROM users WHERE pin = ?',
        [pin]
      );
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
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  // Re-read the active user from the DB after their account is edited.
  const refreshUser = async () => {
    if (!user) return;
    const db = await getDB();
    const fresh = await db.getFirstAsync<User>('SELECT * FROM users WHERE id = ?', [user.id]);
    if (fresh) setUser(fresh);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, refreshUser, isLoading, isOwner: user?.role === 'owner' }}
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
