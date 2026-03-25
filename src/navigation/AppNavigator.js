import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../utils/theme';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FlashDealsScreen from '../screens/FlashDealsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useCart } from '../hooks/useCart';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ iconName, label, focused, badge = 0, compact }) {
  return (
    <View style={s.tabItem}>
      <View style={[s.iconWrap, compact && s.iconWrapCompact, focused && s.iconWrapFocused]}>
        <Ionicons
          name={iconName}
          size={compact ? 20 : 22}
          color={focused ? Colors.primary : Colors.textMuted}
          style={s.tabIcon}
        />
        {badge > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text
        allowFontScaling={false}
        adjustsFontSizeToFit
        minimumFontScale={0.95}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[s.tabLabel, compact && s.tabLabelCompact, focused && s.tabLabelFocused]}
      >
        {label}
      </Text>
    </View>
  );
}

function MainTabs() {
  const { cartCount } = useCart();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const topPadding = compact ? 6 : 7;
  const bottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 2) : Math.max(insets.bottom, 10);
  const tabBarBottomOffset = Platform.OS === 'android' ? Math.max(insets.bottom > 0 ? 4 : 2, 2) : 10;
  const tabBarHeight = (compact ? 48 : 52) + topPadding + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: compact ? 10 : 14,
          right: compact ? 10 : 14,
          bottom: tabBarBottomOffset,
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: '#efe7dc',
          paddingBottom: bottomInset,
          justifyContent: 'center',
          height: tabBarHeight,
          paddingTop: topPadding,
          paddingHorizontal: compact ? 6 : 8,
          borderRadius: 28,
          elevation: 18,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 3,
          paddingBottom: compact ? 0 : 1,
          paddingHorizontal: compact ? 1 : 2,
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
            <TabIcon iconName={focused ? 'home' : 'home-outline'} label="Home" focused={focused} compact={compact} />
          ),
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
            <TabIcon
              iconName={focused ? 'cart' : 'cart-outline'}
              label="Cart"
              focused={focused}
              badge={cartCount}
              compact={compact}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName={focused ? 'bag' : 'bag-outline'} label="Orders" focused={focused} compact={compact} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconName={focused ? 'person-circle' : 'person-circle-outline'}
              label="Profile"
              focused={focused}
              compact={compact}
            />
          ),
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
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <NavigationContainer>{user ? <AppStack /> : <AuthStack />}</NavigationContainer>;
}

const s = StyleSheet.create({
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minHeight: 42,
    paddingTop: 2,
    paddingBottom: 0,
  },
  iconWrap: {
    position: 'relative',
    width: 52,
    height: 34,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  iconWrapCompact: {
    width: 46,
    height: 32,
    borderRadius: 16,
  },
  iconWrapFocused: {
    backgroundColor: Colors.primaryPale,
  },
  tabIcon: {
    textAlign: 'center',
  },
  tabLabel: {
    width: '100%',
    maxWidth: 72,
    marginTop: 2,
    paddingBottom: Platform.OS === 'android' ? 1 : 0,
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  tabLabelCompact: {
    maxWidth: 66,
    fontSize: 10,
    lineHeight: 14,
  },
  tabLabelFocused: {
    color: Colors.primary,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -1,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff4444',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});

