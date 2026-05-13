import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { getMe, getReferralStats, getSettings } from '../api/client';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

export default function ReferralProgramScreen({ navigation }) {
  const [profileUser, setProfileUser] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appSettings, setAppSettings] = useState({
    referral_discount: '30',
  });

  useEffect(() => {
    loadReferralData();
  }, []);

  async function loadReferralData() {
    setLoading(true);
    try {
      const [profileRes, statsRes, settingsRes] = await Promise.all([
        getMe(),
        getReferralStats(),
        getSettings().catch(() => ({ data: {} })),
      ]);
      setProfileUser(profileRes.data);
      setReferralStats(statsRes.data);
      setAppSettings({
        referral_discount: settingsRes.data?.referral_discount || '30',
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyReferralCode() {
    if (!profileUser?.referral_code) return;
    await Clipboard.setStringAsync(profileUser.referral_code);
    Alert.alert('Copied', `Referral code ${profileUser.referral_code} copied.`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Referral Program</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Invite friends and earn rewards</Text>
            <Text style={styles.heroText}>
              Share your code. Friends get ₹{appSettings.referral_discount || 30} off, and your reward unlocks after their order is delivered.
            </Text>
          </View>

          {profileUser?.referral_code && (
            <TouchableOpacity style={styles.codeCard} onPress={copyReferralCode} activeOpacity={0.85}>
              <Text style={styles.codeLabel}>Your referral code</Text>
              <Text style={styles.codeValue}>{profileUser.referral_code}</Text>
              <Text style={styles.codeHint}>Tap to copy</Text>
            </TouchableOpacity>
          )}

          {referralStats && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{referralStats.referred_count}</Text>
                <Text style={styles.statLabel}>Friends Referred</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>₹{referralStats.total_earned}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>₹{referralStats.discount_per_referral}</Text>
                <Text style={styles.statLabel}>Per Referral</Text>
              </View>
            </View>
          )}

          {referralStats?.referred_by && (
            <View style={[styles.statusCard, referralStats.referred_discount_claimed ? styles.statusClaimed : styles.statusPending]}>
              <Text style={styles.statusTitle}>Your Referral Discount</Text>
              <Text style={styles.statusText}>
                {referralStats.referred_discount_claimed
                  ? `Claimed already. You received ₹${referralStats.discount_per_referral} off on an earlier order.`
                  : `Available. ₹${referralStats.discount_per_referral} will be applied on your next eligible checkout until used once.`}
              </Text>
            </View>
          )}

          {referralStats && (referralStats.available_referral_rewards > 0 || referralStats.pending_referral_rewards > 0 || referralStats.used_referral_rewards > 0) && (
            <View
              style={[
                styles.statusCard,
                referralStats.available_referral_rewards > 0
                  ? styles.statusAvailable
                  : referralStats.pending_referral_rewards > 0
                    ? styles.statusPending
                    : styles.statusClaimed,
              ]}
            >
              <Text style={styles.statusTitle}>Your Referral Reward</Text>
              <Text style={styles.statusText}>
                {referralStats.available_referral_rewards > 0
                  ? `Available now. You have ${referralStats.available_referral_rewards} reward${referralStats.available_referral_rewards > 1 ? 's' : ''} ready to use.`
                  : referralStats.pending_referral_rewards > 0
                    ? `Pending. You will get ₹${referralStats.discount_per_referral} after your referred person's order is delivered.`
                    : `Claimed. You already used ${referralStats.used_referral_rewards} referral reward${referralStats.used_referral_rewards > 1 ? 's' : ''}.`}
              </Text>
            </View>
          )}

          {referralStats?.bonus_code && (
            <View style={styles.bonusCard}>
              <Text style={styles.bonusTitle}>Referral reward ready</Text>
              <Text style={styles.bonusText}>
                Use code <Text style={styles.bonusCode}>{referralStats.bonus_code}</Text> at checkout for ₹{referralStats.bonus_amount} off.
              </Text>
            </View>
          )}

          {referralStats?.referred_by && (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                You were referred by {referralStats.referred_by_name || referralStats.referred_by_phone || 'a friend'}.
              </Text>
            </View>
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
  heroTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  heroText: { marginTop: 6, fontSize: FontSize.sm, color: Colors.primaryLight, lineHeight: 20 },
  codeCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderStyle: 'dashed',
    ...Shadow.sm,
  },
  codeLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  codeValue: { marginTop: 10, fontSize: FontSize.xxl, color: Colors.primary, fontWeight: '800', letterSpacing: 3 },
  codeHint: { marginTop: 8, fontSize: FontSize.xs, color: Colors.textMuted },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadow.sm,
  },
  statValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  statLabel: { marginTop: 4, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  statusCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  statusPending: { backgroundColor: '#fff8e1', borderColor: '#ffd54f' },
  statusAvailable: { backgroundColor: '#d8f3dc', borderColor: '#95d5b2' },
  statusClaimed: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  statusTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  statusText: { marginTop: 6, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  bonusCard: {
    backgroundColor: '#fff8e1',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#ffd54f',
  },
  bonusTitle: { fontSize: FontSize.sm, fontWeight: '700', color: '#f57f17' },
  bonusText: { marginTop: 6, fontSize: FontSize.sm, color: Colors.text },
  bonusCode: { color: Colors.primary, fontWeight: '800', letterSpacing: 1 },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  infoText: { fontSize: FontSize.sm, color: Colors.text },
});
