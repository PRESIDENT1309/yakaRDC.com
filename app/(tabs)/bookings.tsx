import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  QrCode,
  X,
  CalendarCheck,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { bookingItemLabel, bookingItemsSummary, bookingTotal } from '../../lib/offers';
import { timeToSlot } from '../../lib/slots';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, radii, typography, spacing } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import CategoryIcon from '../../components/CategoryIcon';
import EmptyState from '../../components/EmptyState';
import Chip from '../../components/Chip';
import StatusBadge from '../../components/StatusBadge';
import type { Booking, Establishment } from '../../lib/types';

// Ligne de réservation telle que renvoyée par la requête : l'offre et sa
// catégorie sont embarquées pour afficher un nom lisible sans second appel.
type BookingItemRow = {
  quantity: number;
  unit_price: number;
  currency: string;
  establishment_offers: {
    custom_label: string | null;
    offer_categories: { label: string } | null;
  } | null;
};

type BookingWithEstablishment = Booking & {
  establishment: Establishment;
  booking_items: BookingItemRow[];
};

// Le total reste « estimé » : rien n'est payé en ligne et le partenaire peut
// encore refuser la demande.
const itemsTotal = (b: BookingWithEstablishment) =>
  bookingTotal(b.booking_items, b.check_in, b.check_out);
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'past';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'past', label: 'Passées' },
];

