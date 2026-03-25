import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Alert, ScrollView, ActivityIndicator,
  Clipboard,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfile, getSettings, getMe, getReferralStats } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout, login } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [profileUser, setProfileUser] = useState(user);
  const [name, setName] = useState(user?.name || '');
  const [address, setAddress] = useState(user?.address || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showReferralDetails, setShowReferralDetails] = useState(false);
  const [referralStats, setReferralStats] = useState(null);
  const [appSettings, setAppSettings] = useState({
    app_contact_email: 'support@meecart.com',
    app_contact_phone: '+91 9999999999',
    app_contact_address: '',
    app_name: 'Meecart',
    referral_discount: '30',
  });

  useEffect(() => {
    loadAppSettings();
    loadProfile();
  }, []);

  async function loadAppSettings() {
    try {
      const { data } = await getSettings();
      setAppSettings({
        app_contact_email: data.app_contact_email || 'support@meecart.com',
        app_contact_phone: data.app_contact_phone || '+91 9999999999',
        app_contact_address: data.app_contact_address || '',
        app_name: data.app_name || 'Meecart',
        referral_discount: data.referral_discount || '30',
      });
    } catch {}
  }

  async function loadProfile() {
    try {
      const [profileRes, statsRes] = await Promise.all([getMe(), getReferralStats()]);
      setProfileUser(profileRes.data);
      setName(profileRes.data.name || '');
      setAddress(profileRes.data.address || '');
      setReferralStats(statsRes.data);
    } catch {}
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const { data } = await updateProfile({ name, address });
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const token = await AsyncStorage.getItem('meecart_token');
      const nextUser = { ...user, ...profileUser, name: data.name, address: data.address };
      setProfileUser(nextUser);
      await login(token, nextUser);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert('Error', 'Failed to save profile. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  }

  function copyReferralCode() {
    if (!profileUser?.referral_code) return;
    Clipboard.setString(profileUser.referral_code);
    Alert.alert('Copied!', `Referral code ${profileUser.referral_code} copied to clipboard.`);
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>Account</Text>
          <Text style={styles.emptyTitle}>Not logged in</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayUser = profileUser || user;
  const initials = (displayUser?.name || displayUser?.phone || '').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.avatarName}>{displayUser?.name || 'Customer'}</Text>
          <Text style={styles.avatarPhone}>+91 {displayUser?.phone}</Text>
          {displayUser?.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>

        {displayUser?.referral_code && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.referralToggle}
              onPress={() => setShowReferralDetails(prev => !prev)}
              activeOpacity={0.85}
            >
              <View style={styles.referralToggleTextWrap}>
                <Text style={styles.sectionTitle}>Referral Program</Text>
                <Text style={styles.referralToggleSub}>
                  {showReferralDetails ? 'Hide referral details' : 'View your code, rewards and referral status'}
                </Text>
              </View>
              <Text style={styles.referralToggleIcon}>{showReferralDetails ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showReferralDetails && (
              <View>
                <Text style={styles.referralSubTitle}>Your Referral Code</Text>
                <TouchableOpacity style={styles.referralBox} onPress={copyReferralCode} activeOpacity={0.8}>
                  <Text style={styles.referralCode}>{displayUser.referral_code}</Text>
                  <Text style={styles.referralCopy}>Tap to copy</Text>
                </TouchableOpacity>
                <Text style={styles.referralHint}>
                  Share your code. Friends get ₹{appSettings.referral_discount || 30} off, and your reward unlocks after their order is delivered.
                </Text>

                {referralStats && (
                  <View style={styles.referralStats}>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{referralStats.referred_count}</Text>
                      <Text style={styles.statLbl}>Friends Referred</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>₹{referralStats.total_earned}</Text>
                      <Text style={styles.statLbl}>Total Earned</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>₹{referralStats.discount_per_referral}</Text>
                      <Text style={styles.statLbl}>Per Referral</Text>
                    </View>
                  </View>
                )}

                {referralStats?.referred_by && (
                  <View style={[styles.referralStatusBox, referralStats.referred_discount_claimed ? styles.referralStatusClaimed : styles.referralStatusPending]}>
                    <Text style={styles.referralStatusTitle}>Your Referral Discount</Text>
                    <Text style={styles.referralStatusText}>
                      {referralStats.referred_discount_claimed
                        ? `Claimed on an earlier order. You received ₹${referralStats.discount_per_referral} off.`
                        : `Available. ₹${referralStats.discount_per_referral} will be applied on your next eligible checkout until used once.`}
                    </Text>
                  </View>
                )}

                {referralStats && (referralStats.available_referral_rewards > 0 || referralStats.pending_referral_rewards > 0 || referralStats.used_referral_rewards > 0) && (
                  <View
                    style={[
                      styles.referralStatusBox,
                      referralStats.available_referral_rewards > 0
                        ? styles.referralStatusAvailable
                        : referralStats.pending_referral_rewards > 0
                          ? styles.referralStatusPending
                          : styles.referralStatusClaimed,
                    ]}
                  >
                    <Text style={styles.referralStatusTitle}>Your Referral Reward</Text>
                    <Text style={styles.referralStatusText}>
                      {referralStats.available_referral_rewards > 0
                        ? `Available now. You have ${referralStats.available_referral_rewards} reward${referralStats.available_referral_rewards > 1 ? 's' : ''} ready to use.`
                        : referralStats.pending_referral_rewards > 0
                          ? `Pending. You will get ₹${referralStats.discount_per_referral} after your referred person's order is delivered.`
                          : `Claimed. You have already used ${referralStats.used_referral_rewards} referral reward${referralStats.used_referral_rewards > 1 ? 's' : ''}.`}
                    </Text>
                  </View>
                )}

                {referralStats?.bonus_code && (
                  <View style={styles.bonusBox}>
                    <Text style={styles.bonusTitle}>Referral reward ready</Text>
                    <Text style={styles.bonusText}>
                      Use code <Text style={styles.bonusCode}>{referralStats.bonus_code}</Text> at checkout for ₹{referralStats.bonus_amount} off.
                    </Text>
                  </View>
                )}

                {referralStats?.referred_by && (
                  <View style={styles.referredByBox}>
                    <Text style={styles.referredByText}>
                      You were referred by {referralStats.referred_by_name || referralStats.referred_by_phone || 'a friend'}.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <View style={styles.inputDisabled}>
              <Text style={styles.inputDisabledText}>+91 {displayUser?.phone}</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Default Delivery Address</Text>
            <TextInput
              style={[styles.input, styles.addressInput]}
              value={address}
              onChangeText={setAddress}
              placeholder="House no., street, area, city"
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (saving || saved) && styles.saveBtnSaved]}
            onPress={handleSave}
            disabled={saving || saved}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{saved ? 'Saved' : 'Save Changes'}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App</Text>
            <Text style={styles.infoVal}>{appSettings.app_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoVal}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment</Text>
            <Text style={styles.infoVal}>Cash on Delivery</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact & Support</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoVal}>{appSettings.app_contact_email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoVal}>{appSettings.app_contact_phone}</Text>
          </View>
          {appSettings.app_contact_address ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={[styles.infoVal, styles.infoValRight]}>{appSettings.app_contact_address}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBar: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyIcon: { fontSize: FontSize.lg, marginBottom: Spacing.lg, color: Colors.textMuted },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xl },
  loginBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radius.md,
  },
  loginBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.white },
  avatarName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  avatarPhone: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  adminBadge: {
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: Spacing.sm,
  },
  adminBadgeText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700' },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  referralToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralToggleTextWrap: { flex: 1, paddingRight: Spacing.md },
  referralToggleSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  referralToggleIcon: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '700' },
  referralSubTitle: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted, marginBottom: Spacing.sm, marginTop: Spacing.md },
  referralBox: {
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderStyle: 'dashed',
  },
  referralCode: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary, letterSpacing: 4 },
  referralCopy: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  referralHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  referralStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statNum: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  statLbl: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  referralStatusBox: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
  },
  referralStatusPending: { backgroundColor: '#fff8e1', borderColor: '#ffd54f' },
  referralStatusAvailable: { backgroundColor: '#d8f3dc', borderColor: '#95d5b2' },
  referralStatusClaimed: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  referralStatusTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  referralStatusText: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  bonusBox: {
    backgroundColor: '#fff8e1',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#ffd54f',
  },
  bonusTitle: { fontSize: FontSize.sm, fontWeight: '700', color: '#f57f17', marginBottom: 4 },
  bonusText: { fontSize: FontSize.xs, color: Colors.text },
  bonusCode: { fontWeight: '800', color: Colors.primary, letterSpacing: 1 },
  referredByBox: {
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  referredByText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '500' },
  field: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted, marginBottom: Spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  addressInput: { minHeight: 80, textAlignVertical: 'top' },
  inputDisabled: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: '#f5f5f5',
  },
  inputDisabledText: { fontSize: FontSize.sm, color: Colors.textMuted },
  saveBtn: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnSaved: { backgroundColor: Colors.success },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  infoVal: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
  infoValRight: { flex: 1, textAlign: 'right' },
  logoutBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: Radius.md,
    padding: 14,
    alignItems: 'center',
  },
  logoutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: '700' },
});
