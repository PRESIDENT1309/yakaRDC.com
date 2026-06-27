import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Building2, CheckCircle, QrCode, LogOut, ChevronRight, CalendarCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';
import type { Booking, Establishment } from '../../lib/types';

type BookingWithEstablishment = Booking & { establishment: Establishment };

interface Stats {
  pending: number;
  confirmed: number;
  total: number;
  checkedIn: number;
}

export default function PartnerDashboard() {
  const { profile } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [pendingBookings, setPendingBookings] = useState<BookingWithEstablishment[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, confirmed: 0, total: 0, checkedIn: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;

    const { data: estabs } = await supabase
      .from('establishments')
      .select('*')
      .eq('owner_id', profile.id);

    setEstablishments((estabs as Establishment[]) ?? []);

    const estabIds = (estabs ?? []).map((e: Establishment) => e.id);
    if (estabIds.length === 0) { setLoading(false); setRefreshing(false); return; }

    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, establishment:establishments(*)')
      .in('establishment_id', estabIds)
      .order('created_at', { ascending: false });

    const all = (bookings as BookingWithEstablishment[]) ?? [];
    setPendingBookings(all.filter(b => b.status === 'pending').slice(0, 5));
    setStats({
      pending: all.filter(b => b.status === 'pending').length,
      confirmed: all.filter(b => b.status === 'confirmed').length,
      total: all.length,
      checkedIn: all.filter(b => b.status === 'checked_in').length,
    });
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleConfirm(bookingId: string) {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
    fetchData();
  }

  async function handleReject(bookingId: string) {
    Alert.alert('Refuser la demande', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: async () => {
        await supabase.from('bookings').update({ status: 'rejected' }).eq('id', bookingId);
        fetchData();
      }},
    ]);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  const displayName = profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Partenaire';
  const mainEstab = establishments[0];

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.lave} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Tableau de bord</Text>
            <Text style={styles.headerBrand}>YakaRDC Pro</Text>
            {mainEstab && (
              <Text style={styles.headerEstab}>
                {mainEstab.name} · {mainEstab.neighborhood ?? mainEstab.city}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Pressable onPress={handleSignOut} hitSlop={8} style={{ marginTop: 6 }}>
              <LogOut size={16} color="rgba(250,248,244,0.7)" />
            </Pressable>
          </View>
        </View>

        <View style={styles.content}>
          {/* ── Stats ── */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardAccent]}>
              <Text style={[styles.statValue, { color: colors.lave }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#1F4D3A' }]}>{stats.confirmed}</Text>
              <Text style={styles.statLabel}>Confirmées</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.ink }]}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FAEEDA', borderColor: '#F0C070' }]}>
              <Text style={[styles.statValue, { color: '#854F0B' }]}>{stats.checkedIn}</Text>
              <Text style={styles.statLabel}>Utilisées</Text>
            </View>
          </View>

          {/* ── Bouton scanner ── */}
          <Pressable style={styles.scanBtn} onPress={() => router.push('/(partner)/scan')}>
            <QrCode size={20} color="#FAF8F4" />
            <Text style={styles.scanBtnText}>Scanner un ticket à la réception</Text>
            <ChevronRight size={16} color="rgba(250,248,244,0.7)" />
          </Pressable>

          {/* ── Demandes en attente ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Demandes en attente</Text>
            {stats.pending > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{stats.pending} nouvelle{stats.pending > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.lave} style={{ marginTop: 20 }} />
          ) : pendingBookings.length === 0 ? (
            <View style={styles.empty}>
              <CheckCircle size={32} color={colors.borderStrong} />
              <Text style={styles.emptyText}>Aucune demande en attente</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {pendingBookings.map(b => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.bookingTop}>
                    <View style={styles.bookingInfo}>
                      <Text style={styles.bookingName}>
                        {b.first_name && b.last_name
                          ? `${b.first_name} ${b.last_name}`
                          : 'Client'}
                      </Text>
                      <Text style={styles.bookingMeta}>
                        {b.check_in && b.check_out
                          ? `${b.check_in} – ${b.check_out}`
                          : b.visit_date
                          ? `${b.visit_date}${b.visit_time ? ' · ' + b.visit_time : ''}`
                          : '—'}
                        {b.guests ? ` · ${b.guests} adulte${b.guests > 1 ? 's' : ''}` : ''}
                        {(b as any).children > 0 ? ` · ${(b as any).children} enfant${(b as any).children > 1 ? 's' : ''}` : ''}
                      </Text>
                      {(b as any).contact_phone && (
                        <Text style={styles.bookingPhone}>📞 {(b as any).contact_phone}</Text>
                      )}
                      <Text style={styles.bookingEstab}>{b.establishment?.name}</Text>
                    </View>
                  </View>
                  <View style={styles.bookingActions}>
                    <Pressable style={styles.confirmBtn} onPress={() => handleConfirm(b.id)}>
                      <Text style={styles.confirmBtnText}>✓ Confirmer</Text>
                    </Pressable>
                    <Pressable style={styles.rejectBtn} onPress={() => handleReject(b.id)}>
                      <Text style={styles.rejectBtnText}>✕ Refuser</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Voir toutes les réservations ── */}
          <Pressable style={styles.allBookingsBtn} onPress={() => router.push('/(partner)/bookings')}>
            <CalendarCheck size={16} color={colors.lave} />
            <Text style={styles.allBookingsBtnText}>Voir toutes les réservations</Text>
            <ChevronRight size={14} color={colors.lave} />
          </Pressable>

          {/* ── Mes établissements ── */}
          {establishments.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Mes établissements</Text>
              {establishments.map(e => (
                <View key={e.id} style={styles.estabCard}>
                  <Building2 size={18} color={colors.lave} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.estabName}>{e.name}</Text>
                    <Text style={styles.estabMeta}>{e.neighborhood ?? e.city}</Text>
                  </View>
                  <View style={[styles.estabStatus, e.status === 'approved' ? styles.estabApproved : styles.estabPending]}>
                    <Text style={[styles.estabStatusText, e.status === 'approved' ? { color: '#1F4D3A' } : { color: '#854F0B' }]}>
                      {e.status === 'approved' ? 'Actif' : 'En attente'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.lave,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerSub: { fontSize: 11, color: 'rgba(250,248,244,0.7)', marginBottom: 2 },
  headerBrand: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: '#FAF8F4' },
  headerEstab: { fontSize: 12, color: 'rgba(250,248,244,0.8)', marginTop: 4 },
  headerRight: { alignItems: 'center' },
  avatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '500', color: '#FAF8F4' },
  content: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12,
  },
  statCardAccent: { borderColor: '#F5C4B3', backgroundColor: '#FAECE7' },
  statValue: { fontSize: 24, fontWeight: '500', marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.muted },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.lave, borderRadius: 12,
    padding: 14, marginBottom: 20,
  },
  scanBtnText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#FAF8F4' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  badge: { backgroundColor: colors.laveSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, color: colors.lave, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: colors.muted },
  bookingCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12,
  },
  bookingTop: { marginBottom: 10 },
  bookingInfo: { gap: 2 },
  bookingName: { fontSize: 13, fontWeight: '500', color: colors.ink },
  bookingMeta: { fontSize: 11, color: colors.muted },
  bookingPhone: { fontSize: 11, color: colors.muted },
  bookingEstab: { fontSize: 11, color: colors.lave, fontWeight: '500' },
  bookingActions: { flexDirection: 'row', gap: 8 },
  confirmBtn: {
    flex: 1, backgroundColor: '#1F4D3A',
    borderRadius: 8, padding: 8, alignItems: 'center',
  },
  confirmBtnText: { fontSize: 12, color: '#FAF8F4', fontWeight: '500' },
  rejectBtn: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: 8, padding: 8, alignItems: 'center',
  },
  rejectBtnText: { fontSize: 12, color: '#C0392B' },
  allBookingsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, marginTop: 14,
  },
  allBookingsBtnText: { flex: 1, fontSize: 13, color: colors.lave, fontWeight: '500' },
  estabCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  estabName: { fontSize: 13, fontWeight: '500', color: colors.ink },
  estabMeta: { fontSize: 11, color: colors.muted },
  estabStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  estabApproved: { backgroundColor: '#DCEEE3' },
  estabPending: { backgroundColor: '#FAEEDA' },
  estabStatusText: { fontSize: 10, fontWeight: '500' },
});