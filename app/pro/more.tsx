import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import {
  Star, ChartBar, Settings, LogOut, ChevronRight,
  TrendingUp, Users, Award, Bell, Globe, Shield, HelpCircle,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, typography, breakpoints, radii, spacing } from '../../lib/theme';
import { Alert } from '../../lib/alert';

type Section = 'menu' | 'stats' | 'settings';

// Ces réglages n'existent pas encore. Un bouton muet est pire qu'un bouton
// qui dit qu'il n'est pas prêt : l'utilisateur croit que l'app est cassée.
function showComingSoon(feature: string, message?: string) {
  Alert.alert(feature, message ?? 'Cette fonctionnalité arrive bientôt sur YakaRDC.');
}

function MenuRow({ icon, label, onPress, badge }:
  { icon: React.ReactNode; label: string; onPress: () => void; badge?: string }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge && <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{badge}</Text></View>}
      <ChevronRight size={14} color={colors.borderStrong} />
    </Pressable>
  );
}

/**
 * Chiffres réels de l'établissement.
 *
 * Cet écran affichait jusqu'ici des valeurs écrites en dur : « 212 avis »,
 * « 4.8 » de note, « +18 % de croissance », « 47 clients ce mois », deux avis
 * signés « Jean-Paul M. » et « Marie K. » — sur un établissement qui n'a aucun
 * avis. Un partenaire y lisait des données inventées sur sa propre activité.
 *
 * Le calcul reprend celui du tableau de bord (app/pro/index.tsx), volontairement
 * à l'identique : le revenu se lit sur `booking_items`, qui porte le prix gelé,
 * jamais sur le tarif courant — sinon une hausse de prix réécrirait les recettes
 * passées. Quand il n'y a rien à calculer, on affiche un tiret, pas un zéro
 * flatteur ni un chiffre inventé.
 */
type Chiffres = {
  nbAvis: number;
  noteMoyenne: number | null;
  ceMois: number;
  moisPrecedent: number;
  tauxConfirmation: number | null;
};

