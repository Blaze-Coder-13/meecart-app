import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAvailablePromos, applyPromoCode, getReferralStats } from '../api/client';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

function getApiErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

function formatPromoSummary(promo) {
  if (promo?.discount_type === 'percentage') {
    return `${promo.discount_value}% off`;
  }
  return `₹${promo?.discount_value || 0} off`;
}

function formatPromoRequirement(promo) {
  const minOrderValue = Number(promo?.min_order_value || 0);
  return minOrderValue > 0 ? `Minimum order ₹${minOrderValue}` : 'No minimum order';
}

export default function PromoOffersScreen({ navigation, route }) {
  const cartTotal = Number(route?.params?.cartTotal || 0);
  const promoAppliedCode = route?.params?.promoAppliedCode || '';
  const [offers, setOffers] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyingCode, setApplyingCode] = useState('');

  useEffect(() => {
    loadOffers();
  }, []);

  async function loadOffers() {
    setLoading(true);
    try {
      const [offersRes, statsRes] = await Promise.all([
        getAvailablePromos(),
        getReferralStats().catch(() => ({ data: null })),
      ]);
      setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
      setReferralStats(statsRes.data || null);
    } finally {
      setLoading(false);
    }
  }

  const mergedOffers = useMemo(() => {
    const baseOffers = [...offers];
    if (referralStats?.bonus_code) {
      const exists = baseOffers.some((offer) => offer.code === referralStats.bonus_code);
      if (!exists) {
        baseOffers.unshift({
          code: referralStats.bonus_code,
          discount_type: 'flat',
          discount_value: referralStats.bonus_amount || referralStats.discount_per_referral || 0,
          min_order_value: 0,
          is_referral_bonus: true,
        });
      }
    }
    return baseOffers;
  }, [offers, referralStats]);

  async function handleApply(code) {
    setApplyingCode(code);
    try {
      const { data } = await applyPromoCode(code, cartTotal);
      navigation.navigate({
        name: 'Checkout',
        params: { selectedPromo: data },
        merge: true,
      });
    } catch (err) {
      Alert.alert('Unable to Apply', getApiErrorMessage(err, 'This offer could not be applied right now.'));
    } finally {
      setApplyingCode('');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promo Offers</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Available offers for your order</Text>
            <Text style={styles.heroSub}>Current cart total: ₹{cartTotal}</Text>
          </View>

          {mergedOffers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No offers available right now</Text>
              <Text style={styles.emptyText}>You can still place your order normally.</Text>
            </View>
          ) : (
            mergedOffers.map((promo) => {
              const minOrderValue = Number(promo.min_order_value || 0);
              const qualifies = cartTotal >= minOrderValue;
              const isApplied = promoAppliedCode === promo.code;
              const isApplying = applyingCode === promo.code;

              return (
                <View key={promo.code} style={styles.offerCard}>
                  <View style={styles.offerTopRow}>
                    <View style={styles.offerBadge}>
                      <Text style={styles.offerCode}>{promo.code}</Text>
                    </View>
                    {promo.is_referral_bonus && <Text style={styles.offerTag}>Referral reward</Text>}
                  </View>
                  <Text style={styles.offerSummary}>{formatPromoSummary(promo)}</Text>
                  <Text style={styles.offerRequirement}>{formatPromoRequirement(promo)}</Text>
                  {!qualifies && (
                    <Text style={styles.offerHint}>
                      Add ₹{minOrderValue - cartTotal} more to unlock this offer
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.applyBtn,
                      (!qualifies || isApplied || isApplying) && styles.applyBtnDisabled,
                    ]}
                    disabled={!qualifies || isApplied || isApplying}
                    onPress={() => handleApply(promo.code)}
                  >
                    {isApplying ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.applyBtnText}>{isApplied ? 'Applied' : 'Apply Offer'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  hero: {
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  heroTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  heroSub: { marginTop: 4, fontSize: FontSize.sm, color: Colors.primaryLight },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Shadow.sm,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  emptyText: { marginTop: 6, fontSize: FontSize.sm, color: Colors.textMuted },
  offerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  offerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  offerBadge: {
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  offerCode: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary },
  offerTag: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
  offerSummary: { marginTop: Spacing.md, fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  offerRequirement: { marginTop: 4, fontSize: FontSize.sm, color: Colors.textMuted },
  offerHint: { marginTop: 8, fontSize: FontSize.xs, color: '#b26a00', fontWeight: '700' },
  applyBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  applyBtnDisabled: { backgroundColor: '#a0b5ac' },
  applyBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
});
