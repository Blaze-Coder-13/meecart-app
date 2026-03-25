import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { sendOTP, verifyOTP, signup, login, resetPassword, getSettings, validateReferralCode } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize, Spacing, Radius } from '../utils/theme';

const LOCAL_LOGO = require('../../assets/logo.png');

function AppLogo({ size = 60 }) {
  const [logo, setLogo] = useState('');
  const [name, setName] = useState('Meecart');

  useEffect(() => {
    getSettings().then(({ data }) => {
      if (data.app_logo_url) setLogo(data.app_logo_url);
      if (data.app_name) setName(data.app_name);
    }).catch(() => {});
  }, []);

  return (
    <Image
      source={logo ? { uri: logo } : LOCAL_LOGO}
      style={{ width: size, height: size, borderRadius: size * 0.2, marginBottom: 8 }}
      resizeMode="contain"
    />
  );
}

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

export default function LoginScreen() {
  const { login: authLogin } = useAuth();
  const [screen, setScreen] = useState('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralStatus, setReferralStatus] = useState(null);
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [appName, setAppName] = useState('Meecart');

  useEffect(() => {
    getSettings().then(({ data }) => {
      if (data.app_name) setAppName(data.app_name);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!referralCode.trim()) {
      setCheckingReferral(false);
      setReferralStatus(null);
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      setCheckingReferral(true);
      try {
        const { data } = await validateReferralCode(referralCode.trim().toUpperCase());
        setReferralStatus({ valid: true, message: data.message || 'Valid referral code' });
      } catch (err) {
        setReferralStatus({ valid: false, message: err.response?.data?.error || 'Invalid referral code' });
      } finally {
        setCheckingReferral(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      setCheckingReferral(false);
    };
  }, [referralCode]);

  function resetState() {
    setPhone(''); setPassword(''); setConfirmPassword('');
    setOtpCode(''); setName(''); setAddress(''); setReferralCode('');
    setReferralStatus(null);
    setError(''); setShowPassword(false); setShowConfirm(false);
  }

  function goTo(s) { setError(''); setOtpCode(''); setScreen(s); }

  function goToLoginWithPhone(nextPhone, message) {
    setOtpCode('');
    setPassword('');
    setConfirmPassword('');
    setScreen('login');
    if (nextPhone) setPhone(nextPhone);
    setError(message || '');
  }

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

  async function handleRegisterSendOTP() {
    setError('');
    if (!/^\d{10}$/.test(phone)) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    try {
      await sendOTP(phone, 'signup');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goTo('register_otp');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to send OTP.';
      if (/already registered|please login/i.test(message)) {
        goToLoginWithPhone(phone, 'This number is already registered. Please login.');
      } else {
        setError(message);
      }
    } finally { setLoading(false); }
  }

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

  async function handleSignup() {
    setError('');
    if (!name.trim()) { setError('Enter your full name'); return; }
    if (!address.trim()) { setError('Enter your delivery address'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (referralCode.trim() && checkingReferral) { setError('Please wait while we verify the referral code'); return; }
    if (referralCode.trim() && !referralStatus?.valid) { setError('Please enter a valid referral code or remove it'); return; }
    setLoading(true);
    try {
      const { data } = await signup(phone, name, address, password, referralCode || undefined);
      await authLogin(data.token, { ...data.user, address: address.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Try again.');
    } finally { setLoading(false); }
  }

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

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          {/* Logo */}
          <View style={s.logoWrap}>
            <AppLogo size={80} />
            <Text style={s.logoName}>{appName}</Text>
            <Text style={s.logoSub}>Fresh vegetables, daily delivery</Text>
          </View>

          {/* LOGIN */}
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
              <TouchableOpacity onPress={() => { resetState(); goTo('forgot_phone'); }} style={s.forgotBtn}>
                <Text style={s.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.switchWrap} onPress={() => { resetState(); goTo('register_phone'); }} activeOpacity={0.7}>
                <Text style={s.switchText}>Don't have account? <Text style={s.switchLink}>Register here</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {/* REGISTER PHONE */}
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

          {/* REGISTER OTP */}
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

          {/* REGISTER DETAILS */}
          {screen === 'register_details' && (
            <View style={[s.card, { marginBottom: 40 }]}>
              <Text style={s.cardTitle}>Complete Profile</Text>
              <Text style={s.cardSub}>+91 {phone}</Text>
              <View style={s.fieldWrap}>
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Full Name" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={address} onChangeText={setAddress}
                  placeholder="Delivery Address (House no., Street, Area, City)"
                  placeholderTextColor={Colors.textMuted} multiline
                />
              </View>
              <View style={s.fieldWrap}>
                <TextInput
                  style={s.input} value={referralCode}
                  onChangeText={text => setReferralCode(text.toUpperCase())}
                  placeholder="Referral Code (optional)"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                />
                {checkingReferral && (
                  <View style={[s.referralHintBox, s.referralHintBoxNeutral]}>
                    <Text style={[s.referralHintText, s.referralHintTextNeutral]}>
                      Checking referral code...
                    </Text>
                  </View>
                )}
                {referralStatus?.valid && (
                  <View style={[
                    s.referralHintBox,
                    referralStatus.valid ? s.referralHintBoxValid : s.referralHintBoxInvalid,
                  ]}>
                    <Text style={[
                      s.referralHintText,
                      referralStatus.valid ? s.referralHintTextValid : s.referralHintTextInvalid,
                    ]}>
                      🎉 Valid referral code = ₹30 off your first order!
                    </Text>
                  </View>
                )}
                {referralStatus && !referralStatus.valid && (
                  <View style={[s.referralHintBox, s.referralHintBoxInvalid]}>
                    <Text style={[s.referralHintText, s.referralHintTextInvalid]}>
                      Referral code invalid. {referralStatus.message}
                    </Text>
                  </View>
                )}
              </View>
              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, s.inputPr]} value={password} onChangeText={setPassword}
                  placeholder="Create Password (min 6 characters)"
                  placeholderTextColor={Colors.textMuted} secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, s.inputPr]} value={confirmPassword} onChangeText={setConfirmPassword}
                  placeholder="Confirm Password"
                  placeholderTextColor={Colors.textMuted} secureTextEntry={!showConfirm}
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

          {/* FORGOT PHONE */}
          {screen === 'forgot_phone' && (
            <View style={s.card}>
              <TouchableOpacity onPress={() => { resetState(); goTo('login'); }} style={s.backRow}>
                <Text style={s.backText}>← Back to Login</Text>
              </TouchableOpacity>
              <Text style={s.cardTitle}>Forgot Password</Text>
              <Text style={s.cardSub}>Enter your registered mobile number</Text>
              <View style={s.fieldWrap}>
                <TextInput
                  style={s.input} value={phone} onChangeText={setPhone}
                  placeholder="Mobile Number" placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad" maxLength={10}
                />
              </View>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleForgotSendOTP} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* FORGOT OTP */}
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

          {/* FORGOT RESET */}
          {screen === 'forgot_reset' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Reset Password</Text>
              <Text style={s.cardSub}>Create a new password for +91 {phone}</Text>
              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, s.inputPr]} value={password} onChangeText={setPassword}
                  placeholder="New Password (min 6 characters)"
                  placeholderTextColor={Colors.textMuted} secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <View style={s.fieldWrap}>
                <TextInput
                  style={[s.input, s.inputPr]} value={confirmPassword} onChangeText={setConfirmPassword}
                  placeholder="Confirm Password"
                  placeholderTextColor={Colors.textMuted} secureTextEntry={!showConfirm}
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
  logoName: { fontSize: 28, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  logoSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.xxl, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
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
  forgotBtn: { alignSelf: 'flex-end', marginBottom: Spacing.lg, padding: 4 },
  forgotText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  error: { color: Colors.error, fontSize: FontSize.sm, marginBottom: Spacing.md },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: Radius.full, alignItems: 'center', marginTop: Spacing.sm },
  btnDisabled: { backgroundColor: '#a0b5ac' },
  btnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  switchWrap: { alignItems: 'center', marginTop: Spacing.xl, padding: 8 },
  switchText: { fontSize: FontSize.sm, color: Colors.textMuted },
  switchLink: { color: Colors.primary, fontWeight: '700' },
  backRow: { marginBottom: Spacing.md, padding: 4 },
  backText: { color: Colors.textMuted, fontSize: FontSize.sm },
  sentBadge: { backgroundColor: Colors.primaryPale, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.lg },
  sentText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  resendWrap: { alignItems: 'center', marginTop: Spacing.lg, padding: 8 },
  resendText: { fontSize: FontSize.sm, color: Colors.textMuted },
  referralHintBox: { borderRadius: 8, padding: 10, marginTop: 6 },
  referralHintBoxNeutral: { backgroundColor: '#f3f4f6' },
  referralHintBoxValid: { backgroundColor: '#d8f3dc' },
  referralHintBoxInvalid: { backgroundColor: '#fee2e2' },
  referralHintText: { fontSize: 12, fontWeight: '600' },
  referralHintTextNeutral: { color: Colors.textMuted },
  referralHintTextValid: { color: '#2d6a4f' },
  referralHintTextInvalid: { color: '#991b1b' },
});
