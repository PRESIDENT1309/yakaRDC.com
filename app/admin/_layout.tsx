import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Modal, useWindowDimensions,
} from 'react-native';
import { Slot, router, usePathname } from 'expo-router';
import LogoYaka from '../../components/LogoYaka';
import BoutonIcone from '../../components/BoutonIcone';
import {
  LayoutDashboard, ChartBar, Users, Store, History,
  Star, MapPin, LogOut, Building2, Menu, X, Image as ImageIcon,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { lienVers } from '../../lib/liens';
import { etatCourant } from '../../lib/a11y';
import { useZonesSures } from '../../lib/zones';
import { colors, typography, radii, spacing, fonts, breakpoints, cible } from '../../lib/theme';

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

function estActive(item: NavItem, pathname: string) {
  return pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
}

interface NavListProps {
  pathname: string;
  pendingRequests: number;
  nomProfil: string | null | undefined;
  onSignOut: () => void;
  /** Présent dans le tiroir mobile seulement : affiche la croix et referme après un choix. */
  onClose?: () => void;
}

// Composant de module, et non déclaré dans le layout : là, il changerait
// d'identité à chaque rendu, et React démonterait puis remonterait tout le
// menu — en perdant au passage sa position de défilement.
function NavList({ pathname, pendingRequests, nomProfil, onSignOut, onClose }: NavListProps) {
  return (
    <>
      <View style={styles.brand}>
        <LogoYaka size={26} plateRadius={20} />
        <View>
          <Text style={styles.brandTitle}>YakaRDC</Text>
          <Text style={styles.brandSub}>Administration</Text>
        </View>
        {onClose && (
          <BoutonIcone
            label="Fermer le menu"
            taille={30}
            onPress={onClose}
            style={styles.closeDrawerBtn}
            icon={<X size={18} color={colors.cream} />}
          />
        )}
      </View>

      <View style={styles.navZone} role="navigation" aria-label="Administration">
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {NAV.map(item => {
            const active = estActive(item, pathname);
            const badgeValue = item.badgeKey === 'pendingRequests' ? pendingRequests : 0;
            return (
              <Pressable
                key={item.key}
                disabled={!item.ready}
                accessibilityRole="link"
                // Le chiffre seul, lu après le libellé, ne dit pas ce qu'il compte.
                accessibilityLabel={item.ready && badgeValue > 0 ? `${item.label}, ${badgeValue} en attente` : undefined}
                // L'entrée courante n'était signalée que par son fond.
                {...etatCourant(active)}
                style={[styles.navItem, active && styles.navItemActive, !item.ready && styles.navItemDisabled]}
                {...(item.ready ? lienVers(item.href, { avant: onClose }) : null)}
              >
                {item.icon(active ? colors.cream : colors.onDarkMuted)}
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                {item.ready && badgeValue > 0 && (
                  <View style={styles.navBadge}><Text style={styles.navBadgeText}>{badgeValue}</Text></View>
                )}
                {!item.ready && <Text style={styles.soonTag}>Bientôt</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.sidebarFooter}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(nomProfil ?? 'A').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>{nomProfil ?? 'Admin'}</Text>
            <Text style={styles.profileRole}>Super-utilisateur</Text>
          </View>
          <BoutonIcone
            label="Se déconnecter"
            taille={15}
            onPress={onSignOut}
            icon={<LogOut size={15} color={colors.onDarkMuted} />}
          />
        </View>
      </View>
    </>
  );
}

export default function AdminLayout() {
  const { profile, loading } = useAuth();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { haut, insets } = useZonesSures();
  const isMobile = width < breakpoints.tablet;
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

  const activeItem = NAV.find(item => estActive(item, pathname));
  const fermerTiroir = () => setDrawerOpen(false);

  // ── Desktop / tablette : sidebar fixe classique ──
  if (!isMobile) {
    return (
      <View style={styles.screen}>
        <View style={[styles.sidebar, { paddingTop: haut }]}>
          <NavList
            pathname={pathname}
            pendingRequests={pendingRequests}
            nomProfil={profile.full_name}
            onSignOut={handleSignOut}
          />
        </View>
        {/* Ici aucun bandeau ne sépare le contenu de la barre d'état (tablette) :
            elle est dégagée une fois pour tous les écrans, qui n'ont plus à
            la deviner chacun de leur côté. Sur le web, la marge vaut 0. */}
        <View style={[styles.main, { paddingTop: insets.top }]}>
          <Slot />
        </View>
      </View>
    );
  }

  // ── Mobile : barre du haut + tiroir de navigation ──
  return (
    <View style={styles.screenMobile}>
      <View style={[styles.topBar, { paddingTop: haut }]}>
        <BoutonIcone
          label="Ouvrir le menu"
          expanded={drawerOpen}
          taille={34}
          onPress={() => setDrawerOpen(true)}
          icon={<Menu size={20} color={colors.ink} />}
        />
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {activeItem?.label ?? 'Administration'}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.mainMobile}>
        <Slot />
      </View>

      {/* Dans un `Modal`, et non en superposition dans la page : le focus
          clavier restait libre de passer derrière le tiroir, et Échap ne le
          fermait pas. Sur le web, react-native-web y retient le focus et relaie
          Échap vers `onRequestClose` ; sur Android, c'est le bouton retour. */}
      <Modal
        visible={drawerOpen}
        transparent
        statusBarTranslucent
        onRequestClose={fermerTiroir}
        accessibilityLabel="Menu de l'administration"
      >
        <View style={styles.modalFond}>
          {/* Le tiroir vient avant le voile : à l'ouverture, le focus se pose
              sur le premier élément rencontré, qui doit être la croix. */}
          <View style={[styles.drawer, { paddingTop: haut }]}>
            <NavList
              pathname={pathname}
              pendingRequests={pendingRequests}
              nomProfil={profile.full_name}
              onSignOut={handleSignOut}
              onClose={fermerTiroir}
            />
          </View>
          {/* Retiré de la lecture vocale et de la tabulation : la croix du
              tiroir ferme déjà, inutile de l'annoncer deux fois. */}
          <Pressable style={styles.backdrop} onPress={fermerTiroir} accessible={false} focusable={false} aria-hidden importantForAccessibility="no" />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },

  // Desktop
  screen: { flex: 1, flexDirection: 'row', backgroundColor: colors.cream },
  sidebar: { width: 220, backgroundColor: colors.chrome, flexDirection: 'column' },
  main: { flex: 1, backgroundColor: colors.cream },

  // Mobile
  screenMobile: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.v12, paddingBottom: spacing.v12,
    backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  topBarTitle: { ...typography.labelMd, flex: 1, textAlign: 'center', color: colors.ink, },
  mainMobile: { flex: 1 },
  modalFond: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  drawer: { width: '78%', maxWidth: 280, backgroundColor: colors.chrome },
  closeDrawerBtn: { marginLeft: 'auto' },

  // Partagé sidebar/drawer
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, paddingHorizontal: spacing.gutter, paddingBottom: spacing.md },
  brandTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.cream },
  brandSub: { ...typography.captionSm, color: colors.onDarkMuted, },
  navZone: { flex: 1 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    paddingHorizontal: spacing.gutter, paddingVertical: spacing.v12, minHeight: cible.min,
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  navItemDisabled: { opacity: 0.45 },
  navLabel: { ...typography.bodyXs, color: colors.onDarkMuted, flex: 1, },
  navLabelActive: { color: colors.cream, fontFamily: fonts.sansMedium },
  navBadge: { backgroundColor: colors.lave, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 1.5, minWidth: 18, alignItems: 'center' },
  navBadgeText: { ...typography.captionMd, color: colors.cream, },
  soonTag: { ...typography.captionSm, color: colors.onDarkMuted, },
  sidebarFooter: { padding: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 30, height: 30, borderRadius: radii.v16, backgroundColor: colors.lave, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.pillLabel, color: colors.cream, },
  profileName: { ...typography.captionMd, color: colors.cream, },
  profileRole: { ...typography.captionSm, color: colors.onDarkMuted, },
});