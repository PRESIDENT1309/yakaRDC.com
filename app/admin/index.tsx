import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Search, Store, ChevronRight, CalendarDays, Building2, Sparkles } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { lienVers } from '../../lib/liens';
import { colors, categoryColors, typography, radii, spacing, breakpoints, cible } from '../../lib/theme';
import CategoryIcon from '../../components/CategoryIcon';
import StatCard from '../../components/StatCard';
import type { Establishment, PartnerRequest } from '../../lib/types';

interface EstabBookingSummary {
  establishment: Establishment;
  pending: number;
  confirmed: number;
  checkedIn: number;
}

export default function AdminOverview() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeEstablishments, setActiveEstablishments] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [newUsersThisMonth, setNewUsersThisMonth] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  const [todayPending, setTodayPending] = useState(0);
  const [todayConfirmed, setTodayConfirmed] = useState(0);
  const [todayCheckedIn, setTodayCheckedIn] = useState(0);

  const [perEstablishment, setPerEstablishment] = useState<EstabBookingSummary[]>([]);
  const [recentRequests, setRecentRequests] = useState<PartnerRequest[]>([]);

  const fetchAll = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      { count: estabCount },
      { count: usersCount },
      { count: newUsersCount },
      { count: reqCount },
      { data: establishments },
      { data: todaysBookings },
      { data: requests },
    ] = await Promise.all([
      supabase.from('establishments').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
      supabase.from('partner_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('establishments').select('*').eq('status', 'approved'),
      supabase.from('bookings').select('*, establishment:establishments(*)').gte('created_at', todayStart.toISOString()),
      supabase.from('partner_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
    ]);

    setActiveEstablishments(estabCount ?? 0);
    setTotalUsers(usersCount ?? 0);
    setNewUsersThisMonth(newUsersCount ?? 0);
    setPendingRequests(reqCount ?? 0);

    const bookings = (todaysBookings as any[]) ?? [];
    setTodayPending(bookings.filter(b => b.status === 'pending').length);
    setTodayConfirmed(bookings.filter(b => b.status === 'confirmed').length);
    setTodayCheckedIn(bookings.filter(b => b.status === 'checked_in').length);

    const summaries: EstabBookingSummary[] = ((establishments as Establishment[]) ?? []).map(e => {
      const its = bookings.filter(b => b.establishment_id === e.id);
      return {
        establishment: e,
        pending: its.filter(b => b.status === 'pending').length,
        confirmed: its.filter(b => b.status === 'confirmed').length,
        checkedIn: its.filter(b => b.status === 'checked_in').length,
      };
    }).filter(s => s.pending + s.confirmed + s.checkedIn > 0);
    setPerEstablishment(summaries);

    setRecentRequests((requests as PartnerRequest[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const todayTotal = todayPending + todayConfirmed + todayCheckedIn;
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Vue d'ensemble</Text>
          <Text style={styles.headerSub}>{dateLabel}</Text>
        </View>
        <View style={styles.searchBox}>
          <Search size={13} color={colors.faint} />
          <Text style={styles.searchPlaceholder}>Rechercher...</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={colors.lave} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.lave} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Stats globales */}
            <View style={styles.statsGrid}>
              <StatCard style={styles.statCard} value={activeEstablishments} label="Établissements actifs" />
              <StatCard style={[styles.statCard, styles.statCardAccent]} couleur={colors.lave} value={todayTotal} label="Réservations aujourd'hui" />
              <StatCard style={styles.statCard} value={totalUsers} label="Utilisateurs total" />
              <StatCard style={[styles.statCard, styles.statCardGreen]} couleur={colors.success} value={newUsersThisMonth} label="Nouveaux ce mois" />
              <StatCard style={[styles.statCard, styles.statCardAmber]} couleur={colors.warning} value={pendingRequests} label="Demandes partenaires" />
            </View>

            {/* Réservations du jour - ensemble */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <CalendarDays size={14} color={colors.muted} />
                  <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>Réservations du jour — Toutes plateformes</Text>
                </View>
                <Text style={styles.cardHeaderTotal}>{todayTotal} au total</Text>
              </View>
              <View style={styles.todayRow}>
                {/* Chiffre et libellé lus ensemble : séparés, ce sont deux annonces sans lien. */}
                <View style={styles.todayBox} accessible accessibilityLabel={`${todayPending}, En attente`}>
                  <Text style={[styles.todayValue, { color: colors.lave }]}>{todayPending}</Text>
                  <Text style={styles.todayLabel}>En attente</Text>
                </View>
                <View style={styles.todayBox} accessible accessibilityLabel={`${todayConfirmed}, Confirmées`}>
                  <Text style={[styles.todayValue, { color: colors.success }]}>{todayConfirmed}</Text>
                  <Text style={styles.todayLabel}>Confirmées</Text>
                </View>
                <View style={styles.todayBox} accessible accessibilityLabel={`${todayCheckedIn}, Check-ins`}>
                  <Text style={[styles.todayValue, { color: colors.fleuveDark }]}>{todayCheckedIn}</Text>
                  <Text style={styles.todayLabel}>Check-ins</Text>
                </View>
              </View>
            </View>

            {/* Par établissement */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Building2 size={14} color={colors.muted} />
                <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>Réservations du jour — Par établissement</Text>
              </View>
              {perEstablishment.length === 0 ? (
                <Text style={styles.emptyText}>Aucune réservation aujourd'hui pour le moment.</Text>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.v12 }}>
                  {perEstablishment.map(s => {
                    const cat = categoryColors[s.establishment.type];
                    return (
                      <View key={s.establishment.id} style={styles.estabRow}>
                        <CategoryIcon type={s.establishment.type} size={16} color={cat?.accent ?? colors.lave} />
                        <Text style={styles.estabName} numberOfLines={1}>{s.establishment.name}</Text>
                        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                          {s.pending > 0 && (
                            <View style={[styles.miniBadge, { backgroundColor: colors.warningSoft }]}>
                              <Text style={[styles.miniBadgeText, { color: colors.warning }]}>{s.pending} attente</Text>
                            </View>
                          )}
                          {s.confirmed > 0 && (
                            <View style={[styles.miniBadge, { backgroundColor: colors.successSoft }]}>
                              <Text style={[styles.miniBadgeText, { color: colors.success }]}>{s.confirmed} confirm.</Text>
                            </View>
                          )}
                          {s.checkedIn > 0 && (
                            <View style={[styles.miniBadge, { backgroundColor: colors.fleuveSoft }]}>
                              <Text style={[styles.miniBadgeText, { color: colors.fleuveDark }]}>{s.checkedIn} check-in</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Demandes partenaires récentes */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Sparkles size={14} color={colors.muted} />
                  <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>Nouvelles demandes de partenariat</Text>
                </View>
                {pendingRequests > 0 && (
                  <Pressable
                    style={styles.cardLinkZone}
                    accessibilityRole="link"
                    accessibilityLabel="Voir toutes les demandes de partenariat"
                    {...lienVers('/admin/partner-requests')}
                  >
                    <Text style={styles.cardLink}>Voir toutes →</Text>
                  </Pressable>
                )}
              </View>
              {recentRequests.length === 0 ? (
                <Text style={styles.emptyText}>Aucune demande en attente.</Text>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {recentRequests.map(r => (
                    <Pressable
                      key={r.id}
                      style={styles.requestRow}
                      accessibilityRole="link"
                      {...lienVers('/admin/partner-requests')}
                    >
                      <Store size={16} color={colors.lave} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.requestName} numberOfLines={1}>{r.establishment_name}</Text>
                        <Text style={styles.requestMeta}>
                          {new Date(r.created_at).toLocaleDateString('fr-FR')} · {r.commune ?? r.city}
                        </Text>
                      </View>
                      <View style={styles.examineBtn}>
                        <Text style={styles.examineBtnText}>Examiner</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Largeur de la colonne de contenu. L'en-tete la partage : mesure faite dans
// le DOM, il courait jusqu'a 1220 px alors que le contenu s'arretait a 900,
// laissant le champ de recherche flotter 320 px au-dela. Le filet du bas
// delimite desormais exactement la colonne.
// La colonne est centrée : calée à gauche, elle laissait sur grand écran tout
// le vide du même côté.
const ADMIN_MAX = breakpoints.dashboardMax;

// Hauteur de la ligne « Voir toutes » : le surplus de sa zone tactile est
// annulé par une marge négative, pour ne pas épaissir l'en-tête de la carte.
const HAUTEUR_LIEN = 16;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    maxWidth: ADMIN_MAX, width: '100%', alignSelf: 'center',
    // La zone sûre est dégagée par le layout de l'admin (bandeau ou marge).
    paddingTop: spacing.md,
    paddingHorizontal: spacing.v20, paddingBottom: spacing.v12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.sm, paddingHorizontal: spacing.v12, paddingVertical: spacing.sm,
  },
  searchPlaceholder: { ...typography.captionSm, color: colors.faint, },
  content: { padding: spacing.v20, gap: spacing.v12, width: '100%', maxWidth: ADMIN_MAX, alignSelf: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Place dans la grille, et teinte des cartes mises en avant : le reste du
  // dessin (rayon, filet, typographie) vient de StatCard.
  statCard: { flex: 1, minWidth: 140 },
  statCardAccent: { backgroundColor: colors.laveSoft, borderColor: colors.laveBorder },
  statCardGreen: { backgroundColor: colors.successSoft, borderColor: colors.successBorder },
  statCardAmber: { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  cardTitle: { ...typography.pillLabel, color: colors.ink, flexShrink: 1 },
  cardHeaderTotal: { ...typography.captionMd, color: colors.lave, },
  cardLinkZone: { minHeight: cible.min, justifyContent: 'center', marginVertical: -(cible.min - HAUTEUR_LIEN) / 2 },
  cardLink: { ...typography.captionMd, color: colors.lave, },
  todayRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.v12 },
  todayBox: { flex: 1, backgroundColor: colors.cream, borderRadius: radii.sm, padding: spacing.sm, alignItems: 'center' },
  todayValue: { ...typography.titleSm, },
  todayLabel: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  emptyText: { ...typography.bodyXs, color: colors.muted, marginTop: spacing.sm, },
  estabRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, padding: spacing.v12, backgroundColor: colors.cream, borderRadius: radii.sm },
  estabName: { ...typography.caption, flex: 1, color: colors.ink, },
  miniBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.v2, borderRadius: radii.pill },
  miniBadgeText: { ...typography.captionMd, },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, paddingVertical: spacing.sm, paddingHorizontal: spacing.v12, backgroundColor: colors.laveSoft, borderRadius: radii.sm },
  requestName: { ...typography.caption, color: colors.ink, },
  requestMeta: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  examineBtn: { backgroundColor: colors.lave, borderRadius: radii.sm, paddingHorizontal: spacing.v12, paddingVertical: spacing.xs },
  examineBtnText: { ...typography.captionMd, color: colors.cream, },
});