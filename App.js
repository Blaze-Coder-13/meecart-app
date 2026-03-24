import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Image, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { CartProvider } from './src/hooks/useCart';
import AppNavigator from './src/navigation/AppNavigator';

const LOCAL_LOGO = require('./assets/logo.png');
const SETTINGS_CACHE_KEY = 'meecart_app_settings';
const BACKEND = 'https://meecart-backend-production.up.railway.app';

function SplashView({ logo, name }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={logo ? { uri: logo } : LOCAL_LOGO}
        style={{ width: 120, height: 120, borderRadius: 24, marginBottom: 20 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>
        {name || 'Meecart'}
      </Text>
      <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
        Fresh vegetables, daily delivery
      </Text>
    </View>
  );
}

function AppContent() {
  const { loading, user } = useAuth();
  const [appLogo, setAppLogo] = useState('');
  const [appName, setAppName] = useState('Meecart');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadBranding();
  }, []);

  async function loadBranding() {
    try {
      const cached = await AsyncStorage.getItem(SETTINGS_CACHE_KEY);
      if (cached) {
        const { logo, name } = JSON.parse(cached);
        if (logo) setAppLogo(logo);
        if (name) setAppName(name);
        setReady(true);
      }
    } catch {}

    try {
      const res = await fetch(`${BACKEND}/api/settings`);
      const data = await res.json();
      const logo = data.app_logo_url || '';
      const name = data.app_name || 'Meecart';
      setAppLogo(logo);
      setAppName(name);
      await AsyncStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ logo, name }));
    } catch {}

    setReady(true);
  }

  if (!ready || loading) {
    return <SplashView logo={appLogo} name={appName} />;
  }

  return (
    <CartProvider userId={user?.id || null}>
      <StatusBar style="light" backgroundColor="#2d6a4f" />
      <AppNavigator />
    </CartProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
