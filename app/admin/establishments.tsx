import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import {
  Search, Building2, Home, UtensilsCrossed, Mountain,
  Star, AlertTriangle, Ban, CheckCircle, Phone, Mail, User as UserIcon,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors } from '../../lib/theme';
import type { Establishment, EstablishmentType, EstablishmentWarning, Profile } from '../../lib/types';

type CategoryFilter = EstablishmentType | 'all';
type StatusFilter = 'all' | 'active' | 'suspended';

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'hotel', label: 'Hôtels' },
  { key: 'furnished_house', label: 'Maisons' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'site', label: 'Sites' },
];

const TYPE_LABELS: Record<EstablishmentType, string> = {
  hotel: 'Hôtel', furnished_house: 'Maison meublée',
  restaurant: 'Restaurant', site: 'Site touristique',
};

function TypeIcon({ type, size = 16 }: { type: EstablishmentType; size?: number }) {
  const cat = categoryColors[type];
  const props = { size, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

interface Stats {
  pending: number; confirmed: number; checkedIn: number; rejected: number;
  avgRating: number; reviewCount: number;
}

export default function EstablishmentsScreen() {
  const { profile: currentAdmin } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Establishment | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [warnings, setWarnings] = useState<EstablishmentWarning[]>([]);
  const [warningMode, setWarningMode] = useState(false);
  const [warningReason, setWarningReason] = useState('');
  const [suspendMode, setSuspendMode] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('establishments').select('*').order('created_at', { ascending: false });
    if (categoryFilter !== 'all') q = q.eq('type', categoryFilter);
    if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
    const { data } = await q;
    let list = (data as Establishment[]) ?? [];
    if (statusFilter === 'active') list = list.filter(e => !e.suspended_at);
    if (statusFilter === 'suspended') list = list.filter(e => !!e.suspended_at);
    setEstablishments(list);
    setLoading(false);
  }, [categoryFilter, statusFilter, query]);

  useEffect(() => {
    const t = setTimeout(fetchList, 250);
    return () => clearTimeout(t);
  }, [fetchList]);

  async function openDetail(e: Establishment) {
    setSelected(e);
    setWarningMode(false);
    setSuspendMode(false);
    setWarningReason('');
    setSuspendReason('');

    const [{ data: ownerData }, { data: bookings }, { data: reviews }, { data: warningsData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', e.owner_id).maybeSingle(),
      supabase.from('bookings').select('status').eq('establishment_id', e.id),
      supabase.from('reviews').select('rating').eq('establishment_id', e.id),
      supabase.from('establishment_warnings').select('*').eq('establishment_id', e.id).order('created_at', { ascending: false }),
    ]);

    setOwner((ownerData as Profile) ?? null);

    const b = bookings ?? [];
    const r = reviews ?? [];
    const avgRating = r.length > 0 ? r.reduce((s: number, x: any) => s + x.rating, 0) / r.length : 0;
    setStats({
      pending: b.filter((x: any) => x.status === 'pending').length,
      confirmed: b.filter((x: any) => x.status === 'confirmed').length,
      checkedIn: b.filter((x: any) => x.status === 'checked_in').length,
      rejected: b.filter((x: any) => x.status === 'rejected').length,
      avgRating,
      reviewCount: r.length,
    });
    setWarnings((warningsData as EstablishmentWarning[]) ?? []);
  }

  async function handleSendWarning() {
    if (!selected || !currentAdmin?.id || !warningReason.trim()) return;
    setProcessing(true);

    await supabase.from('establishment_warnings').insert({
      establishment_id: selected.id,
      issued_by: currentAdmin.id,
      reason: warningReason.trim(),
    });
    await supabase.from('establishments')
      .update({ warning_count: selected.warning_count + 1 })
      .eq('id', selected.id);
    await supabase.from('admin_activity_log').insert({
      actor_id: currentAdmin.id,
      action: 'establishment_warned',
      target_type: 'establishment',
      target_id: selected.id,
      details: { establishment_name: selected.name, reason: warningReason.trim() },
    });

    setProcessing(false);
    setWarningMode(false);
    setWarningReason('');
    const updated = { ...selected, warning_count: selected.warning_count + 1 };
    setSelected(updated);
    openDetail(updated);
    fetchList();
  }

  async function handleSuspend() {
    if (!selected || !currentAdmin?.id) return;
    setProcessing(true);

    await supabase.from('establishments').update({
      suspended_at: new Date().toISOString(),
      suspension_reason: suspendReason.trim() || 'Non précisé',
    }).eq('id', selected.id);
    await supabase.from('admin_activity_log').insert({
      actor_id: currentAdmin.id,
      action: 'establishment_suspended',
      target_type: 'establishment',
      target_id: selected.id,
      details: { establishment_name: selected.name, reason: suspendReason.trim() },
    });

    setProcessing(false);
    setSuspendMode(false);
    const updated = { ...selected, suspended_at: new Date().toISOString(), suspension_reason: suspendReason.trim() };
    setSelected(updated);
    fetchList();
  }

  async function handleReactivate() {
    if (!selected || !currentAdmin?.id) return;
    Alert.alert('Réactiver cet établissement', `${selected.name} redeviendra visible dans l'app.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Réactiver', onPress: async () => {
        setProcessing(true);
        await supabase.from('establishments').update({ suspended_at: null, suspension_reason: null }).eq('id', selected.id);
        await supabase.from('admin_activity_log').insert({
          actor_id: currentAdmin.id,
          action: 'establishment_reactivated',
          target_type: 'establishment',
          target_id: selected.id,
          details: { establishment_name: selected.name },
        });
        setProcessing(false);
        const updated = { ...selected, suspended_at: null, suspension_reason: null };
        setSelected(updated);
        fetchList();
      }},
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Établissements</Text>
          <Text style={styles.headerSub}>{establishments.length} établissement{establishments.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.searchBox}>
          <Search size={13} color={colors.faint} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher par nom..."
            placeholderTextColor={colors.faint}
          />
        </View>
      </View>

      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {CATEGORY_FILTERS.map(f => (
            <Pressable key={f.key} style={[styles.pill, categoryFilter === f.key && styles.pillActive]} onPress={() => setCategoryFilter(f.key)}>
              <Text style={[styles.pillText, categoryFilter === f.key && styles.pillTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['all', 'active', 'suspended'] as StatusFilter[]).map(s => (
            <Pressable key={s} style={[styles.pill, statusFilter === s && styles.pillActive]} onPress={() => setStatusFilter(s)}>
              <Text style={[styles.pillText, statusFilter === s && styles.pillTextActive]}>
                {s === 'all' ? 'Tous statuts' : s === 'active' ? 'Actifs' : 'Suspendus'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {loading ? <ActivityIndicator color={colors.lave} style={{ marginTop: 30 }} /> : establishments.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>Aucun établissement trouvé.</Text></View>
          ) : (
            <View style={{ gap: 8, padding: 14 }}>
              {establishments.map(e => (
                <Pressable
                  key={e.id}
                  style={[styles.listCard, selected?.id === e.id && styles.listCardActive, e.suspended_at && styles.listCardSuspended]}
                  onPress={() => openDetail(e)}
                >
                  <View style={[styles.listIcon, { backgroundColor: categoryColors[e.type]?.soft ?? '#FAECE7' }]}>
                    <TypeIcon type={e.type} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.listName} numberOfLines={1}>{e.name}</Text>
                    <Text style={styles.listMeta}>{TYPE_LABELS[e.type]} · {e.neighborhood ?? e.city}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {e.suspended_at ? (
                      <View style={styles.suspendedBadge}><Ban size={10} color="#C0392B" /><Text style={styles.suspendedText}>Suspendu</Text></View>
                    ) : (
                      <View style={styles.activeBadge}><Text style={styles.activeText}>Actif</Text></View>
                    )}
                    {e.warning_count > 0 && (
                      <View style={styles.warningBadge}>
                        <AlertTriangle size={9} color="#854F0B" />
                        <Text style={styles.warningBadgeText}>{e.warning_count}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.detail}>
          {!selected ? (
            <View style={styles.detailEmpty}>
              <Building2 size={40} color={colors.borderStrong} />
              <Text style={styles.detailEmptyText}>Sélectionnez un établissement</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <View style={styles.detailHeader}>
                <View style={[styles.detailIcon, { backgroundColor: categoryColors[selected.type]?.soft ?? '#FAECE7' }]}>
                  <TypeIcon type={selected.type} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailName}>{selected.name}</Text>
                  <Text style={styles.detailMeta}>{TYPE_LABELS[selected.type]} · {selected.neighborhood ?? selected.city}</Text>
                </View>
                {selected.suspended_at ? (
                  <View style={styles.suspendedBadgeLg}><Ban size={12} color="#C0392B" /><Text style={styles.suspendedTextLg}>Suspendu</Text></View>
                ) : (
                  <View style={styles.activeBadgeLg}><CheckCircle size={12} color="#1F4D3A" /><Text style={styles.activeTextLg}>Actif</Text></View>
                )}
              </View>

              {selected.suspended_at && (
                <View style={styles.suspensionNotice}>
                  <Text style={styles.suspensionNoticeTitle}>Suspendu depuis le {new Date(selected.suspended_at).toLocaleDateString('fr-FR')}</Text>
                  {selected.suspension_reason && <Text style={styles.suspensionNoticeText}>Motif : {selected.suspension_reason}</Text>}
                </View>
              )}

              {/* Stats */}
              <Text style={styles.sectionLabel}>Statistiques</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}><Text style={styles.statValue}>{stats?.pending ?? 0}</Text><Text style={styles.statLabel}>En attente</Text></View>
                <View style={styles.statBox}><Text style={[styles.statValue, { color: '#1F4D3A' }]}>{stats?.confirmed ?? 0}</Text><Text style={styles.statLabel}>Confirmées</Text></View>
                <View style={styles.statBox}><Text style={styles.statValue}>{stats?.checkedIn ?? 0}</Text><Text style={styles.statLabel}>Check-ins</Text></View>
                <View style={styles.statBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Star size={13} color="#854F0B" fill="#854F0B" />
                    <Text style={styles.statValue}>{stats?.avgRating ? stats.avgRating.toFixed(1) : '—'}</Text>
                  </View>
                  <Text style={styles.statLabel}>{stats?.reviewCount ?? 0} avis</Text>
                </View>
              </View>

              {/* Propriétaire */}
              <Text style={styles.sectionLabel}>Propriétaire</Text>
              <View style={styles.ownerCard}>
                <View style={styles.ownerAvatar}><UserIcon size={14} color={colors.lave} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ownerName}>{owner?.full_name ?? 'Inconnu'}</Text>
                  <Text style={styles.ownerContact}>{owner?.email ?? owner?.phone ?? '—'}</Text>
                </View>
              </View>

              {/* Avertissements */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Avertissements ({warnings.length})</Text>
              </View>
              {warnings.length === 0 ? (
                <Text style={styles.emptyInlineText}>Aucun avertissement émis.</Text>
              ) : (
                <View style={{ gap: 6, marginBottom: 8 }}>
                  {warnings.map(w => (
                    <View key={w.id} style={styles.warningRow}>
                      <AlertTriangle size={12} color="#854F0B" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.warningReason}>{w.reason}</Text>
                        <Text style={styles.warningDate}>{new Date(w.created_at).toLocaleDateString('fr-FR')}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Actions */}
              {!warningMode && !suspendMode && (
                <View style={styles.actionsRow}>
                  <Pressable style={styles.warnBtn} onPress={() => setWarningMode(true)}>
                    <AlertTriangle size={14} color="#854F0B" />
                    <Text style={styles.warnBtnText}>Avertir</Text>
                  </Pressable>
                  {selected.suspended_at ? (
                    <Pressable style={styles.reactivateBtn} onPress={handleReactivate}>
                      <CheckCircle size={14} color="#1F4D3A" />
                      <Text style={styles.reactivateBtnText}>Réactiver</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.suspendBtn} onPress={() => setSuspendMode(true)}>
                      <Ban size={14} color="#C0392B" />
                      <Text style={styles.suspendBtnText}>Suspendre</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {warningMode && (
                <View style={styles.formBox}>
                  <Text style={styles.sectionLabel}>Motif de l'avertissement</Text>
                  <TextInput
                    style={styles.textArea}
                    value={warningReason}
                    onChangeText={setWarningReason}
                    placeholder="Ex : réponses tardives aux réservations, informations inexactes..."
                    placeholderTextColor={colors.faint}
                    multiline
                  />
                  <View style={styles.actionsRow}>
                    <Pressable style={[styles.confirmWarnBtn, (!warningReason.trim() || processing) && { opacity: 0.5 }]} onPress={handleSendWarning} disabled={!warningReason.trim() || processing}>
                      {processing ? <ActivityIndicator color="#FAF8F4" size="small" /> : <Text style={styles.confirmBtnText}>Envoyer l'avertissement</Text>}
                    </Pressable>
                    <Pressable style={styles.cancelBtn} onPress={() => setWarningMode(false)}>
                      <Text style={styles.cancelBtnText}>Annuler</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {suspendMode && (
                <View style={styles.formBox}>
                  <Text style={styles.sectionLabel}>Motif de la suspension</Text>
                  <TextInput
                    style={styles.textArea}
                    value={suspendReason}
                    onChangeText={setSuspendReason}
                    placeholder="Ex : non-respect répété des conditions, plaintes multiples..."
                    placeholderTextColor={colors.faint}
                    multiline
                  />
                  <View style={styles.actionsRow}>
                    <Pressable style={[styles.confirmSuspendBtn, processing && { opacity: 0.5 }]} onPress={handleSuspend} disabled={processing}>
                      {processing ? <ActivityIndicator color="#FAF8F4" size="small" /> : <Text style={styles.confirmBtnText}>Confirmer la suspension</Text>}
                    </Pressable>
                    <Pressable style={styles.cancelBtn} onPress={() => setSuspendMode(false)}>
                      <Text style={styles.cancelBtnText}>Annuler</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { paddingTop: Platform.OS === 'web' ? 16 : 50, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '500', color: colors.ink },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7, maxWidth: 260 },
  searchInput: { flex: 1, fontSize: 12, color: colors.ink },
  filtersRow: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderStrong },
  pillActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  pillText: { fontSize: 11, color: colors.muted },
  pillTextActive: { color: '#FAF8F4', fontWeight: '500' },
  body: { flex: 1, flexDirection: 'row' },
  list: { width: 320, borderRightWidth: 1, borderRightColor: colors.border },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 12, color: colors.muted },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  listCardActive: { borderColor: colors.lave, backgroundColor: colors.laveSoft },
  listCardSuspended: { opacity: 0.7 },
  listIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listName: { fontSize: 12, fontWeight: '500', color: colors.ink },
  listMeta: { fontSize: 10, color: colors.muted, marginTop: 1 },
  activeBadge: { backgroundColor: '#DCEEE3', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  activeText: { fontSize: 9.5, color: '#1F4D3A', fontWeight: '500' },
  suspendedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF0F0', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  suspendedText: { fontSize: 9.5, color: '#C0392B', fontWeight: '500' },
  warningBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FAEEDA', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1.5 },
  warningBadgeText: { fontSize: 9.5, color: '#854F0B', fontWeight: '500' },
  detail: { flex: 1 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  detailEmptyText: { fontSize: 13, color: colors.muted },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  detailIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  detailName: { fontSize: 17, fontWeight: '500', color: colors.ink },
  detailMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  activeBadgeLg: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCEEE3', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  activeTextLg: { fontSize: 11, color: '#1F4D3A', fontWeight: '500' },
  suspendedBadgeLg: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF0F0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  suspendedTextLg: { fontSize: 11, color: '#C0392B', fontWeight: '500' },
  suspensionNotice: { backgroundColor: '#FFF0F0', borderRadius: 10, padding: 12, marginBottom: 16 },
  suspensionNoticeTitle: { fontSize: 12, fontWeight: '500', color: '#C0392B' },
  suspensionNoticeText: { fontSize: 11.5, color: '#C0392B', marginTop: 4 },
  sectionLabel: { fontSize: 10.5, fontWeight: '500', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  sectionHeaderRow: { marginTop: 6 },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '500', color: colors.ink },
  statLabel: { fontSize: 9.5, color: colors.muted, marginTop: 3 },
  ownerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 11, marginBottom: 16 },
  ownerAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.laveSoft, alignItems: 'center', justifyContent: 'center' },
  ownerName: { fontSize: 12.5, fontWeight: '500', color: colors.ink },
  ownerContact: { fontSize: 11, color: colors.muted, marginTop: 1 },
  emptyInlineText: { fontSize: 11.5, color: colors.muted, marginBottom: 12 },
  warningRow: { flexDirection: 'row', gap: 8, backgroundColor: '#FAEEDA', borderRadius: 8, padding: 9 },
  warningReason: { fontSize: 11.5, color: colors.ink },
  warningDate: { fontSize: 10, color: '#854F0B', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  warnBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FAEEDA', borderWidth: 1, borderColor: '#F0C070', borderRadius: 10, paddingVertical: 11 },
  warnBtnText: { fontSize: 12.5, color: '#854F0B', fontWeight: '500' },
  suspendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFD5D5', borderRadius: 10, paddingVertical: 11 },
  suspendBtnText: { fontSize: 12.5, color: '#C0392B', fontWeight: '500' },
  reactivateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#DCEEE3', borderWidth: 1, borderColor: '#A8D5B5', borderRadius: 10, paddingVertical: 11 },
  reactivateBtnText: { fontSize: 12.5, color: '#1F4D3A', fontWeight: '500' },
  formBox: { marginTop: 4 },
  textArea: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 13, color: colors.ink, height: 80, textAlignVertical: 'top', marginBottom: 12 },
  confirmWarnBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#854F0B', borderRadius: 10, paddingVertical: 12 },
  confirmSuspendBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C0392B', borderRadius: 10, paddingVertical: 12 },
  confirmBtnText: { fontSize: 12.5, color: '#FAF8F4', fontWeight: '500' },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, paddingVertical: 12 },
  cancelBtnText: { fontSize: 12.5, color: colors.ink },
});