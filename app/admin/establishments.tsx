import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Alert } from '../../lib/alert';
import {
  Search, Building2, Home, UtensilsCrossed, Mountain,
  Star, AlertTriangle, Ban, CheckCircle, Phone, Mail, User as UserIcon, ArrowLeft,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { ecrire } from '../../lib/db';
import { useConfirm } from '../../lib/confirm-context';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, typography, radii, spacing, fonts, cible } from '../../lib/theme';
import type { Establishment, EstablishmentType, EstablishmentWarning, Profile } from '../../lib/types';
import { useAdminResponsive } from '../../lib/responsive';
import StatCard from '../../components/StatCard';
import { etatBascule } from '../../lib/a11y';

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
  const confirm = useConfirm();
  // Largeur utile, barre laterale de l'admin deduite : la fenetre seule
  // faisait croire a une vue bureau alors que le detail etait ecrase.
  const { isMobile } = useAdminResponsive();
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

    // Une décision de modération non enregistrée ne doit ni être journalisée
    // ni s'afficher comme prise : l'admin croirait le partenaire averti.
    const emis = await ecrire(
      supabase.from('establishment_warnings').insert({
        establishment_id: selected.id,
        issued_by: currentAdmin.id,
        reason: warningReason.trim(),
      }),
      "Envoi de l'avertissement",
    );
    if (!emis) { setProcessing(false); return; }
    // Résultat volontairement ignoré : l'avertissement lui-même est déjà
    // enregistré, et fetchList() plus bas relit le compteur depuis la base.
    // Un échec ici se corrige donc tout seul à l'affichage suivant.
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

    // Un établissement cru suspendu mais toujours visible dans l'app est la
    // pire issue possible ici : on ne poursuit que si la base a suivi.
    const suspendu = await ecrire(
      supabase.from('establishments').update({
        suspended_at: new Date().toISOString(),
        suspension_reason: suspendReason.trim() || 'Non précisé',
      }).eq('id', selected.id),
      'Suspension',
    );
    if (!suspendu) { setProcessing(false); return; }
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
    const ok = await confirm({
      title: 'Réactiver cet établissement ?',
      message: `${selected.name} redeviendra visible dans l'application.`,
      confirmLabel: 'Réactiver',
    });
    if (!ok) return;

    setProcessing(true);
    const reactive = await ecrire(
      supabase.from('establishments').update({ suspended_at: null, suspension_reason: null }).eq('id', selected.id),
      'Réactivation',
    );
    if (!reactive) { setProcessing(false); return; }
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
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Établissements</Text>
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
            accessibilityLabel="Rechercher un établissement par nom"
          />
        </View>
      </View>

      <View style={styles.filtersRow}>
        {/* La pastille visible garde sa taille ; c'est la zone qui l'entoure
            qui atteint 44 px. Dans la rangée défilante, la marge négative est
            portée par la rangée : posée sur les zones, elle serait rognée. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillScroll}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {CATEGORY_FILTERS.map(f => {
            const actif = categoryFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={styles.pillZone}
                accessibilityRole="button"
                {...etatBascule(actif)}
                onPress={() => setCategoryFilter(f.key)}
              >
                <View style={[styles.pill, actif && styles.pillActive]}>
                  <Text style={[styles.pillText, actif && styles.pillTextActive]}>{f.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.pillRow}>
          {(['all', 'active', 'suspended'] as StatusFilter[]).map(s => {
            const actif = statusFilter === s;
            return (
              <Pressable
                key={s}
                style={styles.pillZone}
                accessibilityRole="button"
                {...etatBascule(actif)}
                onPress={() => setStatusFilter(s)}
              >
                <View style={[styles.pill, actif && styles.pillActive]}>
                  <Text style={[styles.pillText, actif && styles.pillTextActive]}>
                    {s === 'all' ? 'Tous statuts' : s === 'active' ? 'Actifs' : 'Suspendus'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.body, isMobile && styles.bodyMobile]}>
        {(!isMobile || !selected) && (
        <ScrollView style={[styles.list, isMobile && styles.listMobile]} showsVerticalScrollIndicator={false}>
          {loading ? <ActivityIndicator color={colors.lave} style={{ marginTop: 30 }} /> : establishments.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>Aucun établissement trouvé.</Text></View>
          ) : (
            <View style={{ gap: spacing.sm, padding: spacing.v12 }}>
              {establishments.map(e => (
                <Pressable
                  key={e.id}
                  style={[styles.listCard, selected?.id === e.id && styles.listCardActive, e.suspended_at && styles.listCardSuspended]}
                  accessibilityRole="button"
                  {...etatBascule(selected?.id === e.id)}
                  onPress={() => openDetail(e)}
                >
                  <TypeIcon type={e.type} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.listName} numberOfLines={1}>{e.name}</Text>
                    <Text style={styles.listMeta}>{TYPE_LABELS[e.type]} · {e.neighborhood ?? e.city}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                    {e.suspended_at ? (
                      <View style={styles.suspendedBadge}><Ban size={10} color={colors.danger} /><Text style={styles.suspendedText}>Suspendu</Text></View>
                    ) : (
                      <View style={styles.activeBadge}><Text style={styles.activeText}>Actif</Text></View>
                    )}
                    {e.warning_count > 0 && (
                      // Le chiffre seul ne dit pas ce qu'il compte.
                      <View style={styles.warningBadge} accessible accessibilityLabel={`${e.warning_count} avertissement${e.warning_count > 1 ? 's' : ''}`}>
                        <AlertTriangle size={9} color={colors.warning} />
                        <Text style={styles.warningBadgeText}>{e.warning_count}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        )}

        {(!isMobile || selected) && (
        <View style={styles.detail}>
          {!selected ? (
            <View style={styles.detailEmpty}>
              <Building2 size={40} color={colors.borderStrong} />
              <Text style={styles.detailEmptyText}>Sélectionnez un établissement</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.v20 }}>
              {isMobile && (
                <Pressable style={styles.backToListBtn} accessibilityRole="button" onPress={() => setSelected(null)}>
                  <ArrowLeft size={15} color={colors.lave} />
                  <Text style={styles.backToListText}>Retour à la liste</Text>
                </Pressable>
              )}
              <View style={styles.detailHeader}>
                <TypeIcon type={selected.type} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailName} accessibilityRole="header" aria-level={2}>{selected.name}</Text>
                  <Text style={styles.detailMeta}>{TYPE_LABELS[selected.type]} · {selected.neighborhood ?? selected.city}</Text>
                </View>
                {selected.suspended_at ? (
                  <View style={styles.suspendedBadgeLg}><Ban size={12} color={colors.danger} /><Text style={styles.suspendedTextLg}>Suspendu</Text></View>
                ) : (
                  <View style={styles.activeBadgeLg}><CheckCircle size={12} color={colors.success} /><Text style={styles.activeTextLg}>Actif</Text></View>
                )}
              </View>

              {selected.suspended_at && (
                <View style={styles.suspensionNotice}>
                  <Text style={styles.suspensionNoticeTitle}>Suspendu depuis le {new Date(selected.suspended_at).toLocaleDateString('fr-FR')}</Text>
                  {selected.suspension_reason && <Text style={styles.suspensionNoticeText}>Motif : {selected.suspension_reason}</Text>}
                </View>
              )}

              {/* Stats */}
              <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={3}>Statistiques</Text>
              <View style={styles.statsGrid}>
                <StatCard style={styles.statCell} align="center" value={stats?.pending ?? 0} label="En attente" />
                <StatCard style={styles.statCell} align="center" couleur={colors.success} value={stats?.confirmed ?? 0} label="Confirmées" />
                <StatCard style={styles.statCell} align="center" value={stats?.checkedIn ?? 0} label="Check-ins" />
                {/* Carte locale, alignée sur ses voisines : StatCard pose son
                    icône au-dessus du chiffre, alors qu'ici l'étoile se lit sur
                    la même ligne que la note. */}
                <View
                  style={styles.statBox}
                  accessible
                  accessibilityLabel={`Note moyenne : ${stats?.avgRating ? stats.avgRating.toFixed(1) : 'aucune'}, ${stats?.reviewCount ?? 0} avis`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.v2 }}>
                    <Star size={13} color={colors.warning} fill={colors.warning} />
                    <Text style={styles.statValue}>{stats?.avgRating ? stats.avgRating.toFixed(1) : '—'}</Text>
                  </View>
                  <Text style={styles.statLabel}>{stats?.reviewCount ?? 0} avis</Text>
                </View>
              </View>

              {/* Propriétaire */}
              <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={3}>Propriétaire</Text>
              <View style={styles.ownerCard}>
                <UserIcon size={16} color={colors.lave} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ownerName}>{owner?.full_name ?? 'Inconnu'}</Text>
                  <Text style={styles.ownerContact}>{owner?.email ?? owner?.phone ?? '—'}</Text>
                </View>
              </View>

              {/* Avertissements */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={3}>Avertissements ({warnings.length})</Text>
              </View>
              {warnings.length === 0 ? (
                <Text style={styles.emptyInlineText}>Aucun avertissement émis.</Text>
              ) : (
                <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
                  {warnings.map(w => (
                    <View key={w.id} style={styles.warningRow}>
                      <AlertTriangle size={12} color={colors.warning} />
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
                  <Pressable style={styles.warnBtn} accessibilityRole="button" onPress={() => setWarningMode(true)}>
                    <AlertTriangle size={14} color={colors.warning} />
                    <Text style={styles.warnBtnText}>Avertir</Text>
                  </Pressable>
                  {selected.suspended_at ? (
                    <Pressable style={styles.reactivateBtn} accessibilityRole="button" onPress={handleReactivate}>
                      <CheckCircle size={14} color={colors.success} />
                      <Text style={styles.reactivateBtnText}>Réactiver</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.suspendBtn} accessibilityRole="button" onPress={() => setSuspendMode(true)}>
                      <Ban size={14} color={colors.danger} />
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
                    accessibilityLabel="Motif de l'avertissement"
                  />
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[styles.confirmWarnBtn, (!warningReason.trim() || processing) && { opacity: 0.5 }]}
                      // Libellé répété : le texte laisse place à l'indicateur pendant l'envoi.
                      accessibilityRole="button"
                      accessibilityLabel="Envoyer l'avertissement"
                      aria-disabled={!warningReason.trim() || processing} aria-busy={processing}
                      onPress={handleSendWarning}
                      disabled={!warningReason.trim() || processing}
                    >
                      {processing ? <ActivityIndicator color={colors.cream} size="small" /> : <Text style={styles.confirmBtnText}>Envoyer l'avertissement</Text>}
                    </Pressable>
                    <Pressable style={styles.cancelBtn} accessibilityRole="button" onPress={() => setWarningMode(false)}>
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
                    accessibilityLabel="Motif de la suspension"
                  />
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[styles.confirmSuspendBtn, processing && { opacity: 0.5 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Confirmer la suspension"
                      aria-disabled={processing} aria-busy={processing}
                      onPress={handleSuspend}
                      disabled={processing}
                    >
                      {processing ? <ActivityIndicator color={colors.cream} size="small" /> : <Text style={styles.confirmBtnText}>Confirmer la suspension</Text>}
                    </Pressable>
                    <Pressable style={styles.cancelBtn} accessibilityRole="button" onPress={() => setSuspendMode(false)}>
                      <Text style={styles.cancelBtnText}>Annuler</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
        )}
      </View>
    </View>
  );
}

// Hauteur d'une pastille de filtre (texte de 15, retraits de 8, filet) : sa
// zone tactile en fait 44, et le surplus est repris en marge négative pour
// que la rangée garde sa hauteur.
const HAUTEUR_PASTILLE = 33;
const DEBORD_PASTILLE = (cible.min - HAUTEUR_PASTILLE) / 2;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  // La zone sûre est dégagée par le layout de l'admin (bandeau ou marge).
  header: { paddingTop: spacing.md, paddingHorizontal: spacing.v20, paddingBottom: spacing.v12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderField, borderRadius: radii.sm, paddingHorizontal: spacing.v12, minHeight: cible.min, maxWidth: 260 },
  // La saisie occupe toute la hauteur de la barre (44 px) : un appui n'importe
  // où dans la barre tombe dans le champ.
  searchInput: { ...typography.bodyXs, flex: 1, alignSelf: 'stretch', color: colors.ink },
  filtersRow: { paddingHorizontal: spacing.v20, paddingBottom: spacing.v12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  pillScroll: { flexGrow: 0, marginVertical: -DEBORD_PASTILLE },
  pillRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: -DEBORD_PASTILLE },
  pillZone: { minHeight: cible.min, justifyContent: 'center' },
  pill: { paddingHorizontal: spacing.v12, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  pillActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  pillText: { ...typography.captionSm, color: colors.muted, },
  pillTextActive: { color: colors.cream, fontFamily: fonts.sansMedium },
  body: { flex: 1, flexDirection: 'row' },
  bodyMobile: { flexDirection: 'column' },
  list: { width: 320, borderRightWidth: 1, borderRightColor: colors.border },
  listMobile: { width: '100%', borderRightWidth: 0 },
  // 44 px de zone tactile ; les marges compensent pour que la ligne reste où elle était.
  backToListBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: cible.min, marginTop: -spacing.v12, marginBottom: spacing.xs },
  backToListText: { ...typography.pillLabel, color: colors.lave, },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { ...typography.bodyXs, color: colors.muted, },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12 },
  listCardActive: { borderColor: colors.lave, backgroundColor: colors.laveSoft },
  listCardSuspended: { opacity: 0.7 },
  listName: { ...typography.caption, color: colors.ink, },
  listMeta: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  activeBadge: { backgroundColor: colors.successSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.v2 },
  activeText: { ...typography.captionMd, color: colors.success, },
  suspendedBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.v2, backgroundColor: colors.dangerSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.v2 },
  suspendedText: { ...typography.captionMd, color: colors.danger, },
  warningBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.v2, backgroundColor: colors.warningSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 1.5 },
  warningBadgeText: { ...typography.captionMd, color: colors.warning, },
  detail: { flex: 1 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.v12 },
  detailEmptyText: { ...typography.bodySm, color: colors.muted, },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, marginBottom: spacing.v12 },
  detailName: { ...typography.titleSm, color: colors.ink, },
  detailMeta: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  activeBadgeLg: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.successSoft, borderRadius: radii.pill, paddingHorizontal: spacing.v12, paddingVertical: spacing.xs },
  activeTextLg: { ...typography.captionMd, color: colors.success, },
  suspendedBadgeLg: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.dangerSoft, borderRadius: radii.pill, paddingHorizontal: spacing.v12, paddingVertical: spacing.xs },
  suspendedTextLg: { ...typography.captionMd, color: colors.danger, },
  suspensionNotice: { backgroundColor: colors.dangerSoft, borderRadius: radii.md, padding: spacing.v12, marginBottom: spacing.md },
  suspensionNoticeTitle: { ...typography.caption, color: colors.danger, },
  suspensionNoticeText: { ...typography.captionSm, color: colors.danger, marginTop: spacing.xs, },
  sectionLabel: { ...typography.captionMd, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm, },
  sectionHeaderRow: { marginTop: spacing.sm },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCell: { flex: 1 },
  // Mêmes mesures que StatCard, pour que la carte de la note ne se distingue
  // de ses voisines que par son étoile.
  statBox: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12, alignItems: 'center', gap: spacing.v2 },
  statValue: { ...typography.titleMd, color: colors.ink, },
  statLabel: { ...typography.captionSm, color: colors.muted, },
  ownerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12, marginBottom: spacing.md },
  ownerName: { ...typography.caption, color: colors.ink, },
  ownerContact: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  emptyInlineText: { ...typography.captionSm, color: colors.muted, marginBottom: spacing.v12, },
  warningRow: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.warningSoft, borderRadius: radii.sm, padding: spacing.sm },
  warningReason: { ...typography.captionSm, color: colors.ink, },
  warningDate: { ...typography.captionSm, color: colors.warning, marginTop: spacing.v2, },
  actionsRow: { flexDirection: 'row', gap: spacing.v12, marginTop: spacing.sm },
  warnBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: radii.md, paddingVertical: spacing.v12, minHeight: cible.min },
  warnBtnText: { ...typography.caption, color: colors.warning, },
  suspendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radii.md, paddingVertical: spacing.v12, minHeight: cible.min },
  suspendBtnText: { ...typography.caption, color: colors.danger, },
  reactivateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successBorder, borderRadius: radii.md, paddingVertical: spacing.v12, minHeight: cible.min },
  reactivateBtnText: { ...typography.caption, color: colors.success, },
  formBox: { marginTop: spacing.xs },
  textArea: { ...typography.bodySm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderField, borderRadius: radii.md, padding: spacing.v12, color: colors.ink, height: 80, textAlignVertical: 'top', marginBottom: spacing.v12, },
  confirmWarnBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warning, borderRadius: radii.md, paddingVertical: spacing.v12, minHeight: cible.min },
  confirmSuspendBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderRadius: radii.md, paddingVertical: spacing.v12, minHeight: cible.min },
  confirmBtnText: { ...typography.caption, color: colors.cream, },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.md, paddingVertical: spacing.v12, minHeight: cible.min },
  cancelBtnText: { ...typography.bodyXs, color: colors.ink, },
});