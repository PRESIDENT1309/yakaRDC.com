import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Platform, useWindowDimensions,
} from 'react-native';
import { Slot, router, usePathname } from 'expo-router';
import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import {
  LayoutDashboard, ChartBar, Users, Store, History,
  Star, MapPin, LogOut, Building2, Menu, X, Image as ImageIcon,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

const MOBILE_BREAKPOINT = 768;

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: (color: string) => React.ReactNode;
  ready: boolean;
  badgeKey?: 'pendingRequests';
}

const NAV: NavItem[] = [
  { key: 'overview', label: "Vue d'ensemble", href: '/admin', icon: c => <LayoutDashboard size={16} color={c} />, ready: true },
  { key: 'establishments', label: 'Établissements', href: '/admin/establishments', icon: c => <Building2 size={16} color={c} />, ready: true },
  { key: 'stats', label: 'Statistiques', href: '/admin/stats', icon: c => <ChartBar size={16} color={c} />, ready: true },
  { key: 'users', label: 'Utilisateurs', href: '/admin/users', icon: c => <Users size={16} color={c} />, ready: true },
  { key: 'requests', label: 'Demandes partenaires', href: '/admin/partner-requests', icon: c => <Store size={16} color={c} />, ready: true, badgeKey: 'pendingRequests' },
  { key: 'history', label: 'Historique', href: '/admin/history', icon: c => <History size={16} color={c} />, ready: true },
  { key: 'reviews', label: 'Avis', href: '/admin/reviews', icon: c => <Star size={16} color={c} />, ready: true },
  { key: 'cities', label: 'Villes & catégories', href: '/admin/cities', icon: c => <MapPin size={16} color={c} />, ready: true },
  { key: 'appearance', label: 'Apparence', href: '/admin/appearance', icon: c => <ImageIcon size={16} color={c} />, ready: true },
];

export default function AdminLayout() {
  const { profile, loading } = useAuth();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [pendingRequests, setPendingRequests] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!profile) { router.replace('/(auth)/login'); return; }
    if (profile.role !== 'admin') { router.replace('/(tabs)'); }
  }, [profile, loading]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    supabase
      .from('partner_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingRequests(count ?? 0));
  }, [profile?.role]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  if (loading || !profile) {
    return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  }
  if (profile.role !== 'admin') return null;

  const activeItem = NAV.find(item =>
    pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
  );

  function NavList({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <View style={styles.brand}>
          <Svg width="26" height="26" viewBox="0 0 120 120">
            <Rect width="120" height="120" rx="20" fill="#712B13" />
            <Circle cx="60" cy="48" r="22" fill="#FAC775" />
            <Polygon points="34,80 60,38 86,80" fill="#712B13" />
            <Path d="M28,96 Q60,88 92,96" stroke="#FAC775" strokeWidth="5" fill="none" strokeLinecap="round" />
          </Svg>
          <View>
            <Text style={styles.brandTitle}>YakaRDC</Text>
            <Text style={styles.brandSub}>Administration</Text>
          </View>
          {isMobile && (
            <Pressable style={styles.closeDrawerBtn} onPress={onNavigate} hitSlop={8}>
              <X size={18} color="#FAF8F4" />
            </Pressable>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            const badgeValue = item.badgeKey === 'pendingRequests' ? pendingRequests : 0;
            return (
              <Pressable
                key={item.key}
                disabled={!item.ready}
                style={[styles.navItem, active && styles.navItemActive, !item.ready && styles.navItemDisabled]}
                onPress={() => {
                  if (!item.ready) return;
                  router.push(item.href as any);
                  onNavigate?.();
                }}
              >
                {item.icon(active ? '#FAF8F4' : '#A8A39A')}
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                {item.ready && badgeValue > 0 && (
                  <View style={styles.navBadge}><Text style={styles.navBadgeText}>{badgeValue}</Text></View>
                )}
                {!item.ready && <Text style={styles.soonTag}>Bientôt</Text>}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sidebarFooter}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(profile?.full_name ?? 'A').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName} numberOfLines={1}>{profile?.full_name ?? 'Admin'}</Text>
              <Text style={styles.profileRole}>Super-utilisateur</Text>
            </View>
            <Pressable onPress={handleSignOut} hitSlop={8}>
              <LogOut size={15} color="#A8A39A" />
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  // ── Desktop / tablette : sidebar fixe classique ──
  if (!isMobile) {
    return (
      <View style={styles.screen}>
        <View style={styles.sidebar}>
          <NavList />
        </View>
        <View style={styles.main}>
          <Slot />
        </View>
      </View>
    );
  }

  // ── Mobile : barre du haut + tiroir de navigation ──
  return (
    <View style={styles.screenMobile}>
      <View style={styles.topBar}>
        <Pressable style={styles.hamburgerBtn} onPress={() => setDrawerOpen(true)} hitSlop={8}>
          <Menu size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {activeItem?.label ?? 'Administration'}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.mainMobile}>
        <Slot />
      </View>

      {drawerOpen && (
        <>
          <Pressable style={styles.backdrop} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawer}>
            <NavList onNavigate={() => setDrawerOpen(false)} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },

  // Desktop
  screen: { flex: 1, flexDirection: 'row', backgroundColor: colors.cream },
  sidebar: { width: 220, backgroundColor: '#1F1A16', paddingTop: 20, flexDirection: 'column' },
  main: { flex: 1, backgroundColor: colors.cream },

  // Mobile
  screenMobile: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: '#FAF8F4', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  hamburgerBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '500', color: colors.ink },
  mainMobile: { flex: 1 },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 90,
  },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: '78%', maxWidth: 280,
    backgroundColor: '#1F1A16', zIndex: 100, paddingTop: Platform.OS === 'ios' ? 54 : 30,
  },
  closeDrawerBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },

  // Partagé sidebar/drawer
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 18 },
  brandTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 16, color: '#FAF8F4' },
  brandSub: { fontSize: 10, color: '#A8A39A' },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12 },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  navItemDisabled: { opacity: 0.45 },
  navLabel: { fontSize: 12.5, color: '#A8A39A', flex: 1 },
  navLabelActive: { color: '#FAF8F4', fontWeight: '500' },
  navBadge: { backgroundColor: colors.lave, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1.5, minWidth: 18, alignItems: 'center' },
  navBadgeText: { fontSize: 10, color: '#FAF8F4', fontWeight: '500' },
  soonTag: { fontSize: 8.5, color: '#6B665E' },
  sidebarFooter: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.lave, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '500', color: '#FAF8F4' },
  profileName: { fontSize: 11.5, color: '#FAF8F4', fontWeight: '500' },
  profileRole: { fontSize: 9.5, color: '#A8A39A' },
});