import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, ActivityIndicator, TextInput, } from 'react-native';
import { Alert } from '../../lib/alert';
import { router } from 'expo-router';
import {
  CalendarCheck, Users, Wallet, Star, Bell,
  MessageCircle, Tag,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { bookingTotal } from '../../lib/offers';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';
import type { Establishment, Booking, Review } from '../../lib/types';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function StatCard({ icon, value, label, sub, bg }:
  { icon: React.ReactNode; value: string; label: string; sub: string; bg: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <View style={styles.statIconBadge}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

export default function PartnerDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [todayCount, setTodayCount] = useState(0);
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

    const [{ data: bookings }, { data: reviews }] = await Promise.all([
      // Les lignes portent le prix gelé : le chiffre d'affaires se calcule
      // dessus, jamais sur le tarif courant de l'établissement — sinon une
      // hausse de prix réécrirait rétroactivement les recettes passées.
      supabase.from('bookings').select('*, booking_items(quantity, unit_price)')
        .eq('establishment_id', e.id)
        .gte('created_at', weekAgoIso),
      supabase.from('reviews').select('*').eq('establishment_id', e.id)
        .order('created_at', { ascending: false }),
    ]);

    const allBookings = (bookings as Booking[]) ?? [];
    const todays = allBookings.filter(b => b.created_at.slice(0, 10) === todayIso);
    setTodayCount(todays.length);

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
  const bestDayIdx = weekCounts.some(c => c > 0)
    ? weekCounts.indexOf(Math.max(...weekCounts))
    : null;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>

        {/* En-tête */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandName}>{establishment.name}</Text>
            <Text style={styles.headerSub}>Bonjour, voici votre activité 👋</Text>
          </View>
          <Pressable style={styles.bellBtn} onPress={() => Alert.alert('Notifications', 'Bientôt disponible.')}>
            <Bell size={16} color={colors.lave} />
          </Pressable>
        </View>

        {/* 4 cartes couleur pleine */}
        <View style={styles.statsGrid}>
          <StatCard
            icon={<CalendarCheck size={16} color="#FFF" />}
            value={String(todayCount)}
            label="Réservations"
            sub="aujourd'hui"
            bg="#712B13"
          />
          <StatCard
            icon={<Users size={16} color="#FFF" />}
            value={String(establishment.view_count)}
            label="Visiteurs"
            sub="de la fiche"
            bg="#1F4D3A"
          />
          <StatCard
            icon={<Wallet size={16} color="#FFF" />}
            value={`${revenue.toFixed(0)} $`}
            label="Généré"
            sub="réservations confirmées"
            bg="#854F0B"
          />
          <StatCard
            icon={<Star size={16} color="#FFF" />}
            value={avgRating != null ? avgRating.toFixed(1) : '—'}
            label="Note moyenne"
            sub={`${reviewCount} avis`}
            bg="#085041"
          />
        </View>

        {/* Graphique réservations de la semaine */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Réservations cette semaine</Text>
          </View>
          <View style={styles.chartBars}>
            {weekCounts.map((count, i) => (
              <View key={i} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View style={[
                    styles.barFill,
                    {
                      height: `${(count / maxCount) * 100}%`,
                      backgroundColor: i === bestDayIdx ? colors.lave : '#F0E4D0',
                    },
                  ]} />
                </View>
                <Text style={[styles.barLabel, i === bestDayIdx && { color: colors.lave, fontWeight: '700' }]}>
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
            <Text style={styles.sectionTitle}>Avis récents</Text>
            {reviewCount > 2 && (
              <Pressable onPress={() => router.push('/pro/reviews')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </Pressable>
            )}
          </View>

          {recentReviews.length === 0 ? (
            <Text style={styles.emptyText}>Aucun avis pour le moment.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {recentReviews.map(r => (
                <View key={r.id} style={styles.reviewCard}>
                  <Text style={styles.reviewQuoteMark}>"</Text>
                  <View style={{ flex: 1 }}>
                    {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                    <View style={styles.reviewMetaRow}>
                      <View style={{ flexDirection: 'row', gap: 1 }}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={10} color="#854F0B" fill={i <= r.rating ? '#854F0B' : 'transparent'} />
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
                        />
                        <Pressable
                          onPress={() => handleReply(r.id)}
                          disabled={!replyDraft[r.id]?.trim() || replying === r.id}
                        >
                          <Text style={[styles.replyBtnText, !replyDraft[r.id]?.trim() && { opacity: 0.4 }]}>
                            {replying === r.id ? '...' : 'Envoyer'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Promotion active */}
        {establishment.discount_percent != null && (
          <View style={styles.promoTicket}>
            <View style={styles.promoNotchLeft} />
            <View style={styles.promoNotchRight} />
            <Tag size={14} color="#FAC775" />
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
  screen: { flex: 1, backgroundColor: '#F5F4EF' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F4EF' },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 18, paddingTop: Platform.OS === 'ios' ? 46 : 6,
  },
  brandName: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 21, color: colors.ink },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 3 },
  bellBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '47.5%', borderRadius: 16, padding: 14, gap: 3 },
  statIconBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  statValue: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 24, color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  statSub: { fontSize: 9, color: 'rgba(255,255,255,0.6)' },
  chartCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  chartHeader: { marginBottom: 14 },
  chartTitle: { fontSize: 13, fontWeight: '600', color: colors.ink },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', height: 90, alignItems: 'flex-end' },
  barColumn: { alignItems: 'center', gap: 6, flex: 1 },
  barTrack: { width: 14, height: 64, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 9.5, color: colors.muted },
  chartFooter: { fontSize: 10.5, color: colors.lave, marginTop: 12, fontStyle: 'italic' },
  section: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 16, color: colors.ink },
  seeAll: { fontSize: 11, color: colors.lave, fontWeight: '600' },
  reviewCard: {
    flexDirection: 'row', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  reviewQuoteMark: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 30, color: '#F0E4D0', lineHeight: 30 },
  reviewComment: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 12.5, color: '#5F5E5A', marginBottom: 6 },
  reviewMetaRow: { flexDirection: 'row', marginBottom: 8 },
  replyBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.laveSoft, borderRadius: 8, padding: 8 },
  replyText: { flex: 1, fontSize: 11, color: colors.ink },
  replyForm: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#F0EEE4', paddingTop: 8 },
  replyInput: { flex: 1, fontSize: 11.5, color: colors.ink, paddingVertical: 4 },
  replyBtnText: { fontSize: 11, color: colors.lave, fontWeight: '600' },
  promoTicket: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.lave, borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden',
  },
  promoNotchLeft: { position: 'absolute', left: -8, top: '50%', width: 16, height: 16, borderRadius: 8, backgroundColor: '#F5F4EF' },
  promoNotchRight: { position: 'absolute', right: -8, top: '50%', width: 16, height: 16, borderRadius: 8, backgroundColor: '#F5F4EF' },
  promoLabel: { fontSize: 8.5, color: '#FAC775', letterSpacing: 0.5 },
  promoText: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 15, color: '#FAF8F4', marginTop: 2 },
});