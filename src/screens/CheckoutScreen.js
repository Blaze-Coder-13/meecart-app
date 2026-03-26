import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { placeOrder, getSettings, applyPromoCode, getMe, getReferralStats, getAvailablePromos } from '../api/client';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

function getApiErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

function isNetworkFailure(err) {
  const message = getApiErrorMessage(err, '').toLowerCase();
  return message.includes('network request failed') || message.includes('network error');
}

function formatPromoSummary(promo) {
  if (promo?.discount_type === 'percentage') {
    return `${promo.discount_value}% off`;
  }
  return `₹${promo?.discount_value || 0} off`;
}

function formatPromoRequirement(promo) {
  const minOrderValue = Number(promo?.min_order_value || 0);
  return minOrderValue > 0 ? `On orders of ₹${minOrderValue} or more` : 'No minimum order';
}

export default function CheckoutScreen({ navigation }) {
  const { user } = useAuth();
  const { cartItems, cartTotal, clearCart, addToCart, removeFromCart } = useCart();
  const insets = useSafeAreaInsets();

  const [savedAddress, setSavedAddress] = useState(user?.address || '');
  const [addressMode, setAddressMode] = useState(user?.address ? 'saved' : 'new');
  const [newAddress, setNewAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [availablePromos, setAvailablePromos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [referralStats, setReferralStats] = useState(null);
  const [settings, setSettings] = useState({
    free_delivery_above: 150,
    delivery_charges: 30,
    min_order_value: 150,
  });

  useEffect(() => {
    loadSettings();
    loadUserAddress();
    loadReferralDiscount();
    loadAvailablePromos();
  }, []);

  async function loadUserAddress() {
    try {
      const { data } = await getMe();
      if (data.address) {
        setSavedAddress(data.address);
        setAddressMode('saved');
        // Also update stored user
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const storedUser = await AsyncStorage.getItem('meecart_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          await AsyncStorage.setItem('meecart_user', JSON.stringify({ ...parsed, address: data.address }));
        }
      }
    } catch {}
  }

  async function loadSettings() {
    try {
      const { data } = await getSettings();
      setSettings({
        free_delivery_above: Number(data.free_delivery_above) || 150,
        delivery_charges: Number(data.delivery_charges) || 30,
        min_order_value: Number(data.min_order_value) || 150,
      });
    } catch {}
  }

  async function loadReferralDiscount() {
    try {
      const { data } = await getReferralStats();
      setReferralStats(data);
      if (data.referred_by && !data.referred_discount_claimed) {
        setReferralDiscount(data.discount_per_referral || 0);
      } else {
        setReferralDiscount(0);
      }
    } catch {}
  }

  async function loadAvailablePromos() {
    try {
      const { data } = await getAvailablePromos();
      setAvailablePromos(Array.isArray(data) ? data : []);
    } catch {
      setAvailablePromos([]);
    }
  }

  const FREE_DELIVERY_ABOVE = settings.free_delivery_above;
  const DELIVERY_CHARGE = settings.delivery_charges;
  const [referralDiscount, setReferralDiscount] = useState(0);
  const discount = (promoApplied ? promoApplied.discount : 0) + referralDiscount;
  const deliveryCharges = cartTotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_CHARGE;
  const finalTotal = cartTotal + deliveryCharges - discount;
  const selectedAddress = addressMode === 'saved' ? savedAddress : newAddress;

  function handleOrderSuccess() {
    clearCart();

    Alert.alert(
      'Order Placed!',
      `Your order is confirmed!\nTotal: \u20B9${finalTotal}\n${deliveryCharges > 0 ? `Includes \u20B9${DELIVERY_CHARGE} delivery charge.` : 'Free delivery!'}\nPay on delivery.`,
      [{ text: 'View Orders', onPress: () => {
        navigation.dispatch(
          require('@react-navigation/native').CommonActions.reset({
            index: 0,
            routes: [{ name: 'Main', state: { index: 2, routes: [{ name: 'Home' }, { name: 'Cart' }, { name: 'Orders' }] } }],
          })
        );
      }}]
    );
  }

  async function recoverRecentOrder() {
    try {
      const { getMyOrders } = require('../api/client');
      const { data } = await getMyOrders();
      const latestOrder = Array.isArray(data) ? data[0] : null;
      if (!latestOrder) return false;

      const orderCreatedAt = latestOrder.created_at ? new Date(latestOrder.created_at) : null;
      const isFresh = orderCreatedAt && !Number.isNaN(orderCreatedAt.getTime())
        ? Date.now() - orderCreatedAt.getTime() < 2 * 60 * 1000
        : false;
      const addressMatches = String(latestOrder.address || '').trim() === selectedAddress.trim();
      const totalMatches = Math.abs(Number(latestOrder.total || 0) - Number(finalTotal || 0)) <= 2;

      return Boolean(isFresh && addressMatches && totalMatches);
    } catch {
      return false;
    }
  }

  async function applyPromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const { data } = await applyPromoCode(promoCode.trim(), cartTotal);
      setPromoApplied(data);
      Alert.alert('✅ Promo Applied!', `Discount of ₹${data.discount} applied!`);
    } catch (err) {
      Alert.alert('Invalid Code', err.response?.data?.error || 'This promo code does not exist. Please check and try again.');
      setPromoApplied(null);
      setPromoCode('');
    } finally {
      setPromoLoading(false);
    }
  }

  async function applyReferralReward() {
    if (!referralStats?.bonus_code) return;
    setPromoCode(referralStats.bonus_code);
    setPromoLoading(true);
    try {
      const { data } = await applyPromoCode(referralStats.bonus_code, cartTotal);
      setPromoApplied(data);
      Alert.alert('Referral Reward Applied', `Discount of ₹${data.discount} applied!`);
    } catch (err) {
      Alert.alert('Unable to Apply Reward', err.response?.data?.error || 'Referral reward could not be applied.');
      setPromoApplied(null);
      setPromoCode('');
    } finally {
      setPromoLoading(false);
    }
  }

  async function applyAvailablePromo(code) {
    setPromoCode(code);
    setPromoApplied(null);
    setPromoLoading(true);
    try {
      const { data } = await applyPromoCode(code, cartTotal);
      setPromoApplied(data);
      setPromoCode(code);
      Alert.alert('Promo Applied!', `Discount of ₹${data.discount} applied!`);
    } catch (err) {
      Alert.alert('Unable to Apply', getApiErrorMessage(err, 'This offer could not be applied right now.'));
      setPromoApplied(null);
    } finally {
      setPromoLoading(false);
    }
  }

  function handleIncreaseQty(item) {
    if (item.is_flash_deal) {
      Alert.alert('Flash Deal', 'Flash deals can only be claimed once per order.');
      return;
    }
    addToCart({ id: item.product_id, product_id: item.product_id, ...item });
  }

  function handleDecreaseQty(item) {
    removeFromCart(item.product_id);
  }

  async function handlePlaceOrder() {
    if (selectedAddress.trim().length < 10) {
      Alert.alert('Address Required', 'Please enter your complete delivery address.');
      return;
    }

    if (cartTotal < settings.min_order_value) {
      const needed = settings.min_order_value - cartTotal;
      Alert.alert(
        'Low Order Value',
        `Minimum order is ₹${settings.min_order_value}. Add ₹${needed} more or continue with ₹${DELIVERY_CHARGE} delivery charge.`,
        [
          { text: 'Add More Items', style: 'cancel', onPress: () => navigation.goBack() },
          { text: 'Continue', onPress: confirmOrder },
        ]
      );
      return;
    }

    confirmOrder();
  }

  async function confirmOrder() {
    setLoading(true);
    try {
      const items = cartItems.map(i => ({
        product_id: i.product_id,
        quantity: i.qty,
        is_flash_deal: Boolean(i.is_flash_deal),
        unit: i.unit,
      }));
      const { data } = await placeOrder(
        items,
        selectedAddress.trim(),
        notes.trim() || undefined,
        promoApplied?.code,
        referralDiscount > 0,
        discount,
        finalTotal
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();

      Alert.alert(
        '🎉 Order Placed!',
        `Your order is confirmed!\nTotal: ₹${finalTotal}\n${deliveryCharges > 0 ? `Includes ₹${DELIVERY_CHARGE} delivery charge.` : '🎉 Free delivery!'}\nPay on delivery.`,
        [{ text: 'View Orders', onPress: () => {
          navigation.dispatch(
            require('@react-navigation/native').CommonActions.reset({
              index: 0,
              routes: [{ name: 'Main', state: { index: 2, routes: [{ name: 'Home' }, { name: 'Cart' }, { name: 'Orders' }] } }],
            })
          );
        }}]
      );
    } catch (err) {
      if (isNetworkFailure(err)) {
        const recovered = await recoverRecentOrder();
        if (recovered) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          handleOrderSuccess();
          return;
        }
      }
      Alert.alert('Order Failed', getApiErrorMessage(err, 'Something went wrong. Try again.'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* COD Badge */}
          <View style={styles.codCard}>
            <Text style={styles.codEmoji}>💵</Text>
            <View>
              <Text style={styles.codTitle}>Cash on Delivery</Text>
              <Text style={styles.codSub}>Pay when you receive — no advance needed</Text>
            </View>
          </View>

          {/* Order Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Order ({cartItems.length} items)</Text>
            {cartItems.map(i => (
              <View key={i.is_flash_deal ? `flash_${i.product_id}` : String(i.product_id)} style={styles.orderRow}>
                {i.image_url
                  ? <Image source={{ uri: i.image_url }} style={styles.orderImage} />
                  : <Text style={styles.orderEmoji}>{i.emoji}</Text>
                }
                <View style={styles.orderMeta}>
                  <Text style={styles.orderName}>{i.name}</Text>
                  <Text style={styles.orderQtyText}>{i.qty} x {i.unit}</Text>
                </View>
                <View style={styles.checkoutQtyCtrl}>
                  <TouchableOpacity
                    style={styles.checkoutQtyBtn}
                    onPress={() => handleDecreaseQty(i)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.checkoutQtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.checkoutQtyValue}>{i.qty}</Text>
                  <TouchableOpacity
                    style={styles.checkoutQtyBtn}
                    onPress={() => handleIncreaseQty(i)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.checkoutQtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.orderPrice}>₹{i.qty * i.price}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryVal}>₹{cartTotal}</Text>
            </View>
            {referralDiscount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>🎁 Referral Discount</Text>
                <Text style={[styles.summaryVal, { color: 'green' }]}>- ₹{referralDiscount}</Text>
              </View>
            )}
            {promoApplied && promoApplied.discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>🏷️ Promo Discount</Text>
                <Text style={[styles.summaryVal, { color: 'green' }]}>- ₹{promoApplied.discount}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Charges</Text>
              <Text style={[styles.summaryVal, deliveryCharges === 0 && styles.freeText]}>
                {deliveryCharges === 0 ? 'FREE' : `₹${DELIVERY_CHARGE}`}
              </Text>
            </View>
            {cartTotal < FREE_DELIVERY_ABOVE && (
              <View style={styles.freeDeliveryBanner}>
                <Text style={styles.freeDeliveryText}>
                  🎉 Add ₹{FREE_DELIVERY_ABOVE - cartTotal} more for FREE delivery!
                </Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmt}>₹{finalTotal}</Text>
            </View>
          </View>

          {/* Promo Code */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Promo Code (optional)</Text>
            {referralStats?.bonus_code && !promoApplied && (
              <TouchableOpacity style={styles.referralRewardBtn} onPress={applyReferralReward} activeOpacity={0.85}>
                <Text style={styles.referralRewardBtnText}>
                  Use referral reward code {referralStats.bonus_code}
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                value={promoCode}
                onChangeText={t => { setPromoCode(t.toUpperCase()); setPromoApplied(null); }}
                placeholder="Enter promo code"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                editable={!promoApplied}
              />
              {promoApplied ? (
                <TouchableOpacity
                  style={[styles.promoBtn, { backgroundColor: Colors.error }]}
                  onPress={() => { setPromoApplied(null); setPromoCode(''); }}
                >
                  <Text style={styles.promoBtnText}>Remove</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.promoBtn}
                  onPress={applyPromo}
                  disabled={promoLoading || !promoCode.trim()}
                >
                  {promoLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.promoBtnText}>Apply</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
            {promoApplied && (
              <Text style={styles.promoSuccess}>✅ {promoApplied.code} applied — ₹{promoApplied.discount} off!</Text>
            )}
            {availablePromos.length > 0 && (
              <View style={styles.availableOffersWrap}>
                <Text style={styles.availableOffersTitle}>Available Offers</Text>
                {availablePromos.map((promo) => {
                  const minOrderValue = Number(promo.min_order_value || 0);
                  const qualifies = cartTotal >= minOrderValue;
                  const isApplied = promoApplied?.code === promo.code;

                  return (
                    <View key={promo.code} style={styles.offerCard}>
                      <View style={styles.offerTextWrap}>
                        <Text style={styles.offerCode}>{promo.code}</Text>
                        <Text style={styles.offerSummary}>{formatPromoSummary(promo)}</Text>
                        <Text style={styles.offerRequirement}>{formatPromoRequirement(promo)}</Text>
                        {!qualifies && (
                          <Text style={styles.offerHint}>
                            Add ₹{minOrderValue - cartTotal} more to use this offer
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.offerApplyBtn,
                          (!qualifies || promoLoading || isApplied) && styles.offerApplyBtnDisabled,
                        ]}
                        disabled={!qualifies || promoLoading || isApplied}
                        onPress={() => applyAvailablePromo(promo.code)}
                      >
                        <Text style={styles.offerApplyBtnText}>{isApplied ? 'Applied' : 'Apply'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Delivery Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>

            {savedAddress ? (
              <TouchableOpacity
                style={[styles.addressOption, addressMode === 'saved' && styles.addressOptionActive]}
                onPress={() => setAddressMode(addressMode === 'saved' ? 'new' : 'saved')}
                activeOpacity={0.85}
              >
                <View style={styles.addressOptionLeft}>
                  <View style={[styles.radio, addressMode === 'saved' && styles.radioActive]}>
                    {addressMode === 'saved' && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressOptionLabel}>Saved Address</Text>
                    <Text style={styles.addressOptionText}>{savedAddress}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.addressOption, addressMode === 'new' && styles.addressOptionActive]}
              onPress={() => setAddressMode('new')}
              activeOpacity={0.85}
            >
              <View style={styles.addressOptionLeft}>
                <View style={[styles.radio, addressMode === 'new' && styles.radioActive]}>
                  {addressMode === 'new' && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.addressOptionLabel}>
                  {savedAddress ? 'Deliver to a different address' : 'Enter delivery address'}
                </Text>
              </View>
            </TouchableOpacity>

            {addressMode === 'new' && (
              <TextInput
                style={styles.addressInput}
                value={newAddress}
                onChangeText={setNewAddress}
                placeholder="House no., street, area, city, PIN code"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Leave at door, call on arrival…"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.footRow}>
            <Text style={styles.footLabel}>Pay on delivery</Text>
            <Text style={styles.footAmt}>₹{finalTotal}</Text>
          </View>
          <TouchableOpacity
            style={[styles.placeBtn, loading && styles.placeBtnDisabled]}
            onPress={handlePlaceOrder}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.placeBtnText}>Place Order — Pay on Delivery</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 20 },
  codCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primaryPale, borderRadius: Radius.md, padding: Spacing.lg,
  },
  codEmoji: { fontSize: 32 },
  codTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  codSub: { fontSize: FontSize.xs, color: Colors.primaryLight, marginTop: 2 },
  section: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.lg, ...Shadow.sm,
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  orderEmoji: { fontSize: 18 },
  orderMeta: { flex: 1 },
  orderName: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  orderQtyText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  orderPrice: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  orderImage: { width: 32, height: 32, borderRadius: 6 },
  checkoutQtyCtrl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  checkoutQtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutQtyBtnText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  checkoutQtyValue: {
    minWidth: 24,
    textAlign: 'center',
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  summaryLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  summaryVal: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  freeText: { color: Colors.primary, fontWeight: '700' },
  freeDeliveryBanner: {
    backgroundColor: Colors.primaryPale, borderRadius: Radius.sm,
    padding: Spacing.sm, marginVertical: Spacing.sm,
  },
  freeDeliveryText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', textAlign: 'center' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: Spacing.md, marginTop: Spacing.sm,
  },
  totalLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  totalAmt: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  promoRow: { flexDirection: 'row', gap: Spacing.sm },
  promoInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    fontSize: FontSize.sm, color: Colors.text, letterSpacing: 2,
  },
  promoBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, justifyContent: 'center',
  },
  promoBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  promoSuccess: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '600', marginTop: Spacing.sm },
  availableOffersWrap: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  availableOffersTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
  },
  offerTextWrap: {
    flex: 1,
  },
  offerCode: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primary,
  },
  offerSummary: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  offerRequirement: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  offerHint: {
    fontSize: FontSize.xs,
    color: '#b26a00',
    fontWeight: '600',
    marginTop: 4,
  },
  offerApplyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  offerApplyBtnDisabled: {
    backgroundColor: '#a0b5ac',
  },
  offerApplyBtnText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  referralRewardBtn: {
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  referralRewardBtnText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  addressOption: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
  },
  addressOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  addressOptionLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  addressOptionLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  addressOptionText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  addressInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: FontSize.sm, color: Colors.text,
    minHeight: 80, marginTop: Spacing.sm,
  },
  notesInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: FontSize.sm, color: Colors.text,
  },
  footer: {
    backgroundColor: Colors.white, padding: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.md,
  },
  footRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  footLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  footAmt: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  placeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  placeBtnDisabled: { backgroundColor: '#a0b5ac' },
  placeBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
