import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getProducts, getCategories } from '../api/client';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

function ProductCard({ product, qty, onAdd, onInc, onDec }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardEmoji}>{product.image_emoji}</Text>
      <Text style={styles.cardName} numberOfLines={1}>{product.name}</Text>
      <Text style={styles.cardUnit}>per {product.unit}</Text>
      <Text style={styles.cardPrice}>₹{product.price}</Text>
      {qty === 0 ? (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.qtyCtrl}>
          <TouchableOpacity style={styles.qBtn} onPress={onDec} activeOpacity={0.7}>
            <Text style={styles.qBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qNum}>{qty}</Text>
          <TouchableOpacity style={styles.qBtn} onPress={onInc} activeOpacity={0.7}>
            <Text style={styles.qBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function CategoryCard({ category, onPress }) {
  return (
    <TouchableOpacity style={styles.catCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.catIconWrap}>
        <Text style={styles.catEmoji}>{category.icon}</Text>
      </View>
      <Text style={styles.catCardName} numberOfLines={2}>{category.name}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { cart, cartCount, addToCart, removeFromCart } = useCart();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeCategoryName, setActiveCategoryName] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState('categories'); // 'categories' or 'products'

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const res = await getCategories();
      setCategories(res.data);
    } catch {}
    setLoading(false);
  }

  async function loadProducts(categoryId, categoryName) {
    setLoadingProducts(true);
    try {
      const params = {};
      if (categoryId) params.category = categoryId;
      if (search) params.search = search;
      const res = await getProducts(params);
      setProducts(res.data);
      setActiveCategory(categoryId);
      setActiveCategoryName(categoryName);
      setView('products');
    } catch {}
    setLoadingProducts(false);
  }

  async function handleSearch(text) {
    setSearch(text);
    if (text.length > 1) {
      setLoadingProducts(true);
      try {
        const res = await getProducts({ search: text });
        setProducts(res.data);
        setView('products');
        setActiveCategoryName(`Results for "${text}"`);
      } catch {}
      setLoadingProducts(false);
    } else if (text.length === 0 && view === 'products' && !activeCategory) {
      setView('categories');
    }
  }

  function goBackToCategories() {
    setActiveCategory(null);
    setActiveCategoryName('');
    setSearch('');
    setView('categories');
    setProducts([]);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (view === 'categories') {
      await loadCategories();
    } else if (activeCategory) {
      await loadProducts(activeCategory, activeCategoryName);
    }
    setRefreshing(false);
  }, [view, activeCategory, activeCategoryName]);

  function handleAdd(product) {
    addToCart(product);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function renderHero() {
    return (
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroGreet}>
              Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
            </Text>
            <Text style={styles.heroTitle}>Fresh Vegetables{'\n'}Delivered Daily</Text>
          </View>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.85}
          >
            <Text style={styles.cartIcon}>🛒</Text>
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search vegetables…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(''); setView('categories'); }}>
              <Text style={{ color: Colors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // CATEGORIES VIEW
  if (view === 'categories') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FlatList
          data={categories}
          keyExtractor={c => String(c.id)}
          numColumns={3}
          columnWrapperStyle={styles.catRow}
          ListHeaderComponent={
            <>
              {renderHero()}
              <Text style={styles.secTitle}>Shop by Category</Text>
            </>
          }
          renderItem={({ item }) => (
            <CategoryCard
              category={item}
              onPress={() => loadProducts(item.id, item.name)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    );
  }

  // PRODUCTS VIEW
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Back bar */}
      <View style={styles.backBar}>
        <TouchableOpacity style={styles.backBtn} onPress={goBackToCategories}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.backTitle}>{activeCategoryName}</Text>
        <TouchableOpacity
          style={styles.cartBtnSmall}
          onPress={() => navigation.navigate('Cart')}
        >
          <Text style={styles.cartIcon}>🛒</Text>
          {cartCount > 0 && (
            <View style={styles.cartBadgeSmall}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loadingProducts ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => String(p.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🥲</Text>
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              qty={cart[item.id]?.qty || 0}
              onAdd={() => handleAdd(item)}
              onInc={() => { addToCart(item); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              onDec={() => { removeFromCart(item.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {cartCount > 0 && (
        <TouchableOpacity
          style={styles.floatingCart}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.9}
        >
          <Text style={styles.floatingCartText}>🛒 View Cart ({cartCount} items)</Text>
          <Text style={styles.floatingCartArrow}>→</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm },

  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 32,
  },
  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.xl,
  },
  heroGreet: { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.sm, marginBottom: 4 },
  heroTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '800', lineHeight: 28 },

  cartBtn: {
    width: 48, height: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cartBtnSmall: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  cartIcon: { fontSize: 22 },
  cartBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.accent,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeSmall: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: Colors.accent,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: FontSize.sm, color: Colors.text },

  secTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.text,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
  },

  catRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  catCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadow.sm,
  },
  catIconWrap: {
    width: 64, height: 64,
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  catEmoji: { fontSize: 32 },
  catCardName: {
    fontSize: FontSize.xs, fontWeight: '700',
    color: Colors.text, textAlign: 'center',
  },

  backBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: Colors.text },
  backTitle: {
    flex: 1, fontSize: FontSize.lg,
    fontWeight: '700', color: Colors.text,
    marginLeft: Spacing.sm,
  },

  listContent: { paddingBottom: 100 },
  row: { paddingHorizontal: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.md },

  card: {
    flex: 1, backgroundColor: Colors.white,
    borderRadius: Radius.lg, padding: Spacing.md,
    alignItems: 'center', ...Shadow.sm,
  },
  cardEmoji: { fontSize: 40, marginBottom: Spacing.sm },
  cardName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: 2, textAlign: 'center' },
  cardUnit: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  cardPrice: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.md },
  addBtn: {
    width: '100%', paddingVertical: 8,
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.sm, alignItems: 'center',
  },
  addBtnText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700' },
  qtyCtrl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm, overflow: 'hidden', width: '100%',
  },
  qBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  qBtnText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  qNum: { flex: 1, color: Colors.white, fontWeight: '700', fontSize: FontSize.sm, textAlign: 'center' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },

  floatingCart: {
    position: 'absolute', bottom: 20, left: Spacing.xl, right: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...Shadow.lg,
  },
  floatingCartText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  floatingCartArrow: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '700' },
});