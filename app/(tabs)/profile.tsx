import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
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
  FileText,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useConfirm } from '../../lib/confirm-context';
import { ecrire } from '../../lib/db';
import { uploadToStorage, COTE_MAX } from '../../lib/photo-upload';
import LogoYaka from '../../components/LogoYaka';
import BoutonIcone from '../../components/BoutonIcone';
import { colors, fonts, typography, breakpoints, radii, spacing, cible } from '../../lib/theme';
import { useZonesSures } from '../../lib/zones';
import { lienVers } from '../../lib/liens';

// Icône d'une ligne de menu, posée nue : sans le carré coloré qui la portait,
// elle gagne 3 px pour garder sa présence.
const ICONE_MENU = 18;

// Blanc à 15 % : pastille du bouton Paramètres sur le bandeau de marque.
const VOILE_CLAIR = 'rgba(255,255,255,0.15)';

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={2}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  value,
  href,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  /** Écran ouvert par la ligne : elle devient un vrai lien sur le web. */
  href?: string;
  /** Action sans destination (message d'information). */
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
      accessibilityRole={href ? 'link' : 'button'}
      {...(href ? lienVers(href) : { onPress })}
    >
      {icon}
      <Text style={styles.menuLabel}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      <ChevronRight size={15} color={colors.borderStrong} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const confirm = useConfirm();
  const { haut } = useZonesSures();
  // `null` : compte inconnu (pas encore chargé, ou requête en échec). Afficher
  // « 0 » dans ce cas annonçait à l'utilisateur qu'il n'avait aucune
  // réservation alors que c'était le réseau qui n'avait pas répondu.
  const [bookingCount, setBookingCount] = useState<number | null>(null);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
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
      .then(({ count, error }) => setBookingCount(error ? null : count ?? 0));
    supabase
      .from('favorites')
      .select('id', { count: 'exact', head: true })
      .eq('traveler_id', session.user.id)
      .then(({ count, error }) => setFavoriteCount(error ? null : count ?? 0));
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('traveler_id', session.user.id)
      .then(({ count, error }) => setReviewCount(error ? null : count ?? 0));
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
    // 512 px suffisent : la photo n'est jamais affichée au-delà de 84 points.
    // `uploadToStorage` prévient lui-même en cas d'échec.
    const url = await uploadToStorage(
      result.assets[0].uri,
      `avatars/${session.user.id}/avatar-${Date.now()}.jpg`,
      COTE_MAX.vignette,
    );
    if (url) {
      // L'enregistrement n'était pas vérifié : un refus de la base laissait
      // l'ancienne photo en place sans rien dire.
      const enregistre = await ecrire(
        supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id),
        'Enregistrement de la photo de profil',
      );
      if (enregistre) await refreshProfile();
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

  const connecte = !!session?.user;
  const versConnexion = () => router.push({
    pathname: '/(auth)/login',
    params: { redirect: '/(tabs)/profile' },
  });

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── En-tête ── */}
        {/* Le plancher de 32 redonne le dégagement d'origine là où il n'y a pas
            d'encoche (web) ; ailleurs, c'est la barre d'état réelle qui compte. */}
        <View style={[styles.header, { paddingTop: Math.max(haut, spacing.xl) }]}>
          {connecte && (
            <BoutonIcone
              label="Paramètres"
              taille={32}
              fond={VOILE_CLAIR}
              onPress={() => showComingSoon('Paramètres')}
              icon={<Settings size={16} color={colors.cream} />}
              style={[styles.settingsBtn, { top: haut }]}
            />
          )}

          {connecte ? (
            <>
              {/* Photo de profil, modifiable au clic */}
              <Pressable
                style={styles.avatarWrapper}
                onPress={handleChangeAvatar}
                disabled={uploadingAvatar}
                accessibilityRole="button"
                accessibilityLabel="Changer la photo de profil"
                aria-disabled={uploadingAvatar} aria-busy={uploadingAvatar}
              >
                <View style={styles.avatar}>
                  {uploadingAvatar ? (
                    <ActivityIndicator color={colors.lave} />
                  ) : profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} accessibilityLabel="Votre photo de profil" />
                  ) : (
                    <Text style={styles.avatarText}>{initial}</Text>
                  )}
                </View>
                <View style={styles.cameraBadge}>
                  <Camera size={12} color={colors.lave} />
                </View>
              </Pressable>

              <Text style={styles.name} accessibilityRole="header" aria-level={1}>{displayName}</Text>
              <Text style={styles.contact}>{displayEmail}</Text>

              {/* Chaque compteur est annoncé d'un bloc, chiffre et libellé
                  ensemble ; un tiret seul ne dirait rien à la lecture vocale. */}
              <View style={styles.statsRow}>
                <Pressable
                  style={styles.stat}
                  accessibilityRole="link"
                  accessibilityLabel={`Réservations : ${bookingCount ?? 'nombre indisponible'}`}
                  {...lienVers('/bookings')}
                >
                  <Text style={styles.statValue}>{bookingCount ?? '—'}</Text>
                  <Text style={styles.statLabel}>Réservations</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <Pressable
                  style={styles.stat}
                  accessibilityRole="link"
                  accessibilityLabel={`Favoris : ${favoriteCount ?? 'nombre indisponible'}`}
                  {...lienVers('/favorites')}
                >
                  <Text style={styles.statValue}>{favoriteCount ?? '—'}</Text>
                  <Text style={styles.statLabel}>Favoris</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <View
                  style={styles.stat}
                  accessible
                  accessibilityLabel={`Avis : ${reviewCount ?? 'nombre indisponible'}`}
                >
                  <Text style={styles.statValue}>{reviewCount ?? '—'}</Text>
                  <Text style={styles.statLabel}>Avis</Text>
                </View>
              </View>
            </>
          ) : (
            /* Sans compte, cet écran affichait « Utilisateur », trois compteurs
               à zéro et un bouton « Se déconnecter » : le portrait d'un compte
               qui n'existe pas. Il dit maintenant ce qu'un compte apporte, et
               comment en ouvrir un. */
            <>
              <View style={styles.avatarWrapper}>
                <LogoYaka size={64} />
              </View>
              <Text style={styles.name} accessibilityRole="header" aria-level={1}>Bienvenue sur YakaRDC</Text>
              <Text style={[styles.contact, styles.guestText]}>
                Connectez-vous pour réserver, retrouver vos favoris et suivre vos demandes.
              </Text>
              <View style={styles.guestActions}>
                <Pressable style={styles.guestPrimary} onPress={versConnexion} accessibilityRole="button">
                  <Text style={styles.guestPrimaryText}>Se connecter</Text>
                </Pressable>
                <Pressable style={styles.guestSecondary} onPress={() => router.push('/(auth)/register')} accessibilityRole="button">
                  <Text style={styles.guestSecondaryText}>Créer un compte</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.content}>
          {/* ── Mon compte ── */}
          {connecte && (
          <MenuSection title="MON COMPTE">
            <MenuItem
              icon={<User size={ICONE_MENU} color={colors.lave} />}
              label="Modifier le profil"
              href="/edit-profile"
            />
            <MenuItem
              icon={<KeyRound size={ICONE_MENU} color={colors.lave} />}
              label="Mot de passe"
              href="/change-password"
            />
            <MenuItem
              icon={<Heart size={ICONE_MENU} color={colors.lave} />}
              label="Mes favoris"
              value={favoriteCount ? String(favoriteCount) : undefined}
              href="/favorites"
            />
            <MenuItem
              icon={<CalendarCheck size={ICONE_MENU} color={colors.lave} />}
              label="Historique des réservations"
              href="/bookings"
              last
            />
          </MenuSection>
          )}

          {/* ── Préférences ── */}
          <MenuSection title="PRÉFÉRENCES">
            {connecte && (
              <MenuItem
                icon={<Bell size={ICONE_MENU} color={colors.fleuveDark} />}
                label="Notifications"
                href="/notifications"
              />
            )}
            <MenuItem
              icon={<Languages size={ICONE_MENU} color={colors.fleuveDark} />}
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
              icon={<Store size={ICONE_MENU} color={colors.warning} />}
              label="Devenir partenaire"
              href="/become-partner"
              last
            />
          </MenuSection>

          {/* ── Assistance ── */}
          <MenuSection title="ASSISTANCE">
            <MenuItem
              icon={<HelpCircle size={ICONE_MENU} color={colors.warning} />}
              label="Centre d'aide"
              onPress={() => showComingSoon("Centre d'aide")}
            />
            <MenuItem
              icon={<Shield size={ICONE_MENU} color={colors.warning} />}
              label="Politique de confidentialité"
              href="/confidentialite"
            />
            <MenuItem
              icon={<FileText size={ICONE_MENU} color={colors.warning} />}
              label="Conditions d'utilisation"
              href="/conditions"
              last
            />
          </MenuSection>

          {/* ── Déconnexion ── */}
          {connecte && (
            <Pressable style={styles.logoutButton} onPress={handleLogout} accessibilityRole="button">
              <LogOut color={colors.danger} size={15} />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.lave,
    // Le retrait haut est posé à l'appel, d'après la zone sûre de l'appareil.
    paddingBottom: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    position: 'relative',
  },
  // Position seulement : la pastille et sa zone de 44 px viennent de BoutonIcone.
  settingsBtn: {
    position: 'absolute',
    right: spacing.gutter,
  },
  avatarWrapper: {
    marginBottom: spacing.v12,
    position: 'relative',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radii.pill,
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
    borderRadius: radii.md,
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
    marginBottom: spacing.v2,
  },
  contact: {
    ...typography.captionSm,
    color: colors.onBrandMuted,
    marginBottom: spacing.v20,
  },
  // État invité
  guestText: { textAlign: 'center', maxWidth: 300, paddingHorizontal: spacing.md, lineHeight: 17 },
  guestActions: { flexDirection: 'row', gap: spacing.v12 },
  guestPrimary: {
    backgroundColor: colors.amber, borderRadius: radii.pill,
    paddingHorizontal: spacing.v20, paddingVertical: spacing.v12,
    minHeight: cible.min, justifyContent: 'center',
  },
  guestPrimaryText: { ...typography.pillLabel, color: colors.laveDeep },
  guestSecondary: {
    borderWidth: 1, borderColor: 'rgba(250,248,244,0.5)', borderRadius: radii.pill,
    paddingHorizontal: spacing.v20, paddingVertical: spacing.v12,
    minHeight: cible.min, justifyContent: 'center',
  },
  guestSecondaryText: { ...typography.pillLabel, color: colors.cream },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.v20,
  },
  stat: { alignItems: 'center', justifyContent: 'center', minWidth: cible.min, minHeight: cible.min },
  statValue: {
    ...typography.titleMd,
    color: colors.cream,
  },
  statLabel: {
    ...typography.captionSm,
    color: colors.onBrandMuted,
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
  section: { gap: spacing.sm },
  sectionLabel: {
    ...typography.overlineXs,
    color: colors.faint,
    paddingHorizontal: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radii.v16,
    overflow: 'hidden',
    shadowColor: colors.nuit,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.v12,
    paddingHorizontal: spacing.v12,
    // 16 et non plus 12 : le carré de 30 px qui portait l'icône donnait sa
    // hauteur à la ligne. Sans lui, ce retrait la maintient vers 51 px.
    paddingVertical: spacing.md,
    minHeight: cible.min,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
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
    borderRadius: radii.md,
    paddingVertical: spacing.v12,
    minHeight: cible.min,
    marginTop: spacing.v2,
  },
  logoutText: { ...typography.pillLabel, color: colors.danger },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.cream,
    borderRadius: radii.lg,
    padding: spacing.v20,
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.v12,
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
    gap: spacing.v12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.v12,
    borderRadius: radii.md,
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
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  confirmBtnText: {
    ...typography.labelMd,
    color: colors.white,
  },
});