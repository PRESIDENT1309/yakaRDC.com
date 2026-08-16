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
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, radii } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import CategoryIcon from '../../components/CategoryIcon';
import EmptyState from '../../components/EmptyState';
import Chip from '../../components/Chip';
import StatusBadge from '../../components/StatusBadge';
import type { Booking, Establishment } from '../../lib/types';

type BookingWithEstablishment = Booking & { establishment: Establishment };
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
    detailLines.push({ label: 'Visite', value: `${booking.visit_date}${booking.visit_time ? ' · ' + booking.visit_time : ''}` });
  }
  if (booking.guests) {
    detailLines.push({ label: 'Personnes', value: `${booking.guests}` });
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
            <Pressable onPress={onClose} hitSlop={8}>
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
                  backgroundColor="#FFFFFF"
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
    ? `${item.visit_date}${item.visit_time ? ' · ' + item.visit_time : ''}`
    : '—';

  const guestLabel = item.guests ? `· ${item.guests} pers.` : '';

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
          <Text style={styles.cardMeta}>
            {cat?.label ?? 'Établissement'} {guestLabel}
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
              <QrCode size={13} color="#FAF8F4" />
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
          <Text style={styles.cardFooterNote}>Annulée par vous</Text>
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
    if (!session?.user) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, establishment:establishments(*)')
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
            contentContainerStyle={{ gap: 6 }}
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
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            icon={<CalendarCheck size={44} color={colors.borderStrong} />}
            title="Aucune réservation"
            description={filter === 'all'
              ? 'Vous n\'avez pas encore fait de demande de réservation.'
              : 'Aucune réservation dans cette catégorie.'}
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
    backgroundColor: '#FAF8F4',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInner: { gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '500', color: colors.ink },
  list: { padding: 14, gap: 10, paddingBottom: 100 },
  // Tablette/desktop uniquement : la colonne unique passe en grille 2
  // colonnes (voir cardWidth dans BookingsScreen).
  listGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Le centrage seul : icône/titre/description/espacement viennent
  // maintenant de EmptyState lui-même.
  empty: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPast: { opacity: 0.7 },
  cardTop: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },
  cardName: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.ink },
  cardMeta: { fontSize: 11, color: colors.muted },
  cardDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F4F0',
  },
  cardCode: { fontSize: 11, color: colors.muted },
  cardCodeValue: { fontWeight: '500', color: colors.ink, letterSpacing: 0.5 },
  cardFooterNote: { fontSize: 11, color: colors.muted },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  actionBtnText: { fontSize: 11, color: '#FAF8F4', fontWeight: '500' },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cancelBtnText: { fontSize: 11, color: '#C0392B' },
  ticketOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  ticketSheet: {
    backgroundColor: '#FAF8F4',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  ticketHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.borderStrong,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    marginHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  ticketType: { fontSize: 11, color: 'rgba(250,248,244,0.7)', marginBottom: 3 },
  ticketName: { fontSize: 17, fontWeight: '500', color: '#FAF8F4' },
  ticketBody: { paddingHorizontal: 20 },
  ticketQrPlaceholder: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  qrWrapper: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.nuit,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  ticketQrNote: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  ticketCode: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 3,
    color: colors.ink,
    marginBottom: 16,
  },
  ticketDivider: {
    position: 'relative',
    marginBottom: 14,
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
    borderRadius: 8,
    backgroundColor: colors.cream,
  },
  ticketDividerLeft: { left: -20 },
  ticketDividerRight: { right: -20 },
  ticketDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F4F0',
  },
  ticketDetailLabel: { fontSize: 13, color: colors.muted },
  ticketDetailValue: { fontSize: 13, fontWeight: '500', color: colors.ink },
  ticketFooter: {
    marginTop: 16,
    padding: 10,
    backgroundColor: '#F5F4F0',
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  ticketFooterText: { fontSize: 11, color: colors.muted, textAlign: 'center' },
});