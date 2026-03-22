import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { CartProvider } from './src/hooks/useCart';
import AppNavigator from './src/navigation/AppNavigator';

try {
  SplashScreen.preventAutoHideAsync();
} catch {}

function AppContent() {
  const { loading } = useAuth();

  useEffect(() => {
    // Force hide splash after 3 seconds no matter what
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);

    if (!loading) {
      clearTimeout(timeout);
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(timeout);
  }, [loading]);

  return (
    <>
      <StatusBar style="light" backgroundColor="#2d6a4f" />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
