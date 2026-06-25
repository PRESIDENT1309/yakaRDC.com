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
  Building2,
  Home,
  UtensilsCrossed,
  Mountain,
  QrCode,
  X,
  CalendarCheck,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors } from '../../lib/theme';
import type { Booking, Establishment, EstablishmentType } from '../../lib/types';

type BookingWithEstablishment = Booking & { establishment: Establishment };
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'past';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'past', label: 'Passées' },
];

function CategoryIcon({ type }: { type: EstablishmentType }) {
  const cat = categoryColors[type];
  const props = { size: 20, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const config = {
    pending: { label: 'En attente', bg: '#FFF8E6', color: '#854F0B' },
    confirmed: { label: 'Confirmée', bg: '#DCEEE3', color: '#1F4D3A' },
    checked_in: { label: 'Utilisée', bg: '#E1F5EE', color: '#085041' },
    rejected: { label: 'Refusée', bg: '#FFF0F0', color: '#C0392B' },
    cancelled: { label: 'Annulée', bg: '#F5F4F0', color: '#888780' },
  };
  const c = config[status] ?? config.pending;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

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
              <QrCode size={80} color={accent} />
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
  const soft = cat?.soft ?? '#FAECE7';
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
          <CategoryIcon type={item.establishment.type} />
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
          <Text style={[styles.cardFooterNote, { color: '#C0392B' }]}>
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
        <Text style={styles.headerTitle}>Mes réservations</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {STATUS_FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[
                styles.filterPillText,
                filter === f.key && styles.filterPillTextActive,
              ]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.lave} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <CalendarCheck size={44} color={colors.borderStrong} />
          <Text style={styles.emptyTitle}>Aucune réservation</Text>
          <Text style={styles.emptyText}>
            {filter === 'all'
              ? 'Vous n\'avez pas encore fait de demande de réservation.'
              : 'Aucune réservation dans cette catégorie.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
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
            <BookingCard
              key={item.id}
              item={item}
              onTicket={() => setSelectedTicket(item)}
              onCancel={() => handleCancel(item.id)}
            />
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
    gap: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '500', color: colors.ink },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  filterPillActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  filterPillText: { fontSize: 12, color: colors.muted },
  filterPillTextActive: { color: '#FAF8F4', fontWeight: '500' },
  list: { padding: 14, gap: 10, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: colors.ink },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
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
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '500' },
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
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 11, color: '#FAF8F4', fontWeight: '500' },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
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
    borderRadius: 8,
    alignItems: 'center',
  },
  ticketFooterText: { fontSize: 11, color: colors.muted, textAlign: 'center' },
});