import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Alert, ScrollView, ActivityIndicator,
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
          <TouchableOpacity
            style={styles.referralCard}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('ReferralProgram')}
          >
            <View style={styles.referralTextWrap}>
              <Text style={styles.referralTitle}>Referral Program</Text>
              <Text style={styles.referralSub}>
                Your code: {displayUser.referral_code}
              </Text>
              <Text style={styles.referralHint}>
                Invite friends, track rewards, and see your referral status on a separate page.
              </Text>
            </View>
            <View style={styles.referralMeta}>
              {referralStats?.available_referral_rewards > 0 && (
                <View style={styles.referralPill}>
                  <Text style={styles.referralPillText}>{referralStats.available_referral_rewards} ready</Text>
                </View>
              )}
              <Text style={styles.referralArrow}>›</Text>
            </View>
          </TouchableOpacity>
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
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{saved ? 'Saved' : 'Save Changes'}</Text>}
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
  referralCard: {
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  referralTextWrap: { flex: 1 },
  referralTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  referralSub: { marginTop: 4, fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  referralHint: { marginTop: 6, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  referralMeta: { alignItems: 'flex-end', justifyContent: 'space-between' },
  referralPill: {
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  referralPillText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700' },
  referralArrow: { fontSize: 26, color: Colors.primary, fontWeight: '700' },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
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
