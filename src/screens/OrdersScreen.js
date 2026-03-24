import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyOrders, getMyOrder } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

const STATUS_CONFIG = {
  pending:          { label: 'Order Placed',     icon: '📋', color: Colors.statusPending,         textColor: Colors.statusPendingText },
  confirmed:        { label: 'Confirmed',         icon: '✅', color: Colors.statusConfirmed,        textColor: Colors.statusConfirmedText },
  packing:          { label: 'Being Packed',      icon: '📦', color: Colors.statusPacking,          textColor: Colors.statusPackingText },
  out_for_delivery: { label: 'Out for Delivery',  icon: '🛵', color: Colors.statusOutForDelivery,   textColor: Colors.statusOutForDeliveryText },
  delivered:        { label: 'Delivered',         icon: '🎉', color: Colors.statusDelivered,        textColor: Colors.statusDeliveredText },
  cancelled:        { label: 'Cancelled',         icon: '❌', color: Colors.statusCancelled,        textColor: Colors.statusCancelledText },
};

const TIMELINE_STEPS = ['pending', 'confirmed', 'packing', 'out_for_delivery', 'delivered'];

function formatUpdateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildOrderUpdates(order, detail) {
  const rawUpdates = Array.isArray(detail?.updates) ? detail.updates : [];
  const updatesByStatus = new Map();

  rawUpdates.forEach((update, index) => {
    if (!update?.status) return;
    updatesByStatus.set(update.status, {
      ...update,
      id: update.id || `${update.status}-${index}`,
    });
  });

  if (order?.status === 'cancelled' && !updatesByStatus.has('cancelled')) {
    updatesByStatus.set('cancelled', {
      id: 'fallback-cancelled',
      status: 'cancelled',
      title: 'Order Cancelled',
      message: 'This order was cancelled.',
      created_at: detail?.updated_at || order?.updated_at || order?.created_at,
    });
  }

  const currentIdx = TIMELINE_STEPS.indexOf(order?.status);
  if (currentIdx >= 0) {
    TIMELINE_STEPS.slice(0, currentIdx + 1).forEach((status, index) => {
      if (updatesByStatus.has(status)) return;
      const cfg = STATUS_CONFIG[status];
      updatesByStatus.set(status, {
        id: `fallback-${status}`,
        status,
        title: cfg?.label || 'Order Update',
        message:
          status === order?.status
            ? `Your order is now ${cfg?.label?.toLowerCase() || 'updated'}.`
            : `${cfg?.label || 'Order step'} completed.`,
        created_at:
          status === order?.status
            ? detail?.updated_at || order?.updated_at || order?.created_at
            : order?.created_at,
      });
    });
  }

  return Array.from(updatesByStatus.values()).sort((a, b) => {
    const aIdx = TIMELINE_STEPS.indexOf(a.status);
    const bIdx = TIMELINE_STEPS.indexOf(b.status);
    const safeA = aIdx === -1 ? 999 : aIdx;
    const safeB = bIdx === -1 ? 999 : bIdx;
    return safeA - safeB;
  });
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.color }]}>
      <Text style={styles.badgeIcon}>{cfg.icon}</Text>
      <Text style={[styles.badgeText, { color: cfg.textColor }]}>{cfg.label}</Text>
    </View>
  );
}

