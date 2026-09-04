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
  KeyRound,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useConfirm } from '../../lib/confirm-context';
import { colors, fonts, typography, breakpoints, radii, spacing } from '../../lib/theme';

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
        pressed && { backgroundColor: colors.cream },
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      <ChevronRight size={15} color={colors.borderStrong} />
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
          <Pressable hitSlop={6} accessibilityRole="button" accessibilityLabel="Paramètres" style={styles.settingsBtn} onPress={() => showComingSoon('Paramètres')}>
            <Settings size={16} color={colors.cream} />
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
              icon={<User size={15} color={colors.lave} />}
              iconBg={colors.laveSoft}
              label="Modifier le profil"
              onPress={() => router.push('/edit-profile')}
            />
            <MenuItem
              icon={<KeyRound size={15} color={colors.lave} />}
              iconBg={colors.laveSoft}
              label="Mot de passe"
              onPress={() => router.push('/change-password')}
            />
            <MenuItem
              icon={<Heart size={15} color={colors.lave} />}
              iconBg={colors.laveSoft}
              label="Mes favoris"
              value={favoriteCount > 0 ? String(favoriteCount) : undefined}
              onPress={() => router.push('/favorites')}
            />
            <MenuItem
              icon={<CalendarCheck size={15} color={colors.lave} />}
              iconBg={colors.laveSoft}
              label="Historique des réservations"
              onPress={() => router.push('/(tabs)/bookings')}
              last
            />
          </MenuSection>

          {/* ── Préférences ── */}
          <MenuSection title="PRÉFÉRENCES">
            <MenuItem
              icon={<Bell size={15} color={colors.fleuveDark} />}
              iconBg={colors.fleuveSoft}
              label="Notifications"
              onPress={() => router.push('/notifications')}
            />
            <MenuItem
              icon={<Languages size={15} color={colors.fleuveDark} />}
              iconBg={colors.fleuveSoft}
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
              icon={<Store size={15} color={colors.warning} />}
              iconBg={colors.warningSoft}
              label="Devenir partenaire"
              onPress={() => router.push('/become-partner')}
              last
            />
          </MenuSection>

          {/* ── Assistance ── */}
          <MenuSection title="ASSISTANCE">
            <MenuItem
              icon={<HelpCircle size={15} color={colors.warning} />}
              iconBg={colors.warningSoft}
              label="Centre d'aide"
              onPress={() => showComingSoon("Centre d'aide")}
            />
            <MenuItem
              icon={<Shield size={15} color={colors.warning} />}
              iconBg={colors.warningSoft}
              label="Confidentialité"
              onPress={() => showComingSoon('Politique de confidentialité')}
              last
            />
          </MenuSection>

          {/* ── Déconnexion ── */}
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <LogOut color={colors.danger} size={15} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
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
    borderRadius: radii.v16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapper: {
    marginBottom: spacing.v12,
    position: 'relative',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.amber,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: {
    ...typography.displayLg,
    color: colors.lave,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 27,
    height: 27,
    borderRadius: radii.v14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.lave,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 21,
    color: colors.cream,
    marginBottom: 3,
  },
  contact: {
    ...typography.captionSm,
    color: 'rgba(250,248,244,0.7)',
    marginBottom: spacing.v20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  stat: { alignItems: 'center' },
  statValue: {
    ...typography.titleMd,
    color: colors.cream,
  },
  statLabel: {
    ...typography.captionSm,
    color: 'rgba(250,248,244,0.65)',
    marginTop: spacing.v2,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    // Étirées sur 780 px, ces lignes laissaient 700 px de vide entre le libellé
    // et son chevron. On les ramène à la largeur des écrans qu'elles ouvrent
    // (édition du profil, mot de passe) : la ligne et sa destination se
    // répondent. Sans effet sous 480 px.
    maxWidth: breakpoints.formMax,
    width: '100%',
    alignSelf: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  section: { gap: 7 },
  sectionLabel: {
    ...typography.overlineXs,
    color: colors.faint,
    paddingHorizontal: spacing.v6,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radii.v16,
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
    gap: spacing.v12,
    paddingHorizontal: spacing.v14,
    paddingVertical: 13,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  menuIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    ...typography.bodySm,
    flex: 1,
    color: colors.ink,
  },
  menuValue: {
    ...typography.captionSm,
    color: colors.faint,
    marginRight: spacing.v2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.v14,
    paddingVertical: spacing.v14,
    marginTop: spacing.v2,
  },
  logoutText: { ...typography.pillLabel, color: colors.danger },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.cream,
    borderRadius: radii.lg,
    padding: 22,
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.v10,
  },
  modalTitle: {
    ...typography.titleSm,
    color: colors.ink,
  },
  modalText: {
    ...typography.bodySm,
    color: colors.muted,
    marginBottom: spacing.v20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.v10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.v12,
    borderRadius: radii.v10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  cancelBtnText: {
    ...typography.labelMd,
    color: colors.ink,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: spacing.v12,
    borderRadius: radii.v10,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  confirmBtnText: {
    ...typography.labelMd,
    color: colors.white,
  },
});