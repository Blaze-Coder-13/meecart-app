import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize } from '../utils/theme';
import LoginScreen    from '../screens/LoginScreen';
import HomeScreen     from '../screens/HomeScreen';
import CartScreen     from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrdersScreen   from '../screens/OrdersScreen';
import ProfileScreen  from '../screens/ProfileScreen';
import FlashDealsScreen from '../screens/FlashDealsScreen';
import { useCart } from '../hooks/useCart';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();
const { width } = Dimensions.get('window');

function TabIcon({ emoji, label, focused, badge }) {
  return (
    <View style={s.tabItem}>
      <View style={[s.iconWrap, focused && s.iconWrapFocused]}>
        <Text style={[s.tabEmoji, focused && s.tabEmojiFocused]}>{emoji}</Text>
        {badge > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[s.tabLabel, focused && s.tabLabelFocused]}>{label}</Text>
    </View>
  );
}

function MainTabs() {
  const { cartCount } = useCart();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 14) : Math.max(insets.bottom, 20);
  const tabBarHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 0.5,
          borderTopColor: Colors.border,
          paddingBottom: bottomInset,
          height: tabBarHeight,
          paddingTop: 8,
          paddingHorizontal: 4,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Home" focused={focused} />
          )
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
          },
        })}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🛒" label="Cart" focused={focused} badge={cartCount} />
          )
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📦" label="Orders" focused={focused} />
          )
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="Profile" focused={focused} />
          )
        }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="FlashDeals" component={FlashDealsScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 32,
    borderRadius: 16,
  },
  iconWrapFocused: {
    backgroundColor: Colors.primaryPale,
  },
  tabEmoji: {
    fontSize: 20,
    opacity: 0.45,
  },
  tabEmojiFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 3,
  },
  tabLabelFocused: {
    color: Colors.primary,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 0,
    backgroundColor: '#ff4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
