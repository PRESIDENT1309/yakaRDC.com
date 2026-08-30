import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, ActivityIndicator, TextInput, Modal, useWindowDimensions,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { ArrowLeft } from 'lucide-react-native';
import {
  Building2, Home, UtensilsCrossed, Mountain, Store,
  Check, X, Camera, Phone, User as UserIcon, MapPin, Clock,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, typography } from '../../lib/theme';
import type { PartnerRequest, EstablishmentType, PartnerRequestStatus } from '../../lib/types';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'En attente' },
  { key: 'approved', label: 'Approuvées' },
  { key: 'rejected', label: 'Refusées' },
  { key: 'all', label: 'Toutes' },
];

const TYPE_LABELS: Record<EstablishmentType, string> = {
  hotel: 'Hôtel',
  furnished_house: 'Maison meublée',
  restaurant: 'Restaurant',
  site: 'Site touristique',
};

function TypeIcon({ type, size = 18 }: { type: EstablishmentType; size?: number }) {
  const cat = categoryColors[type];
  const props = { size, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

function StatusBadge({ status }: { status: PartnerRequestStatus }) {
  const config = {
    pending:  { label: 'En attente', bg: colors.warningSoft, color: colors.warning },
    approved: { label: 'Approuvée', bg: colors.successSoft, color: colors.success },
    rejected: { label: 'Refusée', bg: colors.dangerSoft, color: colors.danger },
  };
  const c = config[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusBadgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

export default function PartnerRequestsScreen() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [requests, setRequests] = useState<PartnerRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PartnerRequest | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('partner_requests').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setRequests((data as PartnerRequest[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  /**
   * L'approbation passe par une fonction serveur, plus par un appel direct.
   *
   * Créer le compte du partenaire exige la clé de service, qui ne peut pas
   * vivre dans l'application : elle donne un accès total à la base. La
   * fonction `approve-partner` la détient côté serveur, crée le compte,
   * délègue la création de l'établissement à `approve_partner_request` en
   * base, puis envoie l'email d'identifiants.
   */
  async function handleApprove(request: PartnerRequest) {
    if (!profile?.id) return;
    setProcessing(true);

    const { data, error } = await supabase.functions.invoke('approve-partner', {
      body: { request_id: request.id },
    });
    setProcessing(false);

    // Une fonction distante échoue de deux façons : le transport, et le corps
    // de la réponse. Ignorer la seconde donnerait une approbation « réussie »
    // qui n'a rien fait.
    //
    // « Failed to send a request » ne dit rien à personne : c'est ce que
    // renvoie supabase-js quand l'appel réseau lui-même échoue, le plus
    // souvent parce que la fonction n'est pas déployée. On le traduit.
    const transportFailed = error?.name === 'FunctionsFetchError'
      || /failed to send a request/i.test(error?.message ?? '');
    if (transportFailed) {
      Alert.alert(
        'Fonction indisponible',
        "La fonction serveur « approve-partner » ne répond pas. Elle n'est probablement pas déployée. Déployez-la depuis le tableau de bord Supabase (Edge Functions), puis réessayez.",
      );
      return;
    }

    // Une fonction distante peut renvoyer un statut d'erreur avec un corps
    // explicatif. supabase-js met alors le corps hors de portee : il faut le
    // relire depuis error.context, sinon on n'affiche qu'un statut nu.
    let body: any = data;
    if (error && (error as any).context instanceof Response) {
      try { body = await (error as any).context.clone().json(); } catch { /* corps non JSON */ }
    }

    const failure = body?.error ?? error?.message;
    if (failure) {
      const detail = body?.detail;
      Alert.alert(
        'Approbation impossible',
        detail
          ? `${failure}\n\n${typeof detail === 'string' ? detail : JSON.stringify(detail, null, 1)}`
          : failure,
      );
      return;
    }

    // L'établissement est créé même si l'email n'est pas parti : on le dit,
    // parce que le partenaire attend alors des identifiants qui n'arriveront
    // jamais et qu'il faut le rattraper à la main.
    const res = body as {
      account_created?: boolean;
      email_sent?: boolean;
      email_error?: string;
      temporary_password?: string;
    };
    if (res?.email_sent) {
      Alert.alert(
        'Partenaire approuvé',
        `${request.establishment_name} est en ligne. Les identifiants ont été envoyés à ${request.contact_email}.`,
      );
    } else {
      // Sans email parti, le partenaire a un compte inaccessible. Le mot de
      // passe est affiché ici pour que l'administrateur le transmette lui-même
      // — c'est la seule façon de ne pas laisser l'établissement bloqué.
      const identifiants = res?.temporary_password
        ? `\n\nIdentifiants à transmettre :\n${request.contact_email}\n${res.temporary_password}\n\nRappelez-lui qu'il devra le changer à la première connexion.`
        : '';
      Alert.alert(
        'Approuvé, mais email non envoyé',
        `${request.establishment_name} est en ligne${res?.account_created === false ? ' (le compte existait déjà)' : ''}. ${res?.email_error ?? "L'email n'a pas pu être envoyé."}${identifiants}`,
      );
    }

    setSelected(null);
    fetchRequests();
  }

  async function handleReject() {
    if (!selected || !profile?.id) return;
    setProcessing(true);

    await supabase.from('partner_requests').update({
      status: 'rejected',
      rejection_reason: rejectReason || 'Non précisé',
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', selected.id);

    await supabase.from('admin_activity_log').insert({
      actor_id: profile.id,
      action: 'partner_request_rejected',
      target_type: 'partner_request',
      target_id: selected.id,
      details: { establishment_name: selected.establishment_name, reason: rejectReason },
    });

    setProcessing(false);
    setRejecting(false);
    setRejectReason('');
    setSelected(null);
    fetchRequests();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Demandes de partenariat</Text>
          <Text style={styles.headerSub}>{requests.length} demande{requests.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.body, isMobile && styles.bodyMobile]}>
        {/* Liste — cachée sur mobile quand un élément est sélectionné */}
        {(!isMobile || !selected) && (
          <ScrollView style={[styles.list, isMobile && styles.listMobile]} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={colors.lave} style={{ marginTop: 30 }} />
            ) : requests.length === 0 ? (
              <View style={styles.empty}>
                <Store size={32} color={colors.borderStrong} />
                <Text style={styles.emptyText}>Aucune demande dans cette catégorie.</Text>
              </View>
            ) : (
              <View style={{ gap: 8, padding: 14 }}>
                {requests.map(r => (
                  <Pressable
                    key={r.id}
                    style={[styles.listCard, selected?.id === r.id && styles.listCardActive]}
                    onPress={() => { setSelected(r); setRejecting(false); }}
                  >
                    <View style={[styles.listIcon, { backgroundColor: categoryColors[r.establishment_type]?.soft ?? colors.laveSoft }]}>
                      <TypeIcon type={r.establishment_type} size={16} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.listName} numberOfLines={1}>{r.establishment_name}</Text>
                      <Text style={styles.listMeta}>
                        {TYPE_LABELS[r.establishment_type]} · {new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <StatusBadge status={r.status} />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Détail — plein écran sur mobile, avec bouton retour */}
        {(!isMobile || selected) && (
          <View style={styles.detail}>
            {!selected ? (
              <View style={styles.detailEmpty}>
                <Store size={40} color={colors.borderStrong} />
                <Text style={styles.detailEmptyText}>Sélectionnez une demande pour voir le détail</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                {isMobile && (
                  <Pressable style={styles.backToListBtn} onPress={() => setSelected(null)}>
                    <ArrowLeft size={15} color={colors.lave} />
                    <Text style={styles.backToListText}>Retour à la liste</Text>
                  </Pressable>
                )}
                <View style={styles.detailHeader}>
                  <View style={[styles.detailIcon, { backgroundColor: categoryColors[selected.establishment_type]?.soft ?? colors.laveSoft }]}>
                    <TypeIcon type={selected.establishment_type} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{selected.establishment_name}</Text>
                    <Text style={styles.detailDate}>
                      Soumis le {new Date(selected.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                  <StatusBadge status={selected.status} />
                </View>

                {/* Type bien visible */}
                <View style={[styles.typeBanner, { backgroundColor: categoryColors[selected.establishment_type]?.soft ?? colors.warningSoft }]}>
                <TypeIcon type={selected.establishment_type} size={15} />
                <Text style={[styles.typeBannerText, { color: categoryColors[selected.establishment_type]?.accent ?? colors.lave }]}>
                  Type d'établissement : <Text style={{ fontWeight: '500' }}>{TYPE_LABELS[selected.establishment_type]}</Text>
                </Text>
              </View>

              {/* Photos */}
              <Text style={styles.sectionLabel}>Photos soumises</Text>
              <View style={styles.photosRow}>
                {selected.photo_urls.length === 0 ? (
                  <View style={styles.photoPlaceholder}>
                    <Camera size={18} color={colors.faint} />
                  </View>
                ) : (
                  selected.photo_urls.map((url, i) => (
                    <View key={i} style={styles.photoPlaceholder}>
                      <Camera size={18} color={colors.faint} />
                    </View>
                  ))
                )}
              </View>

              {/* Description */}
              {selected.description && (
                <>
                  <Text style={styles.sectionLabel}>Description soumise</Text>
                  <View style={styles.descBox}>
                    <Text style={styles.descText}>{selected.description}</Text>
                  </View>
                </>
              )}

              {/* Localisation */}
              <Text style={styles.sectionLabel}>Localisation</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Commune</Text>
                  <Text style={styles.infoValue}>{selected.commune ?? '—'}</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Quartier</Text>
                  <Text style={styles.infoValue}>{selected.neighborhood ?? '—'}</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Avenue / numéro</Text>
                  <Text style={styles.infoValue}>{selected.avenue ?? '—'} {selected.numero ?? ''}</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Référence</Text>
                  <Text style={styles.infoValue}>{selected.reference ?? '—'}</Text>
                </View>
              </View>

              {/* Responsable */}
              <Text style={styles.sectionLabel}>Responsable</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Nom</Text>
                  <Text style={styles.infoValue}>{selected.contact_name}</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Téléphone</Text>
                  <Text style={styles.infoValue}>{selected.contact_phone}</Text>
                </View>
                <View style={[styles.infoBox, { flex: 2 }]}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{selected.contact_email ?? '—'}</Text>
                </View>
              </View>

              {selected.status === 'rejected' && selected.rejection_reason && (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionLabel}>Motif du refus</Text>
                  <Text style={styles.rejectionText}>{selected.rejection_reason}</Text>
                </View>
              )}

              {/* Actions */}
              {selected.status === 'pending' && (
                <>
                  {!rejecting ? (
                    <View style={styles.actionsRow}>
                      <Pressable
                        style={[styles.approveBtn, processing && { opacity: 0.6 }]}
                        onPress={() => handleApprove(selected)}
                        disabled={processing}
                      >
                        {processing
                          ? <ActivityIndicator color={colors.cream} size="small" />
                          : <><Check size={15} color={colors.cream} /><Text style={styles.approveBtnText}>Approuver</Text></>}
                      </Pressable>
                      <Pressable style={styles.rejectBtn} onPress={() => setRejecting(true)}>
                        <X size={15} color={colors.danger} />
                        <Text style={styles.rejectBtnText}>Refuser</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.rejectForm}>
                      <Text style={styles.sectionLabel}>Motif du refus (optionnel)</Text>
                      <TextInput
                        style={styles.rejectInput}
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        placeholder="Ex : photos manquantes, informations incomplètes..."
                        placeholderTextColor={colors.faint}
                        multiline
                      />
                      <View style={styles.actionsRow}>
                        <Pressable
                          style={[styles.rejectConfirmBtn, processing && { opacity: 0.6 }]}
                          onPress={handleReject}
                          disabled={processing}
                        >
                          {processing
                            ? <ActivityIndicator color={colors.cream} size="small" />
                            : <Text style={styles.approveBtnText}>Confirmer le refus</Text>}
                        </Pressable>
                        <Pressable style={styles.cancelBtn} onPress={() => setRejecting(false)}>
                          <Text style={styles.cancelBtnText}>Annuler</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    paddingHorizontal: 20, paddingBottom: 10,
  },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: 2, },
  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  filterPillActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  filterText: { ...typography.captionSm, color: colors.muted, },
  filterTextActive: { color: colors.cream, fontWeight: '500' },
  body: { flex: 1, flexDirection: 'row' },
  bodyMobile: { flexDirection: 'column' },
  list: { width: 320, borderRightWidth: 1, borderRightColor: colors.border },
  listMobile: { width: '100%', borderRightWidth: 0 },
  backToListBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backToListText: { ...typography.pillLabel, color: colors.lave, },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { ...typography.bodyXs, color: colors.muted, },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  listCardActive: { borderColor: colors.lave, backgroundColor: colors.laveSoft },
  listIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listName: { ...typography.caption, color: colors.ink, },
  listMeta: { ...typography.captionSm, color: colors.muted, marginTop: 1, },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { ...typography.captionMd, },
  detail: { flex: 1 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  detailEmptyText: { ...typography.bodySm, color: colors.muted, },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  detailIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  detailName: { ...typography.titleSm, color: colors.ink, },
  detailDate: { ...typography.captionSm, color: colors.muted, marginTop: 2, },
  typeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 11, marginBottom: 16 },
  typeBannerText: { ...typography.bodyXs, },
  sectionLabel: { ...typography.captionMd, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7, marginTop: 4, },
  photosRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  photoPlaceholder: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  descBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 14 },
  descText: { ...typography.bodyXs, color: colors.ink, },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  infoBox: { flex: 1, minWidth: 130, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9 },
  infoLabel: { ...typography.captionSm, color: colors.faint, },
  infoValue: { ...typography.bodyXs, color: colors.ink, marginTop: 2, },
  rejectionBox: { backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 12, marginBottom: 14 },
  rejectionLabel: { ...typography.captionMd, color: colors.danger, marginBottom: 4, },
  rejectionText: { ...typography.bodyXs, color: colors.danger, },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.success, borderRadius: 10, paddingVertical: 12 },
  approveBtnText: { ...typography.pillLabel, color: colors.cream, },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, paddingVertical: 12 },
  rejectBtnText: { ...typography.bodySm, color: colors.danger, },
  rejectForm: { marginTop: 4 },
  rejectInput: { ...typography.bodySm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.ink, height: 80, textAlignVertical: 'top', marginBottom: 12, },
  rejectConfirmBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderRadius: 10, paddingVertical: 12 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, paddingVertical: 12 },
  cancelBtnText: { ...typography.bodySm, color: colors.ink, },
});