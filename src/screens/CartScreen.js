import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

function CartItem({ item, onInc, onDec }) {
  return (
    <View style={styles.item}>
      {item.image_url
        ? <Image source={{ uri: item.image_url }} style={styles.itemImage} />
        : <Text style={styles.itemEmoji}>{item.emoji}</Text>
      }
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemUnit}>{`\u20B9${item.price} / ${item.unit}`}</Text>
      </View>
      <View style={styles.qtyCtrl}>
        <TouchableOpacity style={styles.qBtn} onPress={onDec} activeOpacity={0.7}>
          <Text style={styles.qBtnText}>{'\u2212'}</Text>
        </TouchableOpacity>
        <Text style={styles.qNum}>{item.qty}</Text>
        <TouchableOpacity style={styles.qBtn} onPress={onInc} activeOpacity={0.7}>
          <Text style={styles.qBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.itemTotal}>{`\u20B9${item.qty * item.price}`}</Text>
    </View>
  );
}

export default function CartScreen({ navigation }) {
  const { user } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const { cartItems, cartTotal, cartCount, addToCart, removeFromCart, clearCart } = useCart();

  function handleClear() {
    Alert.alert('Clear Cart', 'Remove all items from cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  }

  function handleCheckout() {
    if (!user) {
      Alert.alert('Login Required', 'Please login to place an order.', [
        { text: 'Login', onPress: () => navigation.navigate('Login') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    navigation.navigate('Checkout');
  }

  if (!cartItems.length) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cart</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{'\uD83D\uDED2'}</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Add some fresh vegetables!</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.shopBtnText}>Browse Vegetables {'\u2192'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{`Cart (${cartCount})`}</Text>
        <TouchableOpacity onPress={handleClear}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={i => (i.is_flash_deal ? `flash_${i.product_id}` : String(i.product_id))}
        renderItem={({ item }) => (
          <CartItem
            item={item}
            onInc={() => {
              if (item.is_flash_deal) {
                Alert.alert('Flash Deal', 'Flash deals can only be claimed once per order!');
                return;
              }
              addToCart({ id: item.product_id, product_id: item.product_id, ...item });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onDec={() => {
              removeFromCart(item.product_id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + Spacing.xl }]}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            {cartItems.map(i => (
              <View
                key={i.is_flash_deal ? `flash_${i.product_id}` : String(i.product_id)}
                style={styles.summaryRow}
              >
                <Text style={styles.summaryLabel}>{`${i.name} (${i.qty} x ${i.unit})`}</Text>
                <Text style={styles.summaryVal}>{`\u20B9${i.qty * i.price}`}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelStrong}>Total</Text>
              <Text style={styles.totalAmt}>{`\u20B9${cartTotal}`}</Text>
            </View>
            <View style={styles.codBadge}>
              <Text style={styles.codIcon}>{'\uD83D\uDCB5'}</Text>
              <View style={styles.codTextWrap}>
                <Text style={styles.codTitle}>Cash on Delivery</Text>
                <Text style={styles.codSub}>Pay when you receive your order</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout} activeOpacity={0.9}>
              <Text style={styles.checkoutBtnText}>Proceed to Checkout {'\u2192'}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.text },
  headerSpacer: { width: 40 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  clearText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.lg },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.xxl },
  shopBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radius.md,
  },
  shopBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  itemEmoji: { fontSize: 28 },
  itemImage: { width: 48, height: 48, borderRadius: 8 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  itemUnit: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  qtyCtrl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  qBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  qBtnText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  qNum: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm, minWidth: 24, textAlign: 'center' },
  itemTotal: { fontWeight: '700', fontSize: FontSize.sm, color: Colors.primary, minWidth: 48, textAlign: 'right' },
  sep: { height: Spacing.sm },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    ...Shadow.sm,
  },
  summaryTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  summaryLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textMuted, paddingRight: Spacing.md },
  summaryLabelStrong: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  summaryVal: { fontSize: FontSize.sm, color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  totalAmt: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  codBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  codIcon: { fontSize: 24 },
  codTextWrap: { flex: 1 },
  codTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  codSub: { fontSize: FontSize.xs, color: Colors.primaryLight, marginTop: 2 },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  checkoutBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
