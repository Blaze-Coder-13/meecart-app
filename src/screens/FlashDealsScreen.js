import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getFlashDeals } from '../api/client';
import { useCart } from '../hooks/useCart';
import { Alert } from 'react-native';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

const { width } = Dimensions.get('window');

function CountdownTimer({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(expiresAt) - new Date();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      if (days > 0) setTimeLeft(`${days}d ${hours}h ${mins}m left`);
      else setTimeLeft(`${hours}h ${mins}m ${secs}s left`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <View style={styles.timer}>
      <Text style={styles.timerIcon}>⏱️</Text>
      <Text style={styles.timerText}>{timeLeft}</Text>
    </View>
  );
}

export default function FlashDealsScreen({ navigation }) {
  const { addToCart, cart } = useCart();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadDeals(); }, []);

  async function loadDeals() {
    setLoading(true);
    try {
      const { data } = await getFlashDeals();
      setDeals(data || []);
    } catch {}
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDeals();
    setRefreshing(false);
  }, []);

  function handleAddToCart(deal) {
    const cartKey = `flash_${deal.product_id}`;
    if (cart[cartKey]) {
      Alert.alert('Already Added', 'This flash deal is already in your cart! You can only claim it once per order.');
      return;
    }
    addToCart({
      id: deal.product_id,
      product_id: deal.product_id,
      name: `⚡ ${deal.product_name}`,
      price: deal.deal_price,
      emoji: deal.image_emoji,
      image_url: deal.image_url || null,
      unit: deal.deal_unit || deal.original_unit || 'piece',
      is_flash_deal: true,
      max_qty: 1,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const savingPercent = (deal) => {
    if (!deal.original_price || deal.original_price <= 0) return 0;
    return Math.round(((deal.original_price - deal.deal_price) / deal.original_price) * 100);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>⚡ Flash Deals</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚡ Flash Deals</Text>
        <View style={{ width: 40 }} />
      </View>

      {deals.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>⚡</Text>
          <Text style={styles.emptyTitle}>No Flash Deals Right Now</Text>
          <Text style={styles.emptySub}>Check back soon for amazing deals!</Text>
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={d => String(d.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            <View style={styles.heroBanner}>
              <Text style={styles.heroEmoji}>⚡</Text>
              <View>
                <Text style={styles.heroTitle}>Flash Deals</Text>
                <Text style={styles.heroSub}>Limited time — grab them fast!</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.dealCard}>
              {savingPercent(item) > 0 && (
                <View style={styles.savingBadge}>
                  <Text style={styles.savingText}>{savingPercent(item)}% OFF</Text>
                </View>
              )}
              <View style={styles.dealContent}>
                <View style={styles.dealImageWrap}>
                  {item.image_url
                    ? <Image source={{ uri: item.image_url }} style={styles.dealImage} resizeMode="cover" />
                    : <Text style={styles.dealEmoji}>{item.image_emoji}</Text>
                  }
                </View>
                <View style={styles.dealInfo}>
                  <Text style={styles.dealName}>{item.product_name}</Text>
                  <Text style={styles.dealQty}>
                    {item.deal_unit ? `Get ${item.deal_unit} per deal` : `Per deal`}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.dealPrice}>₹{item.deal_price}</Text>
                    {item.original_price > item.deal_price && (
                      <Text style={styles.originalPrice}>₹{item.original_price}</Text>
                    )}
                  </View>
                  <Text style={styles.limitText}>Max {item.max_per_order} per order</Text>
                  <CountdownTimer expiresAt={item.expires_at} />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.addBtn, cart[`flash_${item.product_id}`] && styles.addBtnAdded]}
                onPress={() => handleAddToCart(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.addBtnText}>
                  {cart[`flash_${item.product_id}`] ? '✓ Added to Cart' : '⚡ Grab This Deal'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.text },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.lg },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  list: { padding: Spacing.lg, paddingBottom: 100 },

  heroBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#fff3e0', borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.lg,
    borderWidth: 1.5, borderColor: '#ffb300',
  },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: FontSize.xl, fontWeight: '800', color: '#e65100' },
  heroSub: { fontSize: FontSize.xs, color: '#bf360c', marginTop: 2 },

  dealCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    marginBottom: Spacing.md, overflow: 'hidden',
    ...Shadow.sm, position: 'relative',
  },
  savingBadge: {
    position: 'absolute', top: 12, right: 12, zIndex: 1,
    backgroundColor: '#ff1744', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  savingText: { color: Colors.white, fontSize: 11, fontWeight: '800' },

  dealContent: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md },
  dealImageWrap: {
    width: 90, height: 90, borderRadius: Radius.md,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  dealImage: { width: 90, height: 90 },
  dealEmoji: { fontSize: 50 },

  dealInfo: { flex: 1 },
  dealName: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  dealQty: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  dealPrice: { fontSize: FontSize.xl, fontWeight: '800', color: '#e65100' },
  originalPrice: { fontSize: FontSize.sm, color: Colors.textMuted, textDecorationLine: 'line-through' },
  limitText: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },

  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerIcon: { fontSize: 12 },
  timerText: { fontSize: FontSize.xs, fontWeight: '700', color: '#e65100' },

  addBtn: {
    backgroundColor: '#ff6d00', margin: Spacing.md, marginTop: 0,
    borderRadius: Radius.md, padding: 12, alignItems: 'center',
  },
  addBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '800' },
  addBtnAdded: { backgroundColor: Colors.primary },
});