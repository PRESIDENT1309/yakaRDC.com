import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput, } from 'react-native';
import { Alert } from '../../lib/alert';
import {
  CalendarCheck, Users, Wallet, Star, Bell,
  MessageCircle, Tag, ChevronRight,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { bookingTotal } from '../../lib/offers';
import { timeToSlot } from '../../lib/slots';
import { useAuth } from '../../lib/auth-context';
import { colors, fonts, typography, breakpoints, radii, spacing, cible } from '../../lib/theme';
import { useZonesSures } from '../../lib/zones';
import { lienVers } from '../../lib/liens';
import BoutonIcone from '../../components/BoutonIcone';
import StatCard from '../../components/StatCard';
import type { Establishment, Booking, Review } from '../../lib/types';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
// Lus à voix haute à la place des abréviations, qu'une synthèse vocale épelle.
const WEEKDAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function PartnerDashboard() {
  const { profile } = useAuth();
  const { haut } = useZonesSures();
  const [loading, setLoading] = useState(true);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  // « Réservations aujourd'hui » comptait les demandes REÇUES aujourd'hui
  // (`created_at`), pas les clients ATTENDUS aujourd'hui. Un restaurateur qui
  // lisait « 3 » préparait trois tables, alors que ces trois-là pouvaient être
  // pour le mois suivant. Le nombre devient donc « ce mois », et la question
  // « qui vient aujourd'hui ? » reçoit ce qu'elle mérite : une liste, pas un
  // compteur.
  const [monthCount, setMonthCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [weekCounts, setWeekCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: est } = await supabase.from('establishments').select('*')
      .eq('owner_id', profile.id).limit(1).maybeSingle();
    const e = est as Establishment | null;
    setEstablishment(e);
    if (!e) { setLoading(false); return; }

    const todayIso = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoIso = weekAgo.toISOString().slice(0, 10);

    const moisDebut = new Date();
    moisDebut.setDate(1);
    const moisDebutIso = moisDebut.toISOString().slice(0, 10);

    const [{ data: bookings }, { data: reviews }, { data: attente }, { data: duJour }] = await Promise.all([
      // Les lignes portent le prix gelé : le chiffre d'affaires se calcule
      // dessus, jamais sur le tarif courant de l'établissement — sinon une
      // hausse de prix réécrirait rétroactivement les recettes passées.
      supabase.from('bookings').select('*, booking_items(quantity, unit_price)')
        .eq('establishment_id', e.id)
        .gte('created_at', weekAgoIso),
      supabase.from('reviews').select('*').eq('establishment_id', e.id)
        .order('created_at', { ascending: false }),

      // Ce qui attend une réponse. Sans fenêtre de temps : une demande vieille
      // de trois semaines attend toujours, et c'est bien le problème.
      supabase.from('bookings').select('id')
        .eq('establishment_id', e.id).eq('status', 'pending'),

      // Qui vient aujourd'hui. Requête distincte, et c'est nécessaire : une
      // table réservée le mois dernier pour ce soir n'apparaît dans aucune
      // fenêtre fondée sur `created_at`.
      supabase.from('bookings')
        .select('id, first_name, last_name, guests, visit_time, status, check_in')
        .eq('establishment_id', e.id)
        .in('status', ['pending', 'confirmed', 'checked_in'])
        .or(`visit_date.eq.${todayIso},check_in.eq.${todayIso}`)
        .order('visit_time', { ascending: true, nullsFirst: false }),
    ]);

    setPendingCount((attente ?? []).length);
    setTodayBookings((duJour as Booking[]) ?? []);

    // Volume du mois. Compté sur `created_at`, donc « demandes reçues » — et
    // l'étiquette le dira, plutôt que de laisser le partenaire deviner.
    const { count: moisCount } = await supabase.from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('establishment_id', e.id)
      .gte('created_at', moisDebutIso);
    setMonthCount(moisCount ?? 0);

    const allBookings = (bookings as Booking[]) ?? [];

    const confirmedOrBetter = allBookings.filter(b => ['confirmed', 'checked_in'].includes(b.status));
    // Un séjour se facture à la nuit : deux chambres trois nuits, c'est six
    // unités facturées. Une visite ou un repas n'a pas de durée.
    setRevenue(confirmedOrBetter.reduce((sum, b: any) => {
      const total = bookingTotal(b.booking_items, b.check_in, b.check_out);
      return sum + (total?.amount ?? 0);
    }, 0));

    // Répartition par jour de la semaine (Lun=0 ... Dim=6), sur les 7 derniers jours
    const counts = [0, 0, 0, 0, 0, 0, 0];
    allBookings.forEach(b => {
      const jsDay = new Date(b.created_at).getDay(); // 0=Dim, 1=Lun...
      const idx = jsDay === 0 ? 6 : jsDay - 1;
      counts[idx]++;
    });
    setWeekCounts(counts);

    const allReviews = (reviews as Review[]) ?? [];
    setReviewCount(allReviews.length);
    setAvgRating(allReviews.length > 0
      ? allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length
      : null);
    setRecentReviews(allReviews.slice(0, 2));

    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  async function handleReply(reviewId: string) {
    const text = replyDraft[reviewId]?.trim();
    if (!text) return;
    setReplying(reviewId);
    await supabase.from('reviews').update({
      partner_reply: text,
      partner_replied_at: new Date().toISOString(),
    }).eq('id', reviewId);
    setReplying(null);
    fetchDashboard();
  }

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  }

  if (!establishment) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyText}>Aucun établissement associé à ce compte.</Text>
      </View>
    );
  }

  const maxCount = Math.max(...weekCounts, 1);
  // « Samedi est votre meilleur jour » sur une seule barre n'est pas une
  // observation, c'est une affirmation sans fondement. On ne la formule qu'à
  // partir de deux jours ayant reçu des réservations.
  const joursActifs = weekCounts.filter(c => c > 0).length;
  const bestDayIdx = joursActifs >= 2
    ? weekCounts.indexOf(Math.max(...weekCounts))
    : null;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: haut }]}>

        {/* En-tête */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.brandName} accessibilityRole="header" aria-level={1}>{establishment.name}</Text>
            <Text style={styles.headerSub}>Bonjour, voici votre activité</Text>
          </View>
          <BoutonIcone
            icon={<Bell size={16} color={colors.lave} />}
            label="Notifications"
            fond={colors.white}
            onPress={() => Alert.alert('Notifications', 'Bientôt disponible.')}
          />
        </View>

        {/* ── Ce qui attend une réponse ──
            Placé avant les chiffres : c'est la seule chose de cet écran sur
            laquelle le partenaire peut agir, et une demande sans réponse fait
            perdre un client. Rien ne s'affiche quand il n'y a rien à traiter. */}
        {pendingCount > 0 && (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${pendingCount} demande${pendingCount > 1 ? 's' : ''} à traiter`}
            style={styles.actionBand}
            {...lienVers('/pro/bookings')}
          >
            <CalendarCheck size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>
                {pendingCount} demande{pendingCount > 1 ? 's' : ''} en attente
              </Text>
              <Text style={styles.actionSub}>
                Sans réponse de votre part, le voyageur ne sait pas s'il est attendu.
              </Text>
            </View>
            <ChevronRight size={16} color={colors.warning} />
          </Pressable>
        )}

        {/* ── Aujourd'hui ──
            La question « qui vient aujourd'hui ? » appelait une liste, pas un
            compteur : pour préparer un service, il faut des heures et des noms. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header" aria-level={2}>Aujourd'hui</Text>
          {todayBookings.length === 0 ? (
            <Text style={styles.emptyText}>Aucune réservation prévue aujourd'hui.</Text>
          ) : (
            <View style={styles.todayCard}>
              {todayBookings.map((b: any, i) => (
                <View key={b.id} style={[styles.todayRow, i > 0 && styles.todayRowBorder]}>
                  <Text style={styles.todayHour}>
                    {b.visit_time ? timeToSlot(b.visit_time) : 'Séjour'}
                  </Text>
                  <Text style={styles.todayName} numberOfLines={1}>
                    {[b.first_name, b.last_name].filter(Boolean).join(' ') || 'Client'}
                  </Text>
                  <Text style={styles.todayGuests}>{b.guests ?? 1} pers.</Text>
                  {b.status === 'pending' && (
                    <View style={styles.todayPending}>
                      <Text style={styles.todayPendingText}>à confirmer</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 4 cartes couleur pleine */}
        <View style={styles.statsGrid}>
          <StatCard
            variante="plein"
            couleur={colors.lave}
            icon={<View style={styles.statIcon}><CalendarCheck size={16} color={colors.cream} /></View>}
            value={String(monthCount)}
            label="Demandes reçues"
            sub="ce mois-ci"
            style={styles.statCard}
          />
          <StatCard
            variante="plein"
            couleur={colors.success}
            icon={<View style={styles.statIcon}><Users size={16} color={colors.cream} /></View>}
            value={String(establishment.view_count)}
            label="Visiteurs"
            sub="de la fiche"
            style={styles.statCard}
          />
          <StatCard
            variante="plein"
            couleur={colors.warning}
            icon={<View style={styles.statIcon}><Wallet size={16} color={colors.cream} /></View>}
            value={`${revenue.toFixed(0)} $`}
            label="Généré"
            sub="réservations confirmées"
            style={styles.statCard}
          />
          <StatCard
            variante="plein"
            couleur={colors.fleuveDark}
            icon={<View style={styles.statIcon}><Star size={16} color={colors.cream} /></View>}
            value={avgRating != null ? avgRating.toFixed(1) : '—'}
            label="Note moyenne"
            sub={`${reviewCount} avis`}
            style={styles.statCard}
          />
        </View>

        {/* Graphique réservations de la semaine */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle} accessibilityRole="header" aria-level={2}>Réservations cette semaine</Text>
          </View>
          <View style={styles.chartBars}>
            {weekCounts.map((count, i) => (
              // La hauteur d'une barre ne se lit pas à l'oreille : chaque
              // colonne annonce son jour et son nombre.
              <View
                key={i}
                style={styles.barColumn}
                accessible
                accessibilityLabel={`${WEEKDAY_NAMES[i]} : ${count} réservation${count > 1 ? 's' : ''}`}
              >
                <View style={styles.barTrack}>
                  <View style={[
                    styles.barFill,
                    {
                      height: `${(count / maxCount) * 100}%`,
                      // Les barres secondaires étaient en `surfaceSunken`, soit
                      // 1,17 de contraste sur le blanc : un lundi à une
                      // réservation s'affichait sur 21 px que l'œil ne
                      // distinguait pas d'un jour vide. `laveBorder` (1,56) les
                      // rend lisibles tout en restant de la famille de la barre
                      // mise en avant — une version atténuée, pas une autre
                      // couleur.
                      backgroundColor: i === bestDayIdx ? colors.lave : colors.laveBorder,
                    },
                  ]} />
                </View>
                <Text style={[styles.barLabel, i === bestDayIdx && styles.barLabelBest]}>
                  {WEEKDAY_LABELS[i]}
                </Text>
              </View>
            ))}
          </View>
          {bestDayIdx !== null && (
            <Text style={styles.chartFooter}>
              {WEEKDAY_LABELS[bestDayIdx]} est votre meilleur jour cette semaine
            </Text>
          )}
        </View>

        {/* Avis récents */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle} accessibilityRole="header" aria-level={2}>Avis récents</Text>
            {reviewCount > 2 && (
              <Pressable
                style={styles.seeAllZone}
                accessibilityRole="link"
                // « Voir tout » seul ne dit pas tout de quoi : le titre le précise.
                accessibilityLabel="Voir tout : Avis récents"
                {...lienVers('/pro/pro-reviews')}
              >
                <Text style={styles.seeAll}>Voir tout</Text>
              </Pressable>
            )}
          </View>

          {recentReviews.length === 0 ? (
            <Text style={styles.emptyText}>Aucun avis pour le moment.</Text>
          ) : (
            <View style={{ gap: spacing.v12 }}>
              {recentReviews.map(r => {
                const brouillonVide = !replyDraft[r.id]?.trim();
                const envoiEnCours = replying === r.id;
                return (
                <View key={r.id} style={styles.reviewCard}>
                  <Text style={styles.reviewQuoteMark} aria-hidden>"</Text>
                  <View style={{ flex: 1 }}>
                    {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                    <View style={styles.reviewMetaRow}>
                      <View
                        style={{ flexDirection: 'row', gap: spacing.v2 }}
                        accessible
                        accessibilityRole="image"
                        accessibilityLabel={`Note : ${r.rating} sur 5`}
                      >
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={10} color={colors.warning} fill={i <= r.rating ? colors.warning : 'transparent'} />
                        ))}
                      </View>
                    </View>

                    {r.partner_reply ? (
                      <View style={styles.replyBox}>
                        <MessageCircle size={11} color={colors.lave} />
                        <Text style={styles.replyText}>{r.partner_reply}</Text>
                      </View>
                    ) : (
                      <View style={styles.replyForm}>
                        <TextInput
                          style={styles.replyInput}
                          value={replyDraft[r.id] ?? ''}
                          onChangeText={t => setReplyDraft(prev => ({ ...prev, [r.id]: t }))}
                          placeholder="Répondre à cet avis..."
                          placeholderTextColor={colors.faint}
                          accessibilityLabel="Répondre à cet avis"
                        />
                        <Pressable
                          style={styles.replyBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Envoyer la réponse"
                          aria-disabled={brouillonVide || envoiEnCours} aria-busy={envoiEnCours}
                          onPress={() => handleReply(r.id)}
                          disabled={brouillonVide || envoiEnCours}
                        >
                          <Text style={[styles.replyBtnText, brouillonVide && { opacity: 0.4 }]}>
                            {envoiEnCours ? '...' : 'Envoyer'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Promotion active */}
        {establishment.discount_percent != null && (
          <View style={styles.promoTicket}>
            <View style={styles.promoNotchLeft} />
            <View style={styles.promoNotchRight} />
            <Tag size={14} color={colors.amber} />
            <View>
              <Text style={styles.promoLabel}>PROMOTION ACTIVE</Text>
              <Text style={styles.promoText}>
                {establishment.discount_label ?? `-${establishment.discount_percent}%`}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  emptyText: { ...typography.bodySm, color: colors.muted, textAlign: 'center', },
  // Le retrait haut est ajouté à l'appel : il dépend de l'appareil (zone sûre).
  content: {
    maxWidth: breakpoints.dashboardMax, width: '100%', alignSelf: 'center',
    paddingHorizontal: spacing.gutter, paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: spacing.v12, marginBottom: spacing.md,
  },
  // Sans `flex`, un nom d'établissement long poussait la cloche hors de l'écran.
  headerText: { flex: 1 },
  brandName: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  // ── Bandeau « à traiter » ──
  // Le seul bloc de l'écran sur lequel on peut agir. Il emprunte la famille
  // `warning` — assez présente pour se remarquer, sans l'alarme du rouge :
  // une demande en attente est un travail à faire, pas une erreur.
  // Contraste vérifié : warning sur warningSoft donne 5,87.
  actionBand: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    backgroundColor: colors.warningSoft,
    borderWidth: 1, borderColor: colors.warningBorder,
    borderRadius: radii.md, padding: spacing.v12, marginBottom: spacing.md,
  },
  actionTitle: { ...typography.titleSm, color: colors.warning },
  actionSub: { ...typography.captionSm, color: colors.warning, marginTop: spacing.v2 },

  // ── Le service du jour ──
  // Une heure, un nom, un nombre de couverts : ce qu'il faut pour préparer.
  todayCard: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, marginTop: spacing.v12, overflow: 'hidden',
  },
  todayRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    paddingHorizontal: spacing.v12, paddingVertical: spacing.v12,
  },
  todayRowBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceSunken },
  todayHour: { ...typography.pillLabel, color: colors.lave, minWidth: 54 },
  todayName: { ...typography.bodySm, color: colors.ink, flex: 1 },
  todayGuests: { ...typography.captionSm, color: colors.muted },
  todayPending: {
    backgroundColor: colors.warningSoft, borderRadius: radii.pill,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.v2,
  },
  todayPendingText: { ...typography.captionSm, color: colors.warning },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.v12, marginBottom: spacing.md },
  // Deux cartes par rangée, qui se partagent toute la largeur. Avec `47.5%`,
  // la grille s'arrêtait quelques pixels avant le bord des cartes voisines.
  statCard: { flexBasis: '40%', flexGrow: 1 },
  // L'icône est posée nue ; ce retrait la détache du chiffre, comme le faisait
  // l'ancienne pastille.
  statIcon: { marginBottom: spacing.sm },
  chartCard: {
    backgroundColor: colors.white, borderRadius: radii.v16, padding: spacing.md, marginBottom: spacing.v20,
    shadowColor: colors.nuit, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  chartHeader: { marginBottom: spacing.v12 },
  chartTitle: { ...typography.pillLabel, color: colors.ink, },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', height: 90, alignItems: 'flex-end' },
  barColumn: { alignItems: 'center', gap: spacing.sm, flex: 1 },
  barTrack: { width: 14, height: 64, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: radii.v4, minHeight: 4 },
  barLabel: { ...typography.captionSm, color: colors.muted, },
  barLabelBest: { color: colors.lave, fontFamily: fonts.sansBold },
  chartFooter: { ...typography.captionSm, color: colors.lave, marginTop: spacing.v12, fontStyle: 'italic', },
  section: { marginBottom: spacing.v20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.v12 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  seeAll: { ...typography.caption, color: colors.lave, },
  // Zone tactile de 44 px ; la marge négative rend le surplus, pour que la
  // ligne du titre garde sa hauteur.
  seeAllZone: { minHeight: cible.min, justifyContent: 'center', marginVertical: -spacing.v12 },
  reviewCard: {
    flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.v12,
    shadowColor: colors.nuit, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  reviewQuoteMark: { fontFamily: fonts.display, fontSize: 30, color: colors.surfaceSunken, lineHeight: 30 },
  reviewComment: { fontFamily: fonts.display, fontSize: 12.5, color: colors.muted, marginBottom: spacing.sm },
  reviewMetaRow: { flexDirection: 'row', marginBottom: spacing.sm },
  replyBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.laveSoft, borderRadius: radii.sm, padding: spacing.sm },
  replyText: { ...typography.captionSm, flex: 1, color: colors.ink, },
  // Champ et bouton font 44 px de haut. Le retrait haut est supprimé et le bas
  // de la ligne mord sur la marge de la carte : celle-ci ne grandit presque pas.
  replyForm: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceSunken, marginBottom: -spacing.sm },
  replyInput: { ...typography.captionSm, flex: 1, color: colors.ink, minHeight: cible.min, },
  replyBtn: { minHeight: cible.min, minWidth: cible.min, alignItems: 'center', justifyContent: 'center' },
  replyBtnText: { ...typography.caption, color: colors.lave, },
  promoTicket: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    backgroundColor: colors.lave, borderRadius: radii.md, padding: spacing.v12, position: 'relative', overflow: 'hidden',
  },
  promoNotchLeft: { position: 'absolute', left: -8, top: '50%', width: 16, height: 16, borderRadius: radii.sm, backgroundColor: colors.cream },
  promoNotchRight: { position: 'absolute', right: -8, top: '50%', width: 16, height: 16, borderRadius: radii.sm, backgroundColor: colors.cream },
  promoLabel: { ...typography.captionSm, color: colors.amber, letterSpacing: 0.5, },
  promoText: { fontFamily: fonts.display, fontSize: 15, color: colors.cream, marginTop: spacing.v2 },
});