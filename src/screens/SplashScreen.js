import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, Spacing } from '../utils/theme';

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={['#2d6a4f', '#1b4332']} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🥦</Text>
        </View>
        <Text style={styles.title}>Meecart</Text>
        <Text style={styles.subtitle}>Fresh vegetables, daily delivery</Text>
      </Animated.View>

      <Animated.View style={[styles.bottom, { opacity: fadeAnim }]}>
        <Text style={styles.tagline}>Farm to doorstep</Text>
        <View style={styles.dot} />
        <Text style={styles.tagline}>Same day delivery</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center' },
  iconWrap: {
    width: 100, height: 100,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  icon: { fontSize: 52 },
  title: {
    fontSize: 42, fontWeight: '700',
    color: Colors.white, letterSpacing: -1,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  bottom: {
    position: 'absolute', bottom: 60,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  tagline: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
});
