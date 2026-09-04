import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, RefreshControl, ActivityIndicator, } from 'react-native';
import { Alert } from '../../lib/alert';
import { useConfirm } from '../../lib/confirm-context';
import { router } from 'expo-router';
import { Building2, Home, UtensilsCrossed, Mountain, Phone, CalendarCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';
import { bookingItemsSummary } from '../../lib/offers';
import { timeToSlot } from '../../lib/slots';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, typography, breakpoints } from '../../lib/theme';
import type { Booking, Establishment, EstablishmentType } from '../../lib/types';

type BookingWithEstablishment = Booking & { establishment: Establishment };
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'past';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'past', label: 'Passées' },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: 'En attente', bg: colors.warningSoft, color: colors.warning },
  confirmed:  { label: 'Confirmée',  bg: colors.successSoft, color: colors.success },
  checked_in: { label: 'Utilisée',   bg: colors.fleuveSoft, color: colors.fleuveDark },
  rejected:   { label: 'Refusée',    bg: colors.dangerSoft, color: colors.danger },
  // `faint` sur `surfaceSunken` ne donne que 4,30 : c'est la seule paire du
  // tableau qui n'atteint pas AA. `muted` est le gris prevu pour ce fond.
  cancelled:  { label: 'Annulée',    bg: colors.surfaceSunken, color: colors.muted },
};

function TypeIcon({ type }: { type: EstablishmentType }) {
  const cat = categoryColors[type];
  const props = { size: 16, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

export default function PartnerBookingsScreen() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const [bookings, setBookings] = useState<BookingWithEstablishment[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (!profile?.id) return;
    const { data: estabs } = await supabase
      .from('establishments')
      .select('id')
      .eq('owner_id', profile.id);

    const ids = (estabs ?? []).map((e: any) => e.id);
    if (ids.length === 0) { setLoading(false); setRefreshing(false); return; }

    const { data } = await supabase
      .from('bookings')
      .select(`*, establishment:establishments(*),
        booking_items(quantity, unit_price, currency,
          establishment_offers(custom_label, offer_categories(label)))`)
      .in('establishment_id', ids)
      .order('created_at', { ascending: false });

    setBookings((data as BookingWithEstablishment[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function handleConfirm(id: string) {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
    fetchBookings();
  }

  async function handleReject(id: string) {
    const ok = await confirm({
      title: 'Refuser cette demande',
      message: 'Le voyageur sera informé du refus. Cette décision est définitive.',
      confirmLabel: 'Refuser',
      destructive: true,
    });
    if (!ok) return;
    await supabase.from('bookings').update({ status: 'rejected' }).eq('id', id);
    fetchBookings();
  }

  const filtered = bookings.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'pending') return b.status === 'pending';
    if (filter === 'confirmed') return b.status === 'confirmed';
    if (filter === 'past') return ['checked_in', 'cancelled', 'rejected'].includes(b.status);
    return true;
  });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
        <Text style={styles.headerTitle}>Réservations</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {FILTERS.map(f => (
            <Pressable key={f.key} style={[styles.pill, filter === f.key && styles.pillActive]}
              onPress={() => setFilter(f.key)}>
              <Text style={[styles.pillText, filter === f.key && styles.pillTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.count}>{filtered.length} réservation{filtered.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.lave} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchBookings(); }} tintColor={colors.lave} />
          }
        >
          {filtered.length === 0 ? (
            /* Un partenaire ne peut pas créer de réservation : la seule chose
               qu'il puisse faire pour en obtenir, c'est compléter sa fiche.
               C'est donc là que mène l'action, plutôt que nulle part. */
            <EmptyState
              icon={<CalendarCheck size={44} color={colors.borderStrong} strokeWidth={1.75} />}
              title="Aucune réservation"
              description="Les demandes de vos clients apparaîtront ici, avec leur statut."
              actionLabel="Compléter ma fiche"
              onAction={() => router.push('/pro/establishment')}
            />
          ) : (
            filtered.map(b => {
              const status = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
              const cat = categoryColors[b.establishment?.type];
              const soft = cat?.soft ?? colors.laveSoft;
              return (
                <View key={b.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.cardIcon, { backgroundColor: soft }]}>
                      <TypeIcon type={b.establishment?.type} />
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName}>
                          {(b as any).first_name && (b as any).last_name
                            ? `${(b as any).first_name} ${(b as any).last_name}`
                            : 'Client'}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardEstab}>{b.establishment?.name}</Text>
                      <Text style={styles.cardDate}>
                        {b.check_in && b.check_out ? `${b.check_in} → ${b.check_out}` :
                         b.visit_date ? `${b.visit_date}${b.visit_time ? ' · ' + timeToSlot(b.visit_time) : ''}` : '—'}
                        {b.guests ? ` · ${b.guests} pers.` : ''}
                      </Text>
                      {/* Ce qui a été réservé : sans cette ligne, le partenaire
                          ignore quelle chambre ou quels billets préparer. */}
                      {((b as any).booking_items ?? []).length > 0 && (
                        <Text style={styles.cardOffer} numberOfLines={2}>
                          {bookingItemsSummary((b as any).booking_items)}
                        </Text>
                      )}
                      {(b as any).contact_phone && (
                        <View style={styles.phoneRow}>
                          <Phone size={10} color={colors.faint} />
                          <Text style={styles.phoneText}>{(b as any).contact_phone}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {b.status === 'pending' && (
                    <View style={styles.cardActions}>
                      <Pressable style={styles.confirmBtn} onPress={() => handleConfirm(b.id)}>
                        <Text style={styles.confirmBtnText}>✓ Confirmer</Text>
                      </Pressable>
                      <Pressable style={styles.rejectBtn} onPress={() => handleReject(b.id)}>
                        <Text style={styles.rejectBtnText}>✕ Refuser</Text>
                      </Pressable>
                    </View>
                  )}

                  {b.status === 'confirmed' && b.unique_code && (
                    <View style={styles.codeRow}>
                      <Text style={styles.codeLabel}>Code client :</Text>
                      <Text style={styles.codeValue}>{b.unique_code}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.cream, paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerInner: {
    maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center',
    paddingHorizontal: 18, gap: 10,
  },
  headerTitle: { ...typography.titleLg, color: colors.ink, },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  pillActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  pillText: { ...typography.bodyXs, color: colors.muted, },
  pillTextActive: { color: colors.cream, fontWeight: '500' },
  count: { ...typography.captionSm, color: colors.faint, },
  list: { maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center', padding: 14, gap: 10, paddingBottom: 100 },
  card: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', gap: 10, padding: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  cardName: { ...typography.pillLabel, color: colors.ink, flex: 1, marginRight: 6, },
  cardEstab: { ...typography.captionMd, color: colors.lave, marginBottom: 2, },
  cardDate: { ...typography.captionSm, color: colors.muted, },
  cardOffer: { ...typography.captionMd, color: colors.ink, marginTop: 2, },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  phoneText: { ...typography.captionSm, color: colors.muted, },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  statusText: { ...typography.captionMd, },
  cardActions: { flexDirection: 'row', gap: 8, padding: 10, paddingTop: 0 },
  confirmBtn: { flex: 1, backgroundColor: colors.success, borderRadius: 8, padding: 8, alignItems: 'center' },
  confirmBtnText: { ...typography.caption, color: colors.cream, },
  rejectBtn: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 8, alignItems: 'center' },
  rejectBtnText: { ...typography.bodyXs, color: colors.danger, },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, paddingTop: 0 },
  codeLabel: { ...typography.captionSm, color: colors.muted, },
  codeValue: { ...typography.caption, color: colors.ink, letterSpacing: 1, },
});