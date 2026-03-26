import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Image, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { CartProvider } from './src/hooks/useCart';
import AppNavigator from './src/navigation/AppNavigator';
import { API_BASE_URL } from './src/config/api';
import { savePushToken } from './src/api/client';
import { registerForPushNotifications } from './src/utils/notifications';

const LOCAL_LOGO = require('./assets/logo.png');
const SETTINGS_CACHE_KEY = 'meecart_app_settings';
const SETTINGS_FETCH_TIMEOUT_MS = 5000;

function SplashView({ logo, name, onLogoError }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={logo ? { uri: logo } : LOCAL_LOGO}
        onError={onLogoError}
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
  const [useLocalLogo, setUseLocalLogo] = useState(false);

  useEffect(() => {
    loadBranding();
  }, []);

  useEffect(() => {
    if (!user?.phone) return undefined;

    let active = true;
    const subscription = Notifications.addPushTokenListener(async ({ data }) => {
      try {
        await savePushToken(data, user.phone);
      } catch (err) {
        console.error('Failed to refresh push token:', err);
      }
    });

    async function setupNotifications() {
      try {
        const pushToken = await registerForPushNotifications();
        if (!active || !pushToken) return;
        await savePushToken(pushToken, user.phone);
      } catch (err) {
        console.error('Failed to register push notifications:', err);
      }
    }

    setupNotifications();

    return () => {
      active = false;
      subscription.remove();
    };
  }, [user?.phone]);

  async function loadBranding() {
    try {
      const cached = await AsyncStorage.getItem(SETTINGS_CACHE_KEY);
      if (cached) {
        const { logo, name } = JSON.parse(cached);
        if (logo) setAppLogo(logo);
        if (name) setAppName(name);
      }
    } catch {}

    setReady(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SETTINGS_FETCH_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/api/settings`, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      const data = await res.json();
      const logo = data.app_logo_url || '';
      const name = data.app_name || 'Meecart';
      setAppLogo(logo);
      setAppName(name);
      await AsyncStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ logo, name }));
    } catch {}
  }

  if (!ready || loading) {
    return <SplashView logo={!useLocalLogo ? appLogo : ''} name={appName} onLogoError={() => setUseLocalLogo(true)} />;
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
