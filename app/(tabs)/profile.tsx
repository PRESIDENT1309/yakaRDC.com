import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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
  Camera,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useConfirm } from '../../lib/confirm-context';
import { colors } from '../../lib/theme';

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
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
  label,
  value,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        !last && styles.menuItemBorder,
        pressed && { backgroundColor: '#FAFAF9' },
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      <ChevronRight size={15} color="#C4C2BA" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const confirm = useConfirm();
  const [bookingCount, setBookingCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const initial = profile?.full_name
    ? profile.full_name.charAt(0).toUpperCase()
    : (profile?.email?.charAt(0).toUpperCase() ?? 'U');

  const displayName = profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Utilisateur';
  const displayEmail = profile?.email ?? profile?.phone ?? '';

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('traveler_id', session.user.id)
      .then(({ count }) => setBookingCount(count ?? 0));
    supabase
      .from('favorites')
      .select('id', { count: 'exact', head: true })
      .eq('traveler_id', session.user.id)
      .then(({ count }) => setFavoriteCount(count ?? 0));
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('traveler_id', session.user.id)
      .then(({ count }) => setReviewCount(count ?? 0));
  }, [session?.user?.id]);

  async function handleChangeAvatar() {
    if (!session?.user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "L'accès à vos photos est nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingAvatar(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const path = `avatars/${session.user.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('establishment-photos')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });

      if (uploadError) {
        Alert.alert('Erreur', uploadError.message);
        setUploadingAvatar(false);
        return;
      }

      const { data } = supabase.storage.from('establishment-photos').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', session.user.id);
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "L'envoi de la photo a échoué.");
    }
    setUploadingAvatar(false);
  }

  async function handleLogout() {
    const ok = await confirm({
      title: 'Se déconnecter ?',
      message: 'Vous devrez vous reconnecter pour accéder à vos réservations et favoris.',
      confirmLabel: 'Se déconnecter',
      destructive: true,
    });
    if (!ok) return;
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  function showComingSoon(feature: string) {
    Alert.alert(feature, 'Cette fonctionnalité arrive bientôt sur YakaRDC.');
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── En-tête ── */}
        <View style={styles.header}>
          <Pressable style={styles.settingsBtn} onPress={() => showComingSoon('Paramètres')}>
            <Settings size={16} color="#FAF8F4" />
          </Pressable>

          {/* Photo de profil, modifiable au clic */}
          <Pressable style={styles.avatarWrapper} onPress={handleChangeAvatar} disabled={uploadingAvatar}>
            <View style={styles.avatar}>
              {uploadingAvatar ? (
                <ActivityIndicator color={colors.lave} />
              ) : profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Camera size={12} color={colors.lave} />
            </View>
          </Pressable>

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
              <Text style={styles.statValue}>{reviewCount}</Text>
              <Text style={styles.statLabel}>Avis</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* ── Mon compte ── */}
          <MenuSection title="MON COMPTE">
            <MenuItem
              icon={<User size={15} color="#712B13" />}
              iconBg="#FAECE7"
              label="Modifier le profil"
              onPress={() => router.push('/edit-profile')}
            />
            <MenuItem
              icon={<Heart size={15} color="#712B13" />}
              iconBg="#FAECE7"
              label="Mes favoris"
              value={favoriteCount > 0 ? String(favoriteCount) : undefined}
              onPress={() => router.push('/favorites')}
            />
            <MenuItem
              icon={<CalendarCheck size={15} color="#712B13" />}
              iconBg="#FAECE7"
              label="Historique des réservations"
              onPress={() => router.push('/(tabs)/bookings')}
              last
            />
          </MenuSection>

          {/* ── Préférences ── */}
          <MenuSection title="PRÉFÉRENCES">
            <MenuItem
              icon={<Bell size={15} color="#085041" />}
              iconBg="#E1F5EE"
              label="Notifications"
              onPress={() => router.push('/notifications')}
            />
            <MenuItem
              icon={<Languages size={15} color="#085041" />}
              iconBg="#E1F5EE"
              label="Langue"
              value="Français"
              onPress={() =>
                Alert.alert(
                  'Langue',
                  "YakaRDC est disponible en français pour le moment. D'autres langues (lingala, anglais) arriveront bientôt."
                )
              }
              last
            />
          </MenuSection>

          {/* ── Devenir partenaire ── */}
          <MenuSection title="VOUS AVEZ UN ÉTABLISSEMENT ?">
            <MenuItem
              icon={<Store size={15} color="#854F0B" />}
              iconBg="#FAEEDA"
              label="Devenir partenaire"
              onPress={() => router.push('/become-partner')}
              last
            />
          </MenuSection>

          {/* ── Assistance ── */}
          <MenuSection title="ASSISTANCE">
            <MenuItem
              icon={<HelpCircle size={15} color="#854F0B" />}
              iconBg="#FAEEDA"
              label="Centre d'aide"
              onPress={() => showComingSoon("Centre d'aide")}
            />
            <MenuItem
              icon={<Shield size={15} color="#854F0B" />}
              iconBg="#FAEEDA"
              label="Confidentialité"
              onPress={() => showComingSoon('Politique de confidentialité')}
              last
            />
          </MenuSection>

          {/* ── Déconnexion ── */}
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <LogOut color="#C0392B" size={15} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F4EF' },
  header: {
    backgroundColor: colors.lave,
    paddingTop: Platform.OS === 'ios' ? 60 : 32,
    paddingBottom: 26,
    alignItems: 'center',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
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
    position: 'relative',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FAC775',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: {
    fontSize: 32,
    fontWeight: '500',
    color: colors.lave,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.lave,
  },
  name: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 21,
    color: '#FAF8F4',
    marginBottom: 3,
  },
  contact: {
    fontSize: 12,
    color: 'rgba(250,248,244,0.7)',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  stat: { alignItems: 'center' },
  statValue: {
    fontSize: 19,
    fontWeight: '600',
    color: '#FAF8F4',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(250,248,244,0.65)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: { gap: 7 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9A9892',
    letterSpacing: 0.6,
    paddingHorizontal: 6,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F4F0',
  },
  menuIcon: {
    width: 30,
    height: 30,
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
    color: '#9A9892',
    marginRight: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 2,
  },
  logoutText: { color: '#C0392B', fontSize: 13, fontWeight: '500' },
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