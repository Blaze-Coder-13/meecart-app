import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { sendOTP, verifyOTP, signup, login, resetPassword } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize, Spacing, Radius } from '../utils/theme';

// ── OTP INPUT ──────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const refs = useRef([]);
  const digits = value.split('');

  function handleChange(text, index) {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];

    if (text.length > 1) {
      const pasted = text.replace(/\D/g, '').slice(0, 6).split('');
      const filled = [...Array(6)].map((_, i) => pasted[i] || '');
      onChange(filled.join(''));
      refs.current[Math.min(pasted.length - 1, 5)]?.focus();
      return;
    }

    newDigits[index] = digit;
    onChange(newDigits.join(''));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  }

  function handleKeyPress(e, index) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={otp.row}>
      {[0,1,2,3,4,5].map(i => (
        <TextInput
          key={i}
          ref={r => refs.current[i] = r}
          style={[otp.box, digits[i] && otp.boxFilled]}
          value={digits[i] || ''}
          onChangeText={t => handleChange(t, i)}
          onKeyPress={e => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const otp = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: Spacing.lg },
  box: {
    width: 46, height: 54,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, fontSize: 22,
    fontWeight: '700', color: Colors.text,
    backgroundColor: '#fafafa',
  },
  boxFilled: { borderColor: Colors.primaryLight, backgroundColor: Colors.primaryPale },
});

// ── MAIN SCREEN ────────────────────────────────────────
export default function LoginScreen() {
  const { login: authLogin } = useAuth();
  const [screen, setScreen] = useState('login'); 
  // screens: login | register_phone | register_otp | register_details | forgot_phone | forgot_otp | forgot_reset

  // Shared state
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register details
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  function resetState() {
    setPhone(''); setPassword(''); setConfirmPassword('');
    setOtpCode(''); setName(''); setAddress('');
    setReferralCode(''); setError('');
    setShowPassword(false); setShowConfirm(false);
  }

  function goTo(s) { setError(''); setOtpCode(''); setScreen(s); }

  // ── LOGIN ──
  async function handleLogin() {
    setError('');
    if (!/^\d{10}$/.test(phone)) { setError('Enter a valid 10-digit mobile number'); return; }
    if (!password) { setError('Enter your password'); return; }
    setLoading(true);
    try {
      const { data } = await login(phone, password);
      await authLogin(data.token, data.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  }

  // ── REGISTER: SEND OTP ──
  async function handleRegisterSendOTP() {
    setError('');
    if (!/^\d{10}$/.test(phone)) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    try {
      await sendOTP(phone, 'signup');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goTo('register_otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP.');
    } finally { setLoading(false); }
  }

  // ── REGISTER: VERIFY OTP ──
  async function handleRegisterVerifyOTP() {
    setError('');
    if (otpCode.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      await verifyOTP(phone, otpCode, 'signup');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goTo('register_details');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired OTP.');
    } finally { setLoading(false); }
  }

  // ── REGISTER: CREATE ACCOUNT ──
  async function handleSignup() {
    setError('');
    if (!name.trim()) { setError('Enter your full name'); return; }
    if (!address.trim()) { setError('Enter your delivery address'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { data } = await signup(phone, name, address, password);
      await authLogin(data.token, data.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Try again.');
    } finally { setLoading(false); }
  }

  // ── FORGOT: SEND OTP ──
  async function handleForgotSendOTP() {
    setError('');
    if (!/^\d{10}$/.test(phone)) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    try {
      await sendOTP(phone, 'forgot');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goTo('forgot_otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP.');
    } finally { setLoading(false); }
  }

  // ── FORGOT: VERIFY OTP ──
  async function handleForgotVerifyOTP() {
    setError('');
    if (otpCode.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      await verifyOTP(phone, otpCode, 'forgot');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goTo('forgot_reset');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired OTP.');
    } finally { setLoading(false); }
  }

  // ── FORGOT: RESET PASSWORD ──
  async function handleResetPassword() {
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await resetPassword(phone, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Password reset successfully. Please login.', [
        { text: 'OK', onPress: () => { resetState(); goTo('login'); } }
      ]);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. Try again.');
    } finally { setLoading(false); }
  }

  // ── RENDER ──
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <View style={s.logoWrap}>
            <View style={s.logoBox}>
              <Text style={s.logoEmoji}>🛒</Text>
            </View>
            <Text style={s.logoName}>Meecart</Text>
            <Text style={s.logoSub}>Fresh vegetables, daily delivery</Text>
          </View>

          {/* ── LOGIN ── */}
          {screen === 'login' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Login</Text>

              <View style={s.fieldWrap}>
                <TextInput
                  style={s.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Mobile Number"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, s.inputPr]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.forgotBtn} onPress={() => { resetState(); goTo('forgot_phone'); }}>
                <Text style={s.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.switchWrap} onPress={() => { resetState(); goTo('register_phone'); }}>
                <Text style={s.switchText}>Don't have account? <Text style={s.switchLink}>Register here</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── REGISTER: PHONE ── */}
          {screen === 'register_phone' && (
            <View style={s.card}>
              <TouchableOpacity onPress={() => { resetState(); goTo('login'); }} style={s.backRow}>
                <Text style={s.backText}>← Back to Login</Text>
              </TouchableOpacity>
              <Text style={s.cardTitle}>Create Account</Text>
              <Text style={s.cardSub}>Enter your mobile number to get started</Text>

              <View style={s.fieldWrap}>
                <TextInput
                  style={s.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Mobile Number"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleRegisterSendOTP} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── REGISTER: OTP ── */}
          {screen === 'register_otp' && (
            <View style={s.card}>
              <TouchableOpacity onPress={() => goTo('register_phone')} style={s.backRow}>
                <Text style={s.backText}>← Change number</Text>
              </TouchableOpacity>
              <Text style={s.cardTitle}>Verify OTP</Text>
              <View style={s.sentBadge}>
                <Text style={s.sentText}>OTP sent to +91 {phone}</Text>
              </View>

              <OtpInput value={otpCode} onChange={setOtpCode} />

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleRegisterVerifyOTP} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify OTP</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.resendWrap} onPress={handleRegisterSendOTP} disabled={loading}>
                <Text style={s.resendText}>Didn't receive? <Text style={s.switchLink}>Resend OTP</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── REGISTER: DETAILS ── */}
          {screen === 'register_details' && (
            <View style={[s.card, { marginBottom: 40 }]}>
              <Text style={s.cardTitle}>Complete Profile</Text>
              <Text style={s.cardSub}>+91 {phone}</Text>

              <View style={s.fieldWrap}>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Delivery Address (House no., Street, Area, City)"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                />
              </View>

              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, s.inputPr]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create Password (min 6 characters)"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, s.inputPr]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm Password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                  <Text style={s.eyeIcon}>{showConfirm ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>


              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSignup} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── FORGOT: PHONE ── */}
          {screen === 'forgot_phone' && (
            <View style={s.card}>
              <TouchableOpacity onPress={() => { resetState(); goTo('login'); }} style={s.backRow}>
                <Text style={s.backText}>← Back to Login</Text>
              </TouchableOpacity>
              <Text style={s.cardTitle}>Forgot Password</Text>
              <Text style={s.cardSub}>Enter your registered mobile number</Text>

              <View style={s.fieldWrap}>
                <TextInput
                  style={s.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Mobile Number"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleForgotSendOTP} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── FORGOT: OTP ── */}
          {screen === 'forgot_otp' && (
            <View style={s.card}>
              <TouchableOpacity onPress={() => goTo('forgot_phone')} style={s.backRow}>
                <Text style={s.backText}>← Change number</Text>
              </TouchableOpacity>
              <Text style={s.cardTitle}>Verify OTP</Text>
              <View style={s.sentBadge}>
                <Text style={s.sentText}>OTP sent to +91 {phone}</Text>
              </View>

              <OtpInput value={otpCode} onChange={setOtpCode} />

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleForgotVerifyOTP} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify OTP</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── FORGOT: RESET ── */}
          {screen === 'forgot_reset' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Reset Password</Text>
              <Text style={s.cardSub}>Create a new password for +91 {phone}</Text>

              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, s.inputPr]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="New Password (min 6 characters)"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, s.inputPr]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm Password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                  <Text style={s.eyeIcon}>{showConfirm ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleResetPassword} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Reset Password</Text>}
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  logoWrap: { alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  logoBox: {
    width: 80, height: 80,
    backgroundColor: Colors.primary,
    borderRadius: 24, alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.md,
  },
  logoEmoji: { fontSize: 40 },
  logoName: { fontSize: 28, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  logoSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
  },

  cardTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xs },
  cardSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.lg },

  fieldWrap: { position: 'relative', marginBottom: Spacing.md },
  input: {
    borderBottomWidth: 1.5, borderBottomColor: Colors.border,
    paddingVertical: 12, paddingHorizontal: 4,
    fontSize: FontSize.md, color: Colors.text,
  },
  inputPr: { paddingRight: 40 },
  eyeBtn: { position: 'absolute', right: 4, top: 12 },
  eyeIcon: { fontSize: 18 },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: Spacing.lg },
  forgotText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  error: { color: Colors.error, fontSize: FontSize.sm, marginBottom: Spacing.md },

  btn: {
    backgroundColor: Colors.primary,
    padding: 16, borderRadius: Radius.full,
    alignItems: 'center', marginTop: Spacing.sm,
  },
  btnDisabled: { backgroundColor: '#a0b5ac' },
  btnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },

  switchWrap: { alignItems: 'center', marginTop: Spacing.xl },
  switchText: { fontSize: FontSize.sm, color: Colors.textMuted },
  switchLink: { color: Colors.primary, fontWeight: '700' },

  backRow: { marginBottom: Spacing.md },
  backText: { color: Colors.textMuted, fontSize: FontSize.sm },

  sentBadge: {
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.sm, padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sentText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },

  resendWrap: { alignItems: 'center', marginTop: Spacing.lg },
  resendText: { fontSize: FontSize.sm, color: Colors.textMuted },
});