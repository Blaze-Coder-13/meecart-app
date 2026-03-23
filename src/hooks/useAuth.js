import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const [storedToken, storedUser] = await AsyncStorage.multiGet([
        'meecart_token',
        'meecart_user',
      ]);
      if (storedToken[1] && storedUser[1]) {
        setToken(storedToken[1]);
        setUser(JSON.parse(storedUser[1]));
      }
    } catch (e) {
      console.error('Failed to load auth:', e);
    } finally {
      setLoading(false);
    }
  }

  async function login(tokenValue, userData) {
    await AsyncStorage.multiSet([
      ['meecart_token', tokenValue],
      ['meecart_user', JSON.stringify(userData)],
    ]);
    setToken(tokenValue);
    setUser(userData);
  }

  async function logout() {
    await AsyncStorage.multiRemove(['meecart_token', 'meecart_user', 'meecart_cart']);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
