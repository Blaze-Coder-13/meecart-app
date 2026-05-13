import AsyncStorage from '@react-native-async-storage/async-storage';

const ANNOUNCEMENTS_VISIBLE_FROM_PREFIX = 'meecart_announcements_visible_from_';

function getUserJoinDate(user) {
  const rawValue =
    user?.created_at ||
    user?.createdAt ||
    user?.joined_at ||
    user?.joinedAt ||
    null;

  if (!rawValue) return null;

  const joinDate = new Date(rawValue);
  return Number.isNaN(joinDate.getTime()) ? null : joinDate;
}

function getVisibilityKey(phone) {
  const normalizedPhone = String(phone || '').trim();
  return normalizedPhone ? `${ANNOUNCEMENTS_VISIBLE_FROM_PREFIX}${normalizedPhone}` : null;
}

function parseDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function filterAnnouncements(items, visibleFrom) {
  if (!Array.isArray(items)) return [];
  if (!visibleFrom) return items;

  return items.filter(item => {
    if (!item?.created_at) return true;
    const createdAt = new Date(item.created_at);
    if (Number.isNaN(createdAt.getTime())) return true;
    return createdAt >= visibleFrom;
  });
}

export async function markAnnouncementsVisibleFromNow(phone) {
  const key = getVisibilityKey(phone);
  if (!key) return;

  await AsyncStorage.setItem(key, new Date().toISOString());
}

export async function filterAnnouncementsForUser(items, user) {
  const joinDate = getUserJoinDate(user);
  if (joinDate) {
    return filterAnnouncements(items, joinDate);
  }

  const key = getVisibilityKey(user?.phone);
  if (!key) return Array.isArray(items) ? items : [];

  const storedValue = await AsyncStorage.getItem(key);
  const visibleFrom = parseDateValue(storedValue) || new Date();
  return filterAnnouncements(items, visibleFrom);
}
