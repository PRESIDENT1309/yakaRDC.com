import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Search, Building2, Home, UtensilsCrossed, Mountain, Store, ChevronRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, categoryColors } from '../../lib/theme';
import type { Establishment, EstablishmentType, PartnerRequest } from '../../lib/types';

interface EstabBookingSummary {
  establishment: Establishment;
  pending: number;
  confirmed: number;
  checkedIn: number;
}

function CategoryIcon({ type, size = 14 }: { type: EstablishmentType; size?: number }) {
  const cat = categoryColors[type];
  const props = { size, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
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
          <Text style={styles.headerTitle}>Vue d'ensemble</Text>
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
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Établissements actifs</Text>
                <Text style={styles.statValue}>{activeEstablishments}</Text>
              </View>
              <View style={[styles.statCard, styles.statCardAccent]}>
                <Text style={[styles.statLabel, { color: colors.lave }]}>Réservations aujourd'hui</Text>
                <Text style={[styles.statValue, { color: colors.lave }]}>{todayTotal}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Utilisateurs total</Text>
                <Text style={styles.statValue}>{totalUsers}</Text>
              </View>
              <View style={[styles.statCard, styles.statCardGreen]}>
                <Text style={[styles.statLabel, { color: '#1F4D3A' }]}>Nouveaux ce mois</Text>
                <Text style={[styles.statValue, { color: '#1F4D3A' }]}>{newUsersThisMonth}</Text>
              </View>
              <View style={[styles.statCard, styles.statCardAmber]}>
                <Text style={[styles.statLabel, { color: '#854F0B' }]}>Demandes partenaires</Text>
                <Text style={[styles.statValue, { color: '#854F0B' }]}>{pendingRequests}</Text>
              </View>
            </View>

            {/* Réservations du jour - ensemble */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>📅 Réservations du jour — Toutes plateformes</Text>
                <Text style={styles.cardHeaderTotal}>{todayTotal} au total</Text>
              </View>
              <View style={styles.todayRow}>
                <View style={styles.todayBox}>
                  <Text style={[styles.todayValue, { color: colors.lave }]}>{todayPending}</Text>
                  <Text style={styles.todayLabel}>En attente</Text>
                </View>
                <View style={styles.todayBox}>
                  <Text style={[styles.todayValue, { color: '#1F4D3A' }]}>{todayConfirmed}</Text>
                  <Text style={styles.todayLabel}>Confirmées</Text>
                </View>
                <View style={styles.todayBox}>
                  <Text style={[styles.todayValue, { color: '#085041' }]}>{todayCheckedIn}</Text>
                  <Text style={styles.todayLabel}>Check-ins</Text>
                </View>
              </View>
            </View>

            {/* Par établissement */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏢 Réservations du jour — Par établissement</Text>
              {perEstablishment.length === 0 ? (
                <Text style={styles.emptyText}>Aucune réservation aujourd'hui pour le moment.</Text>
              ) : (
                <View style={{ gap: 7, marginTop: 10 }}>
                  {perEstablishment.map(s => {
                    const cat = categoryColors[s.establishment.type];
                    return (
                      <View key={s.establishment.id} style={styles.estabRow}>
                        <View style={[styles.estabIcon, { backgroundColor: cat?.soft ?? '#FAECE7' }]}>
                          <CategoryIcon type={s.establishment.type} />
                        </View>
                        <Text style={styles.estabName} numberOfLines={1}>{s.establishment.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {s.pending > 0 && (
                            <View style={[styles.miniBadge, { backgroundColor: '#FFF8E6' }]}>
                              <Text style={[styles.miniBadgeText, { color: '#854F0B' }]}>{s.pending} attente</Text>
                            </View>
                          )}
                          {s.confirmed > 0 && (
                            <View style={[styles.miniBadge, { backgroundColor: '#DCEEE3' }]}>
                              <Text style={[styles.miniBadgeText, { color: '#1F4D3A' }]}>{s.confirmed} confirm.</Text>
                            </View>
                          )}
                          {s.checkedIn > 0 && (
                            <View style={[styles.miniBadge, { backgroundColor: '#E1F5EE' }]}>
                              <Text style={[styles.miniBadgeText, { color: '#085041' }]}>{s.checkedIn} check-in</Text>
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
                <Text style={styles.cardTitle}>🆕 Nouvelles demandes de partenariat</Text>
                {pendingRequests > 0 && (
                  <Pressable onPress={() => router.push('/admin/partner-requests')}>
                    <Text style={styles.cardLink}>Voir toutes →</Text>
                  </Pressable>
                )}
              </View>
              {recentRequests.length === 0 ? (
                <Text style={styles.emptyText}>Aucune demande en attente.</Text>
              ) : (
                <View style={{ gap: 8, marginTop: 8 }}>
                  {recentRequests.map(r => (
                    <Pressable
                      key={r.id}
                      style={styles.requestRow}
                      onPress={() => router.push('/admin/partner-requests')}
                    >
                      <View style={styles.requestIcon}><Store size={14} color={colors.lave} /></View>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '500', color: colors.ink },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7,
  },
  searchPlaceholder: { fontSize: 11, color: colors.faint },
  content: { padding: 20, gap: 14, maxWidth: 900 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flex: 1, minWidth: 140,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 10,
  },
  statCardAccent: { backgroundColor: colors.laveSoft, borderColor: '#F5C4B3' },
  statCardGreen: { backgroundColor: '#DCEEE3', borderColor: '#A8D5B5' },
  statCardAmber: { backgroundColor: '#FAEEDA', borderColor: '#F0C070' },
  statLabel: { fontSize: 9, color: colors.muted },
  statValue: { fontSize: 18, fontWeight: '500', color: colors.ink, marginTop: 4 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 13, fontWeight: '500', color: colors.ink },
  cardHeaderTotal: { fontSize: 11, color: colors.lave, fontWeight: '500' },
  cardLink: { fontSize: 11, color: colors.lave, fontWeight: '500' },
  todayRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  todayBox: { flex: 1, backgroundColor: '#FAFAF9', borderRadius: 8, padding: 8, alignItems: 'center' },
  todayValue: { fontSize: 16, fontWeight: '500' },
  todayLabel: { fontSize: 9, color: colors.muted, marginTop: 2 },
  emptyText: { fontSize: 12, color: colors.muted, marginTop: 8 },
  estabRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: '#FAFAF9', borderRadius: 8 },
  estabIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  estabName: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.ink },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  miniBadgeText: { fontSize: 10, fontWeight: '500' },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: colors.laveSoft, borderRadius: 8 },
  requestIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  requestName: { fontSize: 12, fontWeight: '500', color: colors.ink },
  requestMeta: { fontSize: 10, color: colors.muted, marginTop: 1 },
  examineBtn: { backgroundColor: colors.lave, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  examineBtnText: { fontSize: 10, color: '#FAF8F4', fontWeight: '500' },
});