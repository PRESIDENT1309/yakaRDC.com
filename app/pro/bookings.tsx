import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  RefreshControl, ActivityIndicator, } from 'react-native';
import { Alert } from '../../lib/alert';
import { useConfirm } from '../../lib/confirm-context';
import { router } from 'expo-router';
import { Building2, Home, UtensilsCrossed, Mountain, Phone, CalendarCheck, Check, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import { bookingItemsSummary } from '../../lib/offers';
import { timeToSlot } from '../../lib/slots';
import { useAuth } from '../../lib/auth-context';
import { useZonesSures } from '../../lib/zones';
import { colors, fonts, categoryColors, typography, breakpoints, radii, spacing, cible } from '../../lib/theme';
import type { Booking, Establishment, EstablishmentType } from '../../lib/types';

type BookingWithEstablishment = Booking & { establishment: Establishment };
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'past';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'past', label: 'Passées' },
];

function TypeIcon({ type }: { type: EstablishmentType }) {
  const cat = categoryColors[type];
  const props = { size: 18, color: cat?.accent ?? colors.lave };
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
  const { haut } = useZonesSures();
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
      <View style={[styles.header, { paddingTop: haut }]}>
        <View style={styles.headerInner}>
        <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Réservations</Text>
        <View style={styles.filters} accessibilityRole="tablist">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {FILTERS.map(f => {
              const actif = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  style={styles.pillZone}
                  accessibilityRole="tab"
                  aria-selected={actif}
                  onPress={() => setFilter(f.key)}
                >
                  <View style={[styles.pill, actif && styles.pillActive]}>
                    <Text style={[styles.pillText, actif && styles.pillTextActive]}>{f.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        {/* Annoncé à chaque changement de filtre : sans cela, rien ne dit à
            l'oreille que la liste vient de changer. */}
        <Text style={styles.count} accessibilityLiveRegion="polite">
          {filtered.length} réservation{filtered.length !== 1 ? 's' : ''}
        </Text>
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
              const client = (b as any).first_name && (b as any).last_name
                ? `${(b as any).first_name} ${(b as any).last_name}`
                : 'Client';
              return (
                <View key={b.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardIcon}>
                      <TypeIcon type={b.establishment?.type} />
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName}>{client}</Text>
                        <StatusBadge status={b.status} />
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
                      {/* Le nom du client entre dans le libellé lu : dans une
                          liste, dix boutons « Confirmer » ne se distinguent pas. */}
                      <Pressable
                        style={styles.confirmBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Confirmer la réservation de ${client}`}
                        onPress={() => handleConfirm(b.id)}
                      >
                        <Check size={14} color={colors.cream} strokeWidth={2.5} />
                        <Text style={styles.confirmBtnText}>Confirmer</Text>
                      </Pressable>
                      <Pressable
                        style={styles.rejectBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Refuser la réservation de ${client}`}
                        onPress={() => handleReject(b.id)}
                      >
                        <X size={14} color={colors.danger} strokeWidth={2.5} />
                        <Text style={styles.rejectBtnText}>Refuser</Text>
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
  // Le retrait haut est ajouté à l'appel : il dépend de l'appareil (zone sûre).
  header: {
    backgroundColor: colors.cream,
    paddingBottom: spacing.v12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerInner: {
    maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center',
    paddingHorizontal: spacing.gutter, gap: spacing.v12,
  },
  headerTitle: { ...typography.titleLg, color: colors.ink, },
  // Chaque filtre reçoit le doigt sur 44 px de haut, mais la pastille dessinée
  // garde sa taille. La marge négative de la rangée rend le surplus : l'en-tête
  // ne grandit pas.
  filters: { marginVertical: -spacing.xs },
  pillZone: { minHeight: cible.min, minWidth: cible.min, justifyContent: 'center' },
  pill: { paddingHorizontal: spacing.v12, paddingVertical: spacing.sm, borderRadius: radii.pill,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  pillActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  pillText: { ...typography.bodyXs, color: colors.muted, },
  pillTextActive: { color: colors.cream, fontFamily: fonts.sansMedium },
  count: { ...typography.captionSm, color: colors.faint, },
  list: { maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center', padding: spacing.v12, gap: spacing.v12, paddingBottom: 100 },
  card: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', gap: spacing.v12, padding: spacing.v12 },
  // Icône nue, calée sur la première ligne du nom.
  cardIcon: { flexShrink: 0 },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.v2 },
  cardName: { ...typography.pillLabel, color: colors.ink, flex: 1, marginRight: spacing.sm, },
  cardEstab: { ...typography.captionMd, color: colors.lave, marginBottom: spacing.v2, },
  cardDate: { ...typography.captionSm, color: colors.muted, },
  cardOffer: { ...typography.captionMd, color: colors.ink, marginTop: spacing.v2, },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.v2 },
  phoneText: { ...typography.captionSm, color: colors.muted, },
  cardActions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.v12, paddingTop: 0 },
  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    minHeight: cible.min, backgroundColor: colors.success, borderRadius: radii.sm, padding: spacing.sm,
  },
  confirmBtnText: { ...typography.caption, color: colors.cream, },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    minHeight: cible.min, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radii.sm, padding: spacing.sm,
  },
  rejectBtnText: { ...typography.bodyXs, color: colors.danger, },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.v12, paddingTop: 0 },
  codeLabel: { ...typography.captionSm, color: colors.muted, },
  codeValue: { ...typography.caption, color: colors.ink, letterSpacing: 1, },
});