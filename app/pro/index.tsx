import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  QrCode, ChevronRight, CalendarCheck,
  TrendingUp, Users, CheckCircle, Clock,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';
import type { Booking, Establishment } from '../../lib/types';

type BookingWithEstablishment = Booking & { establishment: Establishment };

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MOCK_DATA = [3, 5, 8, 4, 2, 9, 6];
const MAX_DATA = Math.max(...MOCK_DATA);

export default function PartnerDashboard() {
  const { profile } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [pendingBookings, setPendingBookings] = useState<BookingWithEstablishment[]>([]);
  const [stats, setStats] = useState({ pending: 0, confirmed: 0, total: 0, checkedIn: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    const { data: estabs } = await supabase
      .from('establishments').select('*').eq('owner_id', profile.id);
    setEstablishments((estabs as Establishment[]) ?? []);
    const ids = (estabs ?? []).map((e: Establishment) => e.id);
    if (ids.length === 0) { setLoading(false); setRefreshing(false); return; }
    const { data: bookings } = await supabase
      .from('bookings').select('*, establishment:establishments(*)')
      .in('establishment_id', ids).order('created_at', { ascending: false });
    const all = (bookings as BookingWithEstablishment[]) ?? [];
    setPendingBookings(all.filter(b => b.status === 'pending').slice(0, 3));
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

  async function handleConfirm(id: string) {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
    fetchData();
  }

  async function handleReject(id: string) {
    Alert.alert('Refuser', 'Confirmer le refus ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: async () => {
        await supabase.from('bookings').update({ status: 'rejected' }).eq('id', id);
        fetchData();
      }},
    ]);
  }

  const displayName = profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Partenaire';
  const mainEstab = establishments[0];
  const now = new Date();
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Bonjour, {displayName.split(' ')[0]} 👋</Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>
        {mainEstab && (
          <View style={styles.estabPill}>
            <View style={styles.estabDot} />
            <Text style={styles.estabPillText}>{mainEstab.name} · {mainEstab.neighborhood ?? mainEstab.city}</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.lave} />}>

        <View style={styles.content}>
          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardRed]}>
              <Clock size={16} color={colors.lave} />
              <Text style={[styles.statValue, { color: colors.lave }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
            <View style={[styles.statCard, styles.statCardGreen]}>
              <CheckCircle size={16} color="#1F4D3A" />
              <Text style={[styles.statValue, { color: '#1F4D3A' }]}>{stats.confirmed}</Text>
              <Text style={styles.statLabel}>Confirmées</Text>
            </View>
            <View style={styles.statCard}>
              <Users size={16} color={colors.ink} />
              <Text style={[styles.statValue, { color: colors.ink }]}>{stats.checkedIn}</Text>
              <Text style={styles.statLabel}>Check-ins</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FAEEDA', borderColor: '#F0C070' }]}>
              <TrendingUp size={16} color="#854F0B" />
              <Text style={[styles.statValue, { color: '#854F0B', fontSize: 16 }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: '#854F0B' }]}>Total</Text>
            </View>
          </View>

          {/* Graphique réservations */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Réservations — 7 derniers jours</Text>
            <View style={styles.chart}>
              {MOCK_DATA.map((val, i) => (
                <View key={i} style={styles.chartCol}>
                  <View style={styles.chartBarWrap}>
                    <View style={[styles.chartBar, {
                      height: `${(val / MAX_DATA) * 100}%`,
                      backgroundColor: i === 5 ? colors.lave : '#F5C4B3',
                    }]} />
                  </View>
                  <Text style={styles.chartDay}>{DAYS[i]}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Scan */}
          <Pressable style={styles.scanBtn} onPress={() => router.push('/pro/scan')}>
            <QrCode size={20} color="#FAF8F4" />
            <Text style={styles.scanBtnText}>Scanner un ticket à la réception</Text>
            <ChevronRight size={16} color="rgba(250,248,244,0.7)" />
          </Pressable>

          {/* Demandes en attente */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Demandes en attente</Text>
            {stats.pending > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{stats.pending}</Text>
              </View>
            )}
          </View>

          {loading ? <ActivityIndicator color={colors.lave} /> :
           pendingBookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <CheckCircle size={28} color={colors.borderStrong} />
              <Text style={styles.emptyText}>Aucune demande en attente</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {pendingBookings.map(b => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.bookingAvatar}>
                    <Text style={styles.bookingAvatarText}>
                      {(b as any).first_name ? (b as any).first_name.charAt(0).toUpperCase() : 'C'}
                    </Text>
                  </View>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingName}>
                      {(b as any).first_name && (b as any).last_name
                        ? `${(b as any).first_name} ${(b as any).last_name}` : 'Client'}
                    </Text>
                    <Text style={styles.bookingMeta}>
                      {b.check_in && b.check_out ? `${b.check_in} → ${b.check_out}` :
                       b.visit_date ? `${b.visit_date}${b.visit_time ? ' · ' + b.visit_time : ''}` : '—'}
                      {b.guests ? ` · ${b.guests} pers.` : ''}
                    </Text>
                    {(b as any).contact_phone && (
                      <Text style={styles.bookingPhone}>📞 {(b as any).contact_phone}</Text>
                    )}
                  </View>
                  <View style={styles.bookingActions}>
                    <Pressable style={styles.confirmBtn} onPress={() => handleConfirm(b.id)}>
                      <Text style={styles.confirmBtnText}>✓</Text>
                    </Pressable>
                    <Pressable style={styles.rejectBtn} onPress={() => handleReject(b.id)}>
                      <Text style={styles.rejectBtnText}>✕</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable style={styles.allBtn} onPress={() => router.push('/pro/bookings')}>
            <CalendarCheck size={16} color={colors.lave} />
            <Text style={styles.allBtnText}>Voir toutes les réservations</Text>
            <ChevronRight size={14} color={colors.lave} />
          </Pressable>
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
    paddingHorizontal: 20, paddingBottom: 16,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  greeting: { fontSize: 18, fontWeight: '500', color: '#FAF8F4' },
  date: { fontSize: 11, color: 'rgba(250,248,244,0.7)', marginTop: 3 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '500', color: '#FAF8F4' },
  estabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  estabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FAC775' },
  estabPillText: { fontSize: 11, color: '#FAF8F4' },
  content: { padding: 16, gap: 14 },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  statCardRed: { borderColor: '#F5C4B3', backgroundColor: '#FAECE7' },
  statCardGreen: { borderColor: '#A8D5B5', backgroundColor: '#DCEEE3' },
  statValue: { fontSize: 22, fontWeight: '500' },
  statLabel: { fontSize: 9, color: colors.muted, textAlign: 'center' },
  chartCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  chartTitle: { fontSize: 12, fontWeight: '500', color: colors.ink, marginBottom: 12 },
  chart: { flexDirection: 'row', height: 80, alignItems: 'flex-end', gap: 6 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  chartBarWrap: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 4, minHeight: 4 },
  chartDay: { fontSize: 9, color: colors.faint },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.lave, borderRadius: 12, padding: 14 },
  scanBtnText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#FAF8F4' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '500', color: colors.ink },
  badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.lave, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, color: '#FAF8F4', fontWeight: '500' },
  emptyCard: { alignItems: 'center', paddingVertical: 20, gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 13, color: colors.muted },
  bookingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  bookingAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.laveSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bookingAvatarText: { fontSize: 16, fontWeight: '500', color: colors.lave },
  bookingInfo: { flex: 1 },
  bookingName: { fontSize: 13, fontWeight: '500', color: colors.ink },
  bookingMeta: { fontSize: 11, color: colors.muted, marginTop: 1 },
  bookingPhone: { fontSize: 11, color: colors.muted, marginTop: 1 },
  bookingActions: { flexDirection: 'row', gap: 6 },
  confirmBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1F4D3A', alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 14, color: '#FAF8F4', fontWeight: '500' },
  rejectBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFD5D5', alignItems: 'center', justifyContent: 'center' },
  rejectBtnText: { fontSize: 14, color: '#C0392B' },
  allBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  allBtnText: { flex: 1, fontSize: 13, color: colors.lave, fontWeight: '500' },
});