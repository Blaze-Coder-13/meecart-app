import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Image, Text, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { CartProvider } from './src/hooks/useCart';
import AppNavigator from './src/navigation/AppNavigator';

const LOCAL_LOGO = require('./assets/logo.png');
const SETTINGS_CACHE_KEY = 'meecart_app_settings';
const BACKEND = 'https://meecart-backend-production.up.railway.app';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerPushToken(userId, phone) {
  try {
    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;

    await fetch(`${BACKEND}/api/auth/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pushToken, phone }),
    });

    console.log('✅ Push token registered:', pushToken);
  } catch (err) {
    console.log('Push token error:', err);
  }
}

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
  const notifListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    loadBranding();

    // Listen for notifications
    notifListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🔔 Notification tapped:', response);
    });

    return () => {
      if (notifListener.current) Notifications.removeNotificationSubscription(notifListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  useEffect(() => {
    if (user && user.phone) {
      registerPushToken(user.id, user.phone);
    }
  }, [user]);

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