function TicketModal({
  booking,
  onClose,
}: {
  booking: BookingWithEstablishment | null;
  onClose: () => void;
}) {
  if (!booking) return null;
  const cat = categoryColors[booking.establishment.type];
  const accent = cat?.accent ?? colors.lave;

  const detailLines: { label: string; value: string }[] = [];
  if (booking.check_in && booking.check_out) {
    detailLines.push({ label: 'Arrivée', value: booking.check_in });
    detailLines.push({ label: 'Départ', value: booking.check_out });
  }
  if (booking.visit_date) {
    detailLines.push({ label: 'Visite', value: `${booking.visit_date}${booking.visit_time ? ' · ' + timeToSlot(booking.visit_time) : ''}` });
  }
  if (booking.guests) {
    detailLines.push({ label: 'Personnes', value: `${booking.guests}` });
  }
  // Ce qui a réellement été réservé — un ticket qui ne dit pas quelle chambre
  // ni quels billets ne sert à rien au moment du check-in.
  (booking.booking_items ?? []).forEach(i => {
    detailLines.push({
      label: bookingItemLabel(i),
      value: i.quantity > 1 ? `× ${i.quantity}` : '1',
    });
  });
  const ticketTotal = itemsTotal(booking);
  if (ticketTotal) {
    detailLines.push({
      label: 'Total estimé',
      value: `${ticketTotal.amount} ${ticketTotal.currency}`,
    });
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.ticketOverlay}>
        <View style={styles.ticketSheet}>
          <View style={styles.ticketHandle} />

          <View style={[styles.ticketHeader, { backgroundColor: accent }]}>
            <View>
              <Text style={styles.ticketType}>{cat?.label ?? 'Établissement'}</Text>
              <Text style={styles.ticketName}>{booking.establishment.name}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer le billet" onPress={onClose} hitSlop={8}>
              <X size={20} color="rgba(250,248,244,0.8)" />
            </Pressable>
          </View>

          <View style={styles.ticketBody}>
            <View style={styles.ticketQrPlaceholder}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={booking.qr_token}
                  size={140}
                  color={colors.ink}
                  backgroundColor={colors.white}
                />
              </View>
              <Text style={styles.ticketQrNote}>
                Présentez ce code à la réception
              </Text>
            </View>

            <Text style={styles.ticketCode}>
              {booking.unique_code ?? '—'}
            </Text>

            <View style={styles.ticketDivider}>
              <View style={styles.ticketDividerLine} />
              <View style={[styles.ticketDividerCircle, styles.ticketDividerLeft]} />
              <View style={[styles.ticketDividerCircle, styles.ticketDividerRight]} />
            </View>

            {detailLines.map((d) => (
              <View key={d.label} style={styles.ticketDetail}>
                <Text style={styles.ticketDetailLabel}>{d.label}</Text>
                <Text style={styles.ticketDetailValue}>{d.value}</Text>
              </View>
            ))}

            <View style={styles.ticketFooter}>
              <Text style={styles.ticketFooterText}>
                Code à usage unique — invalide après le premier scan
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BookingCard({
  item,
  onTicket,
  onCancel,
}: {
  item: BookingWithEstablishment;
  onTicket: () => void;
  onCancel: () => void;
}) {
  const cat = categoryColors[item.establishment.type];
  const soft = cat?.soft ?? colors.laveSoft;
  const accent = cat?.accent ?? colors.lave;
  const isPast = item.status === 'checked_in' || item.status === 'cancelled' || item.status === 'rejected';

  const dateLabel = item.check_in && item.check_out
    ? `${item.check_in} – ${item.check_out}`
    : item.visit_date
    ? `${item.visit_date}${item.visit_time ? ' · ' + timeToSlot(item.visit_time) : ''}`
    : '—';

  const guestLabel = item.guests ? `· ${item.guests} pers.` : '';

  // Ce qui a été réservé, condensé sur une ligne : « Suite Fleuve Congo » ou
  // « Adulte × 2 · Enfant × 1 ». Vide si la réservation n'a aucune ligne
  // (réservations d'avant le catalogue d'offres).
  const offerSummary = bookingItemsSummary(item.booking_items);

  return (
    <View style={[styles.card, isPast && styles.cardPast]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: soft }]}>
          <CategoryIcon type={item.establishment.type} size={20} color={accent} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.establishment.name}
            </Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {offerSummary || (cat?.label ?? 'Établissement')} {guestLabel}
          </Text>
          <Text style={styles.cardDate}>{dateLabel}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        {item.status === 'confirmed' && item.unique_code ? (
          <>
            <Text style={styles.cardCode}>
              Code : <Text style={styles.cardCodeValue}>{item.unique_code}</Text>
            </Text>
            <Pressable style={[styles.actionBtn, { backgroundColor: accent }]} onPress={onTicket}>
              <QrCode size={13} color={colors.cream} />
              <Text style={styles.actionBtnText}>Mon ticket</Text>
            </Pressable>
          </>
        ) : item.status === 'pending' ? (
          <>
            <Text style={styles.cardFooterNote}>Confirmation sous 24h</Text>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </Pressable>
          </>
        ) : item.status === 'checked_in' ? (
          <Text style={styles.cardFooterNote}>Terminée</Text>
        ) : item.status === 'rejected' ? (
          <Text style={[styles.cardFooterNote, { color: colors.danger }]}>
            Demande refusée par l'établissement
          </Text>
        ) : item.status === 'cancelled' ? (
          // Une annulation peut venir du partenaire (offre retirée) : affirmer
          // « par vous » serait faux, et le voyageur resterait sans explication.
          <Text style={styles.cardFooterNote}>
            {item.cancellation_reason ?? 'Annulée par vous'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function BookingsScreen() {
  const { session } = useAuth();
  const { isWide, contentWidth } = useResponsive();
  // Grille 2 colonnes dès la tablette (contrairement à la Fiche établissement,
  // BookingCard est une carte courte : une grille lui va mieux qu'une colonne
  // unique étirée). `wide` centre le contenu dans contentMax, comme Recherche.
  const wide = { maxWidth: contentWidth, width: '100%' as const, alignSelf: 'center' as const };
  const cardWidth = isWide ? (contentWidth - 14 * 2 - 10) / 2 : undefined;
  const [bookings, setBookings] = useState<BookingWithEstablishment[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<BookingWithEstablishment | null>(null);

  const fetchBookings = useCallback(async () => {
    // Voir favorites.tsx : sans session, la sortie précédait `setLoading(false)`
    // et l'onglet restait bloqué sur un disque qui tournait sans fin.
    if (!session?.user) { setBookings([]); setLoading(false); return; }
    const { data } = await supabase
      .from('bookings')
      .select(`*, establishment:establishments(*),
        booking_items(quantity, unit_price, currency,
          establishment_offers(custom_label, offer_categories(label)))`)
      .eq('traveler_id', session.user.id)
      .order('created_at', { ascending: false });
    setBookings((data as BookingWithEstablishment[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  async function handleCancel(bookingId: string) {
    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);
    fetchBookings();
  }

  const filtered = bookings.filter((b) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return b.status === 'pending';
    if (filter === 'confirmed') return b.status === 'confirmed';
    if (filter === 'past') return ['checked_in', 'cancelled', 'rejected'].includes(b.status);
    return true;
  });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={[styles.headerInner, isWide && wide]}>
          <Text style={styles.headerTitle}>Mes réservations</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {STATUS_FILTERS.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.lave} />
        </View>
      ) : !session?.user ? (
        <View style={styles.empty}>
          <EmptyState
            icon={<CalendarCheck size={44} color={colors.borderStrong} />}
            title="Vos réservations"
            description="Connectez-vous pour suivre vos demandes et présenter vos billets."
            actionLabel="Se connecter"
            onAction={() => router.push({
              pathname: '/(auth)/login',
              params: { redirect: '/(tabs)/bookings', reason: 'Connectez-vous pour voir vos réservations.' },
            })}
          />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          {/* Deux vides très différents sous une même apparence : un compte
              neuf, et un filtre qui masque tout. Le second ne doit pas
              renvoyer l'utilisateur au catalogue — il doit lui rendre ses
              réservations, qui sont là. */}
          <EmptyState
            icon={<CalendarCheck size={44} color={colors.borderStrong} />}
            title={filter === 'all' ? 'Aucune réservation' : 'Rien dans cette catégorie'}
            description={filter === 'all'
              ? "Vos demandes de réservation apparaîtront ici, avec leur statut."
              : 'Vous avez des réservations, mais aucune avec ce statut.'}
            actionLabel={filter === 'all' ? 'Explorer les établissements' : 'Voir toutes les réservations'}
            onAction={filter === 'all'
              ? () => router.push('/(tabs)/search')
              : () => setFilter('all')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, isWide && wide, isWide && styles.listGrid]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchBookings(); }}
              tintColor={colors.lave}
            />
          }
        >
          {filtered.map((item) => (
            <View key={item.id} style={isWide ? { width: cardWidth } : undefined}>
              <BookingCard
                item={item}
                onTicket={() => setSelectedTicket(item)}
                onCancel={() => handleCancel(item.id)}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <TicketModal
        booking={selectedTicket}
        onClose={() => setSelectedTicket(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.cream,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingHorizontal: 18,
    paddingBottom: spacing.v12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInner: { gap: spacing.v12 },
  headerTitle: { ...typography.titleLg, color: colors.ink, },
  list: { padding: spacing.v12, gap: spacing.v12, paddingBottom: 100 },
  // Tablette/desktop uniquement : la colonne unique passe en grille 2
  // colonnes (voir cardWidth dans BookingsScreen).
  listGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Le centrage seul : icône/titre/description/espacement viennent
  // maintenant de EmptyState lui-même.
  empty: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPast: { opacity: 0.7 },
  cardTop: {
    flexDirection: 'row',
    gap: spacing.v12,
    padding: spacing.v12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.v2,
  },
  cardName: { ...typography.pillLabel, flex: 1, color: colors.ink, },
  cardMeta: { ...typography.captionSm, color: colors.muted, },
  cardDate: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.v12,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSunken,
  },
  cardCode: { ...typography.captionSm, color: colors.muted, },
  cardCodeValue: { fontWeight: '500', color: colors.ink, letterSpacing: 0.5 },
  cardFooterNote: { ...typography.captionSm, color: colors.muted, },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.v12,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  actionBtnText: { ...typography.captionMd, color: colors.cream, },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.v12,
    paddingVertical: spacing.xs,
  },
  cancelBtnText: { ...typography.captionSm, color: colors.danger, },
  ticketOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  ticketSheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  ticketHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.borderStrong,
    borderRadius: radii.v4,
    alignSelf: 'center',
    marginTop: spacing.v12,
    marginBottom: spacing.md,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    marginHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  ticketType: { ...typography.captionSm, color: 'rgba(250,248,244,0.7)', marginBottom: spacing.v2, },
  ticketName: { ...typography.titleSm, color: colors.cream, },
  ticketBody: { paddingHorizontal: spacing.v20 },
  ticketQrPlaceholder: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  qrWrapper: {
    padding: spacing.v12,
    backgroundColor: colors.white,
    borderRadius: radii.v16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.nuit,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  ticketQrNote: { ...typography.bodyXs, color: colors.muted, textAlign: 'center', },
  ticketCode: { ...typography.titleLg, textAlign: 'center',
    letterSpacing: 3,
    color: colors.ink,
    marginBottom: spacing.md, },
  ticketDivider: {
    position: 'relative',
    marginBottom: spacing.v12,
  },
  ticketDividerLine: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ticketDividerCircle: {
    position: 'absolute',
    top: -8,
    width: 16,
    height: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
  },
  ticketDividerLeft: { left: -20 },
  ticketDividerRight: { right: -20 },
  ticketDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  ticketDetailLabel: { ...typography.bodySm, color: colors.muted, },
  ticketDetailValue: { ...typography.pillLabel, color: colors.ink, },
  ticketFooter: {
    marginTop: spacing.md,
    padding: spacing.v12,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  ticketFooterText: { ...typography.captionSm, color: colors.muted, textAlign: 'center', },
});