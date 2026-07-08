import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import {
  Settings,
  User,
  Heart,
  CalendarCheck,
  Bell,
  Languages,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
  X,
  Store,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

function MenuSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function MenuItem({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={[styles.menuItem, !last && styles.menuItemBorder]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      <ChevronRight size={14} color={colors.borderStrong} />
    </Pressable>
  );
}

function LogoutModal({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Se déconnecter ?</Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.modalText}>
            Vous devrez vous reconnecter pour accéder à vos réservations et favoris.
          </Text>
          <View style={styles.modalActions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={onConfirm}>
              <Text style={styles.confirmBtnText}>Se déconnecter</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { profile, session } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [bookingCount, setBookingCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);

  const initial = profile?.full_name
    ? profile.full_name.charAt(0).toUpperCase()
    : (profile?.email?.charAt(0).toUpperCase() ?? 'U');

  const displayName = profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Utilisateur';
  const displayEmail = profile?.email ?? profile?.phone ?? '';

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('traveler_id', session.user.id)
      .then(({ count }) => setBookingCount(count ?? 0));
    supabase
      .from('favorites')
      .select('id', { count: 'exact' })
      .eq('traveler_id', session.user.id)
      .then(({ count }) => setFavoriteCount(count ?? 0));
  }, [session?.user?.id]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setShowLogout(false);
    router.replace('/(auth)/login');
  }

  function showComingSoon(feature: string) {
    Alert.alert(feature, "Cette fonctionnalité arrive bientôt sur YakaRDC.");
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable style={styles.settingsBtn} onPress={() => showComingSoon('Paramètres')}>
            <Settings size={16} color="#FAF8F4" />
          </Pressable>

          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>

          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.contact}>{displayEmail}</Text>

          <View style={styles.statsRow}>
            <Pressable style={styles.stat} onPress={() => router.push('/(tabs)/bookings')}>
              <Text style={styles.statValue}>{bookingCount}</Text>
              <Text style={styles.statLabel}>Réservations</Text>
            </Pressable>
            <View style={styles.statDivider} />
            <Pressable style={styles.stat} onPress={() => router.push('/favorites')}>
              <Text style={styles.statValue}>{favoriteCount}</Text>
              <Text style={styles.statLabel}>Favoris</Text>
            </Pressable>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Avis</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* ── Mon compte ── */}
          <MenuSection title="Mon compte">
            <MenuItem
              icon={<User size={16} color="#712B13" />}
              iconBg="#FAECE7"
              iconColor="#712B13"
              label="Modifier le profil"
              onPress={() => router.push('/edit-profile')}
            />
            <MenuItem
              icon={<Heart size={16} color="#712B13" />}
              iconBg="#FAECE7"
              iconColor="#712B13"
              label="Mes favoris"
              value={favoriteCount > 0 ? String(favoriteCount) : undefined}
              onPress={() => router.push('/favorites')}
            />
            <MenuItem
              icon={<CalendarCheck size={16} color="#712B13" />}
              iconBg="#FAECE7"
              iconColor="#712B13"
              label="Historique des réservations"
              onPress={() => router.push('/(tabs)/bookings')}
              last
            />
          </MenuSection>

          {/* ── Devenir partenaire ── */}
          <MenuSection title="Vous avez un établissement ?">
            <MenuItem
              icon={<Store size={16} color="#712B13" />}
              iconBg="#FAECE7"
              iconColor="#712B13"
              label="Devenir partenaire"
              onPress={() => router.push('/become-partner')}
              last
            />
          </MenuSection>

          {/* ── Préférences ── */}
          <MenuSection title="Préférences">
            <MenuItem
              icon={<Bell size={16} color="#085041" />}
              iconBg="#E1F5EE"
              iconColor="#085041"
              label="Notifications"
              onPress={() => router.push('/notifications')}
            />
            <MenuItem
              icon={<Languages size={16} color="#085041" />}
              iconBg="#E1F5EE"
              iconColor="#085041"
              label="Langue"
              value="Français"
              onPress={() => Alert.alert(
                'Langue',
                "YakaRDC est disponible en français pour le moment. D'autres langues (lingala, anglais) arriveront bientôt."
              )}
              last
            />
          </MenuSection>

          {/* ── Assistance ── */}
          <MenuSection title="Assistance">
            <MenuItem
              icon={<HelpCircle size={16} color="#854F0B" />}
              iconBg="#FAEEDA"
              iconColor="#854F0B"
              label="Centre d'aide"
              onPress={() => showComingSoon("Centre d'aide")}
            />
            <MenuItem
              icon={<Shield size={16} color="#854F0B" />}
              iconBg="#FAEEDA"
              iconColor="#854F0B"
              label="Confidentialité"
              onPress={() => showComingSoon('Politique de confidentialité')}
              last
            />
          </MenuSection>

          {/* ── Déconnexion ── */}
          <Pressable
            style={styles.logoutButton}
            onPress={() => setShowLogout(true)}
          >
            <LogOut color={colors.lave} size={16} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>

      <LogoutModal
        visible={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.lave,
    paddingTop: Platform.OS === 'ios' ? 60 : 32,
    paddingBottom: 28,
    alignItems: 'center',
    position: 'relative',
  },
  settingsBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapper: {
    marginBottom: 12,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FAC775',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '500',
    color: colors.lave,
  },
  name: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FAF8F4',
    marginBottom: 4,
  },
  contact: {
    fontSize: 13,
    color: 'rgba(250,248,244,0.7)',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  stat: { alignItems: 'center' },
  statValue: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FAF8F4',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(250,248,244,0.65)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    padding: 16,
    gap: 10,
  },
  section: { gap: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F4F0',
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
  },
  menuValue: {
    fontSize: 12,
    color: colors.muted,
    marginRight: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  logoutText: { color: colors.lave, fontSize: 13, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#FAF8F4',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
  },
  modalText: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: colors.ink,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#C0392B',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});