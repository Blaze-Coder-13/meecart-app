import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

function isNetworkError(err) {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('network request failed') || message.includes('network error');
}

async function request(method, path, body, retries = 1) {
  const token = await AsyncStorage.getItem('meecart_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const raw = await res.text();
    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }
    }

    if (!res.ok) throw { response: { data, status: res.status } };
    return { data: data ?? {} };
  } catch (err) {
    if (retries > 0 && isNetworkError(err)) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return request(method, path, body, retries - 1);
    }
    throw err;
  }
}

// ── AUTH ──────────────────────────────────────────────
export const sendOTP = (phone, purpose = 'signup') =>
  request('POST', '/api/auth/send-otp', { phone, purpose });

export const verifyOTP = (phone, code, purpose = 'signup') =>
  request('POST', '/api/auth/verify-otp', { phone, code, otp: code, purpose });

export const signup = (phone, name, address, password, referral_code) =>
  request('POST', '/api/auth/signup', { phone, name, address, password, referral_code });

export const login = (phone, password) =>
  request('POST', '/api/auth/login', { phone, password });

export const resetPassword = (phone, password) =>
  request('POST', '/api/auth/reset-password', { phone, password });

export const getMe = () =>
  request('GET', '/api/auth/me');

export const updateProfile = (data) =>
  request('PUT', '/api/auth/profile', data);

export const savePushToken = (token, phone) =>
  request('POST', '/api/auth/push-token', { token, phone });

export const getCustomerAnnouncements = () =>
  request('GET', '/api/auth/announcements');

export const getCustomerNotifications = () =>
  getCustomerAnnouncements();

// ── PRODUCTS ──────────────────────────────────────────
export const getProducts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request('GET', `/api/products${query ? '?' + query : ''}`);
};

export const getCategories = () =>
  request('GET', '/api/products/categories');

export const getProduct = (id) =>
  request('GET', `/api/products/${id}`);

// ── ORDERS ────────────────────────────────────────────
export const placeOrder = (items, address, notes, promo_code, apply_referral_discount = false, discount = 0, final_total = 0) =>
  request('POST', '/api/orders', { items, address, notes, promo_code, apply_referral_discount, discount, final_total });

export const getMyOrders = () =>
  request('GET', '/api/orders/my');

export const getMyOrder = (id) =>
  request('GET', `/api/orders/my/${id}`);

// ── PROMO CODES ───────────────────────────────────────
export const applyPromoCode = (code, order_total) =>
  request('POST', '/api/admin/promos/apply', { code, order_total });

export const getAvailablePromos = () =>
  request('GET', '/api/admin/promos/public');

// ── REFERRAL ──────────────────────────────────────────
export const getReferralStats = () =>
  request('GET', '/api/auth/referral-stats');

export const validateReferralCode = (code) =>
  request('GET', `/api/auth/referral-code/${encodeURIComponent(code)}`);

// ── SETTINGS ──────────────────────────────────────────
export const getSettings = () =>
  request('GET', '/api/settings');

// ── FLASH DEALS ───────────────────────────────────────
export const getFlashDeals = () =>
  request('GET', '/api/admin/flash-deals/public');

// ── BANNERS ───────────────────────────────────────────
export const getBanners = () =>
  request('GET', '/api/admin/banners/public');

export default { request };