function OrderTimeline({ status }) {
  const currentIdx = TIMELINE_STEPS.indexOf(status);
  if (status === 'cancelled') {
    return (
      <View style={styles.timeline}>
        <View style={styles.step}>
          <View style={styles.stepLeft}>
            <View style={[styles.stepDot, { backgroundColor: Colors.error }]}>
              <Text style={styles.stepDotText}>✕</Text>
            </View>
          </View>
          <View style={styles.stepContent}>
            <Text style={[styles.stepLabel, styles.stepLabelActive]}>Order Cancelled</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.timeline}>
      {TIMELINE_STEPS.map((step, i) => {
        const cfg = STATUS_CONFIG[step];
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <View key={step} style={styles.step}>
            <View style={styles.stepLeft}>
              <View style={[
                styles.stepDot,
                isDone && styles.stepDotDone,
                isActive && styles.stepDotActive,
              ]}>
                <Text style={styles.stepDotText}>{isDone ? '✓' : isActive ? cfg.icon : ''}</Text>
              </View>
              {i < TIMELINE_STEPS.length - 1 && (
                <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
              )}
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepLabel, (isDone || isActive) && styles.stepLabelActive]}>
                {cfg.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function OrderUpdates({ updates }) {
  if (!updates?.length) return null;

  return (
    <View style={styles.updatesSection}>
      <Text style={styles.sectionLabel}>Order Updates</Text>
      {updates.map(update => (
        <View key={update.id} style={styles.updateCard}>
          <View style={styles.updateIconWrap}>
            <Text style={styles.updateIcon}>
              {(STATUS_CONFIG[update.status] || STATUS_CONFIG.pending).icon}
            </Text>
          </View>
          <View style={styles.updateContent}>
            <View style={styles.updateHeader}>
              <Text style={styles.updateTitle}>{update.title}</Text>
              <Text style={styles.updateMeta}>{formatUpdateTime(update.created_at)}</Text>
            </View>
            <Text style={styles.updateMessage}>{update.message}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function OrderCard({ order, onPress, expanded, detail }) {
  const date = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const subtotal = detail?.subtotal || order.total;
  const deliveryCharges = detail?.delivery_charges || 0;
  const discount = detail?.discount || 0;
  const displayUpdates = buildOrderUpdates(order, detail);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderDate}>{date} · {order.item_count} item(s)</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.orderTotal}>₹{order.total}</Text>
          <Text style={styles.codLabel}>💵 Cash on Delivery</Text>
        </View>
      </View>

      <StatusBadge status={order.status} />

      {expanded && detail && (
        <View style={styles.expanded}>

          <OrderTimeline status={order.status} />
          <OrderUpdates updates={displayUpdates} />

          {detail.items?.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={styles.sectionLabel}>Items Ordered</Text>
              {detail.items.map(i => (
                <View key={i.id} style={styles.detailItem}>
                  {i.image_url
                    ? <Image source={{ uri: i.image_url }} style={styles.detailImage} />
                    : <Text style={styles.detailEmoji}>{i.image_emoji}</Text>
                  }
                  <Text style={styles.detailName}>{i.name} × {i.quantity} {i.unit}</Text>
                  <Text style={styles.detailPrice}>₹{(i.price * i.quantity).toFixed(0)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.priceBreakdown}>
            <Text style={styles.sectionLabel}>Price Details</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <Text style={styles.priceVal}>₹{subtotal}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Discount</Text>
                <Text style={[styles.priceVal, { color: Colors.success }]}>- ₹{discount}</Text>
              </View>
            )}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery Charges</Text>
              <Text style={[styles.priceVal, deliveryCharges === 0 && { color: Colors.primary, fontWeight: '700' }]}>
                {deliveryCharges === 0 ? 'FREE' : `₹${deliveryCharges}`}
              </Text>
            </View>
            <View style={[styles.priceRow, styles.priceTotalRow]}>
              <Text style={styles.priceTotalLabel}>Order Total (Pay on Delivery)</Text>
              <Text style={styles.priceTotalVal}>₹{order.total}</Text>
            </View>
          </View>

          {order.address && (
            <View style={styles.addressRow}>
              <Text style={styles.addressIcon}>📍</Text>
              <Text style={styles.addressText}>{order.address}</Text>
            </View>
          )}

        </View>
      )}

      <Text style={styles.expandHint}>{expanded ? '▲ Hide details' : '▼ View details'}</Text>
    </TouchableOpacity>
  );
}

export default function OrdersScreen({ navigation }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [orderDetails, setOrderDetails] = useState({});

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await getMyOrders();
      setOrders(data);
    } catch {}
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setOrderDetails({});
    await loadOrders();
    setRefreshing(false);
  }, []);

  async function toggleOrder(id) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    try {
      const { data } = await getMyOrder(id);
      setOrderDetails(prev => ({ ...prev, [id]: data }));
    } catch {}
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>Login to view orders</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginBtnText}>Login →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>Start shopping to place your first order!</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.loginBtnText}>Shop Now →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => String(o.id)}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              expanded={expandedId === item.id}
              detail={orderDetails[item.id]}
              onPress={() => toggleOrder(item.id)}
            />
          )}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBar: {
    backgroundColor: Colors.white, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyIcon: { fontSize: 56, marginBottom: Spacing.lg },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.xl },
  loginBtn: { backgroundColor: Colors.primary, paddingVertical: 13, paddingHorizontal: Spacing.xxl, borderRadius: Radius.md },
  loginBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.lg, ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  orderDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  orderTotal: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  codLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
  },
  badgeIcon: { fontSize: 12 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },

  expandHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
  expanded: { marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.lg },

  timeline: { marginBottom: Spacing.lg },
  step: { flexDirection: 'row', gap: Spacing.md },
  stepLeft: { alignItems: 'center' },
  stepDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  stepDotDone: { backgroundColor: Colors.primary },
  stepDotActive: { backgroundColor: Colors.primaryLight },
  stepDotText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  stepLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 2 },
  stepLineDone: { backgroundColor: Colors.primaryLight },
  stepContent: { flex: 1, paddingBottom: Spacing.md },
  stepLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500' },
  stepLabelActive: { color: Colors.text, fontWeight: '700' },

  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },

  updatesSection: { marginBottom: Spacing.lg, gap: Spacing.sm },
  updateCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.cream,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  updateIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateIcon: { fontSize: 15 },
  updateContent: { flex: 1 },
  updateHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: 4 },
  updateTitle: { flex: 1, fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  updateMessage: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 18 },
  updateMeta: { fontSize: FontSize.xs, color: Colors.textMuted },

  itemsSection: { marginBottom: Spacing.lg },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  detailEmoji: { fontSize: 18 },
  detailImage: { width: 32, height: 32, borderRadius: 6 },
  detailName: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  detailPrice: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },

  priceBreakdown: { backgroundColor: Colors.cream, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  priceLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  priceVal: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  priceTotalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  priceTotalLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  priceTotalVal: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },

  addressRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  addressIcon: { fontSize: 14 },
  addressText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted },
});
