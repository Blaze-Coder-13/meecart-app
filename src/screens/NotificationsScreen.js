import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCustomerNotifications } from '../api/client';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../utils/theme';

const LAST_READ_NOTIFICATION_ID_KEY = 'meecart_last_read_notification_id';

function formatDate(value) {
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await getCustomerNotifications();
      setNotifications(data || []);
      if (data?.[0]?.id) {
        await AsyncStorage.setItem(LAST_READ_NOTIFICATION_ID_KEY, String(data[0].id));
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  function handleRefresh() {
    setRefreshing(true);
    loadNotifications();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Announcements</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={notifications.length ? styles.list : styles.emptyWrap}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
              ) : null}
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardMeta}>{formatDate(item.created_at)}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>No announcements</Text>
              <Text style={styles.emptyTitle}>No announcements yet</Text>
              <Text style={styles.emptyText}>Broadcast updates from admin will appear here.</Text>
            </View>
          }
        />
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
  backBtn: { minWidth: 48 },
  backText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },
  title: { fontSize: FontSize.lg, color: Colors.text, fontWeight: '800' },
  headerSpacer: { minWidth: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, gap: Spacing.md },
  emptyWrap: { flexGrow: 1, padding: Spacing.lg },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardImage: {
    width: '100%',
    height: 170,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.cream,
  },
  cardTitle: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  cardBody: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  cardMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: { fontSize: FontSize.md, marginBottom: Spacing.md, color: Colors.textMuted },
  emptyTitle: {
    fontSize: FontSize.lg,
    color: Colors.text,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
