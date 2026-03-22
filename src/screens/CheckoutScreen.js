import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { placeOrder, getSettings } from '../api/client';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

export default function CheckoutScreen({ navigation }) {
  const { user } = useAuth();
  const { cartItems, cartTotal, clearCart } = useCart();

  const savedAddress = user?.address || '';
  const [addressMode, setAddressMode] = useState(savedAddress ? 'saved' : 'new');
  const [newAddress, setNewAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  // Settings from backend
  const [settings, setSettings] = useState({
    free_delivery_above: 150,
    delivery_charges: 30,
    min_order_value: 150,
  });

  useEffect(() => {
    loadSettings();
  }, []);

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

  const FREE_DELIVERY_ABOVE = settings.free_delivery_above;
  const DELIVERY_CHARGE = settings.delivery_charges;

  const discount = promoApplied ? promoApplied.discount : 0;
  const deliveryCharges = cartTotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_CHARGE;
  const finalTotal = cartTotal + deliveryCharges - discount;

  const selectedAddress = addressMode === 'saved' ? savedAddress : newAddress;

  async function applyPromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const { data } = await applyPromoCode(promoCode.trim());
      setPromoApplied(data);
      Alert.alert('✅ Promo Applied!', `Discount of ₹${data.discount} applied!`);
    } catch (err) {
      Alert.alert('Invalid Code', err.response?.data?.error || 'Promo code not found.');
      setPromoApplied(null);
    } finally {
      setPromoLoading(false);
    }
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
        `Minimum order is ₹${settings.min_order_value}. Add ₹${needed} more for free delivery, or continue with ₹${DELIVERY_CHARGE} delivery charge.`,
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
      const items = cartItems.map(i => ({ product_id: i.product_id, quantity: i.qty }));
      await placeOrder(items, selectedAddress.trim(), notes.trim() || undefined);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();

      Alert.alert(
        '🎉 Order Placed!',
        `Your order is confirmed!\nTotal: ₹${finalTotal}\n${deliveryCharges > 0 ? `Includes ₹${DELIVERY_CHARGE} delivery charge.` : '🎉 Free delivery!'}\nPay on delivery.`,
        [{ text: 'Track Order', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Orders' } }] }) }]
      );
    } catch (err) {
      Alert.alert('Order Failed', err.response?.data?.error || 'Something went wrong. Try again.');
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
        keyboardVerticalOffset={0}
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
              <View key={i.product_id} style={styles.orderRow}>
                <Text style={styles.orderEmoji}>{i.emoji}</Text>
                <Text style={styles.orderName}>{i.name} × {i.qty}</Text>
                <Text style={styles.orderPrice}>₹{i.qty * i.price}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryVal}>₹{cartTotal}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Promo Discount</Text>
                <Text style={[styles.summaryVal, { color: Colors.success }]}>- ₹{discount}</Text>
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
          </View>

          {/* Delivery Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>

            {/* Saved address option — only show if user has address */}
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

            {/* New address option */}
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

        <View style={styles.footer}>
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
  orderName: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  orderPrice: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },

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
    fontSize: FontSize.sm, color: Colors.text,
    letterSpacing: 2,
  },
  promoBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, justifyContent: 'center',
  },
  promoBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  promoSuccess: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '600', marginTop: Spacing.sm },

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