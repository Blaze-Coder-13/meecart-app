import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, ActivityIndicator, Image,
  ScrollView, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getProducts, getCategories, getBanners, getSettings, getCustomerNotifications } from '../api/client';
const LOCAL_LOGO = require('../../assets/logo.png');
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

const { width } = Dimensions.get('window');
const COLS = 3;
const CAT_SIZE = (width - Spacing.lg * 2 - Spacing.sm * (COLS - 1)) / COLS;
const PRODUCT_WIDTH = (width - Spacing.lg * 2 - Spacing.sm) / 2;
const LAST_READ_NOTIFICATION_ID_KEY = 'meecart_last_read_notification_id';

export default function HomeScreen({ navigation }) {
  const { addToCart, cartCount } = useCart();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [appLogo, setAppLogo] = useState('');
  const [appName, setAppName] = useState('Meecart');
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => { loadData(); }, []);
  useFocusEffect(
    useCallback(() => {
      syncNotificationState();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    try {
      const [catRes, bannerRes, settingsRes] = await Promise.all([
        getCategories(),
        getBanners(),
        getSettings(),
      ]);
      setCategories(catRes.data || []);
      setBanners((bannerRes.data || []).filter(b => b.image_url && b.active));
      if (settingsRes.data.app_logo_url) setAppLogo(settingsRes.data.app_logo_url);
      if (settingsRes.data.app_name) setAppName(settingsRes.data.app_name);
    } catch {}
    setLoading(false);
  }

  async function loadProducts(categoryId) {
    setProductsLoading(true);
    try {
      const res = await getProducts({ category: categoryId });
      setProducts(res.data || []);
    } catch {}
    setProductsLoading(false);
  }

  async function syncNotificationState() {
    try {
      const [{ data }, lastReadId] = await Promise.all([
        getCustomerNotifications(),
        AsyncStorage.getItem(LAST_READ_NOTIFICATION_ID_KEY),
      ]);

      const latestId = data?.[0]?.id;
      setHasUnreadNotifications(Boolean(latestId) && String(latestId) !== String(lastReadId || ''));
    } catch {
      setHasUnreadNotifications(false);
    }
  }

  function handleCategoryPress(category) {
    setSelectedCategory(category);
    setSearch('');
    loadProducts(category.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleBack() {
    setSelectedCategory(null);
    setProducts([]);
    setSearch('');
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  function handleAddToCart(product) {
    addToCart({
      id: product.id,
      product_id: product.id,
      name: product.name,
      price: product.price,
      emoji: product.image_emoji,
      image_url: product.image_url || null,
      unit: product.unit,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function renderCategoryIcon(c) {
    if (c.image_url) {
      return <Image source={{ uri: c.image_url }} style={styles.catImage} resizeMode="cover" />;
    }
    return <Text style={styles.catEmoji}>{c.icon || '🥦'}</Text>;
  }

  function renderProductImage(p) {
    if (p.image_url) {
      return <Image source={{ uri: p.image_url }} style={styles.productImg} resizeMode="cover" />;
    }
    return <Text style={styles.productEmoji}>{p.image_emoji || '🥦'}</Text>;
  }

  const filteredProducts = search
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const greeting = user?.name
    ? `Hey ${user.name.split(' ')[0]}! 👋`
    : 'Welcome! 👋';

  // ── PRODUCTS VIEW ──────────────────────────────────
  if (selectedCategory) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedCategory.name}</Text>
          <TouchableOpacity style={styles.cartBtn} onPress={() => navigation.navigate('Cart')}>
            <Text style={styles.cartBtnText}>🛒</Text>
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={`Search in ${selectedCategory.name}...`}
            placeholderTextColor={Colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {productsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>😔</Text>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={p => String(p.id)}
            numColumns={2}
            columnWrapperStyle={{ gap: Spacing.sm }}
            contentContainerStyle={styles.productList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.productCard}>
                <View style={styles.productImageWrap}>
                  {renderProductImage(item)}
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.productUnit}>{item.unit}</Text>
                  <View style={styles.productBottom}>
                    <Text style={styles.productPrice}>₹{item.price}</Text>
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => handleAddToCart(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.addBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── HOME VIEW ──────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Image
            source={appLogo ? { uri: appLogo } : LOCAL_LOGO}
            style={{ width: 36, height: 36, borderRadius: 8 }}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerGreeting}>{greeting}</Text>
            <Text style={styles.headerSub}>What would you like today?</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.iconBtnEmoji}>🔔</Text>
            <Text style={styles.iconBtnLabel}>Alerts</Text>
            {hasUnreadNotifications ? <View style={styles.notifDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cartBtn} onPress={() => navigation.navigate('Cart')}>
            <Text style={styles.cartBtnText}>🛒</Text>
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Banners */}
        {banners.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            style={{ marginTop: Spacing.md }}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}
          >
            {banners.map(b => (
              <Image
                key={b.id}
                source={{ uri: b.image_url }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        {/* Categories Grid */}
        <View style={styles.section}>
          {/* Flash Deals Banner */}
          <TouchableOpacity
            style={styles.flashBanner}
            onPress={() => navigation.navigate('FlashDeals')}
            activeOpacity={0.85}
          >
            <Text style={styles.flashBannerEmoji}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.flashBannerTitle}>Flash Deals</Text>
              <Text style={styles.flashBannerSub}>Limited time offers — tap to explore!</Text>
            </View>
            <Text style={styles.flashBannerArrow}>→</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 30 }} />
          ) : (
            <View style={styles.catGrid}>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.catCard}
                  onPress={() => handleCategoryPress(c)}
                  activeOpacity={0.8}
                >
                  <View style={styles.catIconWrap}>
                    {renderCategoryIcon(c)}
                  </View>
                  <Text style={styles.catName} numberOfLines={2}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerGreeting: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  iconBtn: {
    backgroundColor: Colors.primaryPale,
    minWidth: 68,
    height: 52,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    position: 'relative',
  },
  iconBtnEmoji: { fontSize: 18 },
  iconBtnLabel: { fontSize: 10, color: Colors.primary, fontWeight: '800', marginTop: 1 },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  cartBtn: { position: 'relative', padding: Spacing.sm },
  cartBtnText: { fontSize: 26 },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: Colors.primary, borderRadius: 10,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  cartBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },

  bannerImage: {
    width: width - Spacing.lg * 2,
    height: 150,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
  },

  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  catCard: {
    width: CAT_SIZE, alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.sm, borderWidth: 1.5, borderColor: Colors.border,
    ...Shadow.sm,
  },
  catIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs, overflow: 'hidden',
  },
  catImage: { width: 56, height: 56, borderRadius: 28 },
  catEmoji: { fontSize: 32 },
  catName: { fontSize: 10, fontWeight: '600', color: Colors.text, textAlign: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.sm },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: FontSize.sm, color: Colors.text },
  clearBtn: { color: Colors.textMuted, fontSize: FontSize.sm, padding: Spacing.sm },

  productList: { padding: Spacing.lg, paddingBottom: 100 },
  productCard: {
    flex: 1, backgroundColor: Colors.white,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm,
    marginBottom: Spacing.md,
  },
  productImageWrap: {
    width: '100%', height: 120,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  productImg: { width: '100%', height: 120 },
  productEmoji: { fontSize: 56 },
  productInfo: { padding: Spacing.sm },
  productName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  productUnit: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  productBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  addBtn: {
    backgroundColor: Colors.primary, width: 28, height: 28,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: Colors.white, fontSize: 20, fontWeight: '700', lineHeight: 26 },

  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted },

  flashBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#fff3e0', borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: '#ffb300',
  },
  flashBannerEmoji: { fontSize: 32 },
  flashBannerTitle: { fontSize: FontSize.md, fontWeight: '800', color: '#e65100' },
  flashBannerSub: { fontSize: FontSize.xs, color: '#bf360c', marginTop: 2 },
  flashBannerArrow: { fontSize: FontSize.lg, color: '#e65100', fontWeight: '700' },
});