export default function MoreScreen() {
  const { profile } = useAuth();
  const [section, setSection] = useState<Section>('menu');
  const [chiffres, setChiffres] = useState<Chiffres | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let annule = false;

    (async () => {
      const { data: est } = await supabase.from('establishments').select('id')
        .eq('owner_id', profile.id).limit(1).maybeSingle();
      if (!est || annule) return;

      const now = new Date();
      const debutCeMois = new Date(now.getFullYear(), now.getMonth(), 1);
      const debutMoisPrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const iso = (d: Date) => d.toISOString().slice(0, 10);

      const [{ data: bookings }, { data: reviews }] = await Promise.all([
        supabase.from('bookings').select('status, created_at')
          .eq('establishment_id', est.id)
          .gte('created_at', iso(debutMoisPrec)),
        supabase.from('reviews').select('rating').eq('establishment_id', est.id),
      ]);
      if (annule) return;

      const b = bookings ?? [];
      const dansLeMois = (x: any, debut: Date, fin?: Date) => {
        const d = new Date(x.created_at);
        return d >= debut && (!fin || d < fin);
      };
      const ceMois = b.filter(x => dansLeMois(x, debutCeMois)).length;
      const moisPrecedent = b.filter(x => dansLeMois(x, debutMoisPrec, debutCeMois)).length;
      const confirmes = b.filter(x => ['confirmed', 'checked_in'].includes(x.status)).length;

      const r = reviews ?? [];
      setChiffres({
        nbAvis: r.length,
        noteMoyenne: r.length ? r.reduce((s, x: any) => s + x.rating, 0) / r.length : null,
        ceMois,
        moisPrecedent,
        tauxConfirmation: b.length ? Math.round((confirmes / b.length) * 100) : null,
      });
    })();

    return () => { annule = true; };
  }, [profile?.id]);

  // Croissance : sans mois précédent, il n'y a pas de comparaison à faire.
  const croissance = chiffres && chiffres.moisPrecedent > 0
    ? Math.round(((chiffres.ceMois - chiffres.moisPrecedent) / chiffres.moisPrecedent) * 100)
    : null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  // La section « avis » a été retirée : elle affichait un score et deux avis
  // inventés, alors que app/pro/pro-reviews.tsx lit les vrais depuis Supabase.
  // « Avis clients » y renvoie désormais directement.

  if (section === 'stats') {
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <View style={styles.subHeaderInner}>
          <Pressable onPress={() => setSection('menu')} hitSlop={8}>
            <Text style={styles.backLink}>← Retour</Text>
          </Pressable>
          <Text style={styles.subHeaderTitle}>Statistiques</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statsGrid}>
            <View style={styles.bigStatCard}>
              <TrendingUp size={18} color={colors.lave} />
              <Text style={styles.bigStatValue}>
                {croissance === null ? '—' : (croissance > 0 ? '+' : '') + croissance + '%'}
              </Text>
              <Text style={styles.bigStatLabel}>
                {croissance === null ? 'Pas encore de mois à comparer' : 'Croissance ce mois'}
              </Text>
            </View>
            <View style={styles.bigStatCard}>
              <Users size={18} color={colors.success} />
              <Text style={styles.bigStatValue}>{chiffres ? chiffres.ceMois : '—'}</Text>
              <Text style={styles.bigStatLabel}>Réservations ce mois</Text>
            </View>
            <View style={styles.bigStatCard}>
              <Award size={18} color={colors.warning} />
              <Text style={styles.bigStatValue}>
                {chiffres?.noteMoyenne != null ? chiffres.noteMoyenne.toFixed(1) : '—'}
              </Text>
              <Text style={styles.bigStatLabel}>
                {chiffres?.nbAvis ? `Note moyenne · ${chiffres.nbAvis} avis` : 'Aucun avis pour le moment'}
              </Text>
            </View>
            <View style={styles.bigStatCard}>
              <ChartBar size={18} color={colors.ink} />
              <Text style={styles.bigStatValue}>
                {chiffres?.tauxConfirmation != null ? chiffres.tauxConfirmation + '%' : '—'}
              </Text>
              <Text style={styles.bigStatLabel}>Taux de confirmation</Text>
            </View>
          </View>
          <Text style={styles.statsNote}>
            📈 Les statistiques avancées (revenus détaillés, comparaison périodes, export) arrivent dans une prochaine mise à jour.
          </Text>
        </ScrollView>
      </View>
    );
  }

  if (section === 'settings') {
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <View style={styles.subHeaderInner}>
          <Pressable onPress={() => setSection('menu')} hitSlop={8}>
            <Text style={styles.backLink}>← Retour</Text>
          </Pressable>
          <Text style={styles.subHeaderTitle}>Paramètres</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <MenuRow
              icon={<Bell size={16} color={colors.lave} />}
              label="Notifications"
              onPress={() => router.push('/notifications')}
            />
            <MenuRow
              icon={<Globe size={16} color={colors.lave} />}
              label="Langue"
              badge="Français"
              onPress={() => showComingSoon('Langue', "YakaRDC est disponible en français. D'autres langues arrivent prochainement.")}
            />
            <MenuRow
              icon={<Shield size={16} color={colors.lave} />}
              label="Confidentialité"
              onPress={() => showComingSoon('Confidentialité')}
            />
            <MenuRow
              icon={<HelpCircle size={16} color={colors.lave} />}
              label="Centre d'aide"
              onPress={() => showComingSoon("Centre d'aide")}
            />
          </View>
          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <LogOut size={16} color={colors.danger} />
            <Text style={styles.signOutText}>Se déconnecter</Text>
          </Pressable>
          <Text style={styles.version}>YakaRDC Pro v1.0.0</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
        <Text style={styles.headerTitle}>Plus</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(profile?.full_name ?? 'P').charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profile?.full_name ?? 'Partenaire'}</Text>
            <Text style={styles.profileEmail}>{profile?.email}</Text>
          </View>
        </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <MenuRow
            icon={<Star size={16} color={colors.warning} />}
            label="Avis clients"
            badge={chiffres ? String(chiffres.nbAvis) : undefined}
            onPress={() => router.push('/pro/pro-reviews')}
          />
          <MenuRow icon={<ChartBar size={16} color={colors.success} />} label="Statistiques" onPress={() => setSection('stats')} />
          <MenuRow icon={<Settings size={16} color={colors.lave} />} label="Paramètres" onPress={() => setSection('settings')} />
        </View>

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={16} color={colors.danger} />
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </Pressable>

        <Text style={styles.version}>YakaRDC Pro v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { backgroundColor: colors.lave, paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingBottom: 18 },
  headerInner: { maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center', paddingHorizontal: 18 },
  headerTitle: { ...typography.titleSm, color: colors.cream, marginBottom: spacing.v12, },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12 },
  avatarCircle: { width: 44, height: 44, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.titleSm, color: colors.cream, },
  profileName: { ...typography.labelMd, color: colors.cream, },
  profileEmail: { ...typography.captionSm, color: 'rgba(250,248,244,0.7)', marginTop: spacing.v2, },
  // Comme `header` : le fond reste en pleine largeur, son contenu s'aligne sur
  // le corps. `gap` et `paddingHorizontal` régissent les enfants — ils migrent
  // vers l'enveloppeur, sinon ils n'agiraient plus sur rien.
  subHeader: { backgroundColor: colors.lave, paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingBottom: spacing.v12 },
  subHeaderInner: { maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center', paddingHorizontal: 18, gap: spacing.sm },
  backLink: { ...typography.bodySm, color: 'rgba(250,248,244,0.8)', },
  subHeaderTitle: { ...typography.titleSm, color: colors.cream, },
  content: { maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center', padding: spacing.md, gap: spacing.v12, paddingBottom: 40 },
  card: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, padding: spacing.v12, borderBottomWidth: 1, borderBottomColor: colors.surfaceSunken },
  menuIcon: { width: 30, height: 30, borderRadius: radii.sm, backgroundColor: colors.laveSoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { ...typography.bodySm, flex: 1, color: colors.ink, },
  menuBadge: { backgroundColor: colors.surfaceSunken, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.v2 },
  menuBadgeText: { ...typography.captionSm, color: colors.muted, },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radii.md, padding: spacing.v12 },
  signOutText: { ...typography.pillLabel, color: colors.danger, },
  version: { ...typography.captionSm, textAlign: 'center', color: colors.borderStrong, },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.v12 },
  bigStatCard: { width: '47%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', gap: spacing.sm },
  bigStatValue: { ...typography.titleLg, color: colors.ink, },
  bigStatLabel: { ...typography.captionSm, color: colors.muted, textAlign: 'center', },
  statsNote: { ...typography.bodyXs, color: colors.muted, backgroundColor: colors.surfaceSunken, borderRadius: radii.md, padding: spacing.v12, marginTop: spacing.xs, },
});