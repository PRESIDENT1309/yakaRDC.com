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
import { ecrire } from '../../lib/db';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, typography, radii, spacing } from '../../lib/theme';
import type { PartnerRequest, EstablishmentType, PartnerRequestStatus } from '../../lib/types';
import { useAdminResponsive } from '../../lib/responsive';

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
  // Largeur utile, barre laterale de l'admin deduite : la fenetre seule
  // faisait croire a une vue bureau alors que le detail etait ecrase.
  const { isMobile } = useAdminResponsive();
  const [requests, setRequests] = useState<PartnerRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PartnerRequest | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [resending, setResending] = useState(false);
  // Compté sur toute la table, indépendamment du filtre affiché : c'est
  // justement parce que ce chiffre était masqué par le filtre « en attente »
  // qu'un partenaire sans accès pouvait passer inaperçu.
  const [sansAcces, setSansAcces] = useState(0);

  /**
   * Renvoi des accès à un partenaire dont l'email d'approbation n'est jamais
   * parti.
   *
   * On passe par `request-password-reset` plutôt que par un nouveau mot de
   * passe : la fonction existe, elle est éprouvée, et elle envoie un lien à
   * usage unique. Cela couvre aussi le cas du compte préexistant, où il n'y a
   * aucun mot de passe à communiquer.
   */
  async function handleResendCredentials() {
    if (!selected?.contact_email) return;
    setResending(true);

    const { data, error } = await supabase.functions.invoke('request-password-reset', {
      body: { email: selected.contact_email },
    });
    setResending(false);

    // `request-password-reset` répond TOUJOURS 200, délibérément : révéler
    // qu'une adresse est inconnue permettrait d'énumérer les comptes. L'échec
    // d'envoi vit donc dans le corps, sous `email_error` — pas dans `error`,
    // qui ne signale que les pannes de transport.
    //
    // Ne regarder que `error` revenait à annoncer « Lien envoyé » et à marquer
    // la demande résolue alors que le service d'envoi avait refusé : une panne
    // déguisée en succès, exactement ce que cette trace existe pour empêcher.
    const echec = error?.message
      ?? (data as { email_error?: string; error?: string } | null)?.email_error
      ?? (data as { error?: string } | null)?.error;

    if (echec) {
      await supabase.from('partner_requests').update({
        credentials_sent: false,
        credentials_error: echec,
        credentials_sent_at: new Date().toISOString(),
      }).eq('id', selected.id);

      Alert.alert('Renvoi refusé', echec);
      fetchRequests();
      return;
    }

    await supabase.from('partner_requests').update({
      credentials_sent: true,
      credentials_error: null,
      credentials_sent_at: new Date().toISOString(),
    }).eq('id', selected.id);

    Alert.alert(
      'Lien envoyé',
      `${selected.contact_email} peut désormais définir son mot de passe et accéder à son espace.`,
    );
    setSelected(null);
    fetchRequests();
  }

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('partner_requests').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setRequests((data as PartnerRequest[]) ?? []);

    // Requête séparée, sur toute la table : le bandeau d'alerte ne doit pas
    // dépendre du filtre affiché. `credentials_sent is not true` couvre les
    // deux cas qui comptent — l'envoi refusé (false) et l'approbation
    // antérieure au suivi (null), dont on ignore le sort.
    const { count } = await supabase.from('partner_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .or('credentials_sent.is.null,credentials_sent.is.false');
    setSansAcces(count ?? 0);

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

    // Un refus non enregistré laisse la demande en attente : la fermer à
    // l'écran et la journaliser ferait croire le dossier traité alors qu'il
    // resterait dans la file, sans que personne n'y revienne.
    const refuse = await ecrire(
      supabase.from('partner_requests').update({
        status: 'rejected',
        rejection_reason: rejectReason || 'Non précisé',
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', selected.id),
      'Refus de la demande',
    );
    if (!refuse) { setProcessing(false); return; }

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

      {/* ── Partenaires approuvés sans accès ──
          L'alerte posée sur les fiches ne servait à rien : elle vivait dans la
          liste des demandes APPROUVÉES, alors que l'écran s'ouvre sur les
          demandes EN ATTENTE. Un partenaire injoignable restait donc invisible
          derrière un filtre qu'on n'a aucune raison de changer.
          Ce bandeau est indépendant du filtre courant : il compte sur toute la
          table, et mène directement aux concernés. */}
      {sansAcces > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${sansAcces} partenaire${sansAcces > 1 ? 's' : ''} sans accès`}
          style={styles.alerteBand}
          onPress={() => setFilter('approved')}
        >
          <Text style={styles.alerteTitle}>
            {sansAcces > 1
              ? `${sansAcces} partenaires approuvés n'ont pas reçu leurs identifiants`
              : "1 partenaire approuvé n'a pas reçu ses identifiants"}
          </Text>
          <Text style={styles.alerteSub}>
            {sansAcces > 1
              ? 'Leur établissement est en ligne, mais ils ne peuvent pas y accéder. Toucher pour les voir.'
              : 'Son établissement est en ligne, mais il ne peut pas y accéder. Toucher pour le voir.'}
          </Text>
        </Pressable>
      )}

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
              <View style={{ gap: spacing.sm, padding: spacing.v14 }}>
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
                      {/* Un établissement approuvé dont le propriétaire n'a
                          jamais reçu ses accès est en ligne et injoignable.
                          Cet état doit se voir dans la liste, pas se déduire. */}
                      {r.status === 'approved' && r.credentials_sent !== true && (
                        <Text style={styles.listAlerte} numberOfLines={1}>
                          {r.credentials_sent === false
                            ? 'Identifiants non envoyés'
                            : 'Envoi non tracé'}
                        </Text>
                      )}
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
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.v20 }}>
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

              {/* ── Identifiants non parvenus ──
                  L'établissement est en ligne, son propriétaire ne peut pas y
                  accéder, et jusqu'ici rien ne le signalait passé la boîte de
                  dialogue de l'approbation. Le renvoi passe par le lien de
                  définition de mot de passe : plus sûr qu'un mot de passe en
                  clair, et cela fonctionne aussi quand le compte préexistait. */}
              {/* `!== true` et non `=== false` : les demandes approuvées avant
                  la migration 0019 ont `credentials_sent` à null. Ce sont
                  précisément celles dont on ignore le sort — donc celles qui
                  ont le plus besoin d'un renvoi. Les exclure aurait vidé cette
                  fonctionnalité de son objet. */}
              {selected.status === 'approved' && selected.credentials_sent !== true && (
                <View style={styles.credsBox}>
                  <Text style={styles.credsTitle}>
                    {selected.credentials_sent === false
                      ? 'Identifiants non envoyés'
                      : 'Envoi des identifiants non tracé'}
                  </Text>
                  {selected.credentials_error ? (
                    <Text style={styles.credsError}>{selected.credentials_error}</Text>
                  ) : selected.credentials_sent === null ? (
                    <Text style={styles.credsError}>
                      Cette approbation est antérieure au suivi des envois : impossible de
                      savoir si le partenaire a reçu ses accès.
                    </Text>
                  ) : null}
                  <Text style={styles.credsHint}>
                    {selected.contact_email
                      ? `Dans le doute, ${selected.contact_email} peut recevoir un nouveau lien.`
                      : "Aucune adresse de contact sur cette demande : le renvoi est impossible."}
                  </Text>
                  {!!selected.contact_email && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Renvoyer les identifiants"
                      style={[styles.credsBtn, resending && { opacity: 0.6 }]}
                      onPress={handleResendCredentials}
                      disabled={resending}
                    >
                      {resending
                        ? <ActivityIndicator color={colors.cream} size="small" />
                        : <Text style={styles.credsBtnText}>Renvoyer un lien de connexion</Text>}
                    </Pressable>
                  )}
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
    paddingHorizontal: spacing.v20, paddingBottom: spacing.v10,
  },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  filterRow: { flexDirection: 'row', gap: spacing.v6, paddingHorizontal: spacing.v20, paddingBottom: spacing.v12, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterPill: { paddingHorizontal: spacing.v12, paddingVertical: spacing.v6, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  filterPillActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  filterText: { ...typography.captionSm, color: colors.muted, },
  filterTextActive: { color: colors.cream, fontWeight: '500' },
  body: { flex: 1, flexDirection: 'row' },
  bodyMobile: { flexDirection: 'column' },
  list: { width: 320, borderRightWidth: 1, borderRightColor: colors.border },
  listMobile: { width: '100%', borderRightWidth: 0 },
  backToListBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.v6, marginBottom: spacing.md },
  backToListText: { ...typography.pillLabel, color: colors.lave, },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.v10 },
  emptyText: { ...typography.bodyXs, color: colors.muted, },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.v10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.v10, padding: spacing.v10 },
  listCardActive: { borderColor: colors.lave, backgroundColor: colors.laveSoft },
  listIcon: { width: 32, height: 32, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listName: { ...typography.caption, color: colors.ink, },
  listMeta: { ...typography.captionSm, color: colors.muted, marginTop: 1, },
  listAlerte: { ...typography.captionSm, color: colors.warning, marginTop: spacing.v2 },

  // Bandeau au-dessus des filtres : le seul endroit où un partenaire sans
  // accès reste visible quel que soit le filtre choisi.
  alerteBand: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1, borderColor: colors.warningBorder,
    borderRadius: radii.md, paddingHorizontal: spacing.v14, paddingVertical: spacing.v12,
    marginHorizontal: spacing.v20, marginTop: spacing.v12, gap: 3,
  },
  alerteTitle: { ...typography.titleSm, color: colors.warning },
  alerteSub: { ...typography.captionSm, color: colors.warning },

  // ── Bloc « identifiants non parvenus » ──
  // Famille `warning` : un partenaire injoignable est un travail à reprendre,
  // pas une erreur du système. Contraste warning sur warningSoft : 5,87.
  credsBox: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1, borderColor: colors.warningBorder,
    borderRadius: radii.md, padding: spacing.v14, marginTop: spacing.v14, gap: spacing.v6,
  },
  credsTitle: { ...typography.titleSm, color: colors.warning },
  credsError: { ...typography.bodyXs, color: colors.warning },
  credsHint: { ...typography.captionSm, color: colors.muted },
  credsBtn: {
    backgroundColor: colors.warning, borderRadius: radii.v10,
    paddingVertical: 11, alignItems: 'center', marginTop: spacing.xs,
  },
  credsBtnText: { ...typography.pillLabel, color: colors.cream },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.pill },
  statusBadgeText: { ...typography.captionMd, },
  detail: { flex: 1 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.v12 },
  detailEmptyText: { ...typography.bodySm, color: colors.muted, },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, marginBottom: spacing.v14 },
  detailIcon: { width: 46, height: 46, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  detailName: { ...typography.titleSm, color: colors.ink, },
  detailDate: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  typeBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.v10, padding: 11, marginBottom: spacing.md },
  typeBannerText: { ...typography.bodyXs, },
  sectionLabel: { ...typography.captionMd, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7, marginTop: spacing.xs, },
  photosRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.v14 },
  photoPlaceholder: { width: 56, height: 56, borderRadius: radii.sm, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  descBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.v10, padding: spacing.v12, marginBottom: spacing.v14 },
  descText: { ...typography.bodyXs, color: colors.ink, },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.v14 },
  infoBox: { flex: 1, minWidth: 130, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 9 },
  infoLabel: { ...typography.captionSm, color: colors.faint, },
  infoValue: { ...typography.bodyXs, color: colors.ink, marginTop: spacing.v2, },
  rejectionBox: { backgroundColor: colors.dangerSoft, borderRadius: radii.v10, padding: spacing.v12, marginBottom: spacing.v14 },
  rejectionLabel: { ...typography.captionMd, color: colors.danger, marginBottom: spacing.xs, },
  rejectionText: { ...typography.bodyXs, color: colors.danger, },
  actionsRow: { flexDirection: 'row', gap: spacing.v10, marginTop: spacing.v6 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.success, borderRadius: radii.v10, paddingVertical: spacing.v12 },
  approveBtnText: { ...typography.pillLabel, color: colors.cream, },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.v10, paddingVertical: spacing.v12 },
  rejectBtnText: { ...typography.bodySm, color: colors.danger, },
  rejectForm: { marginTop: spacing.xs },
  rejectInput: { ...typography.bodySm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.v10, padding: spacing.v12, color: colors.ink, height: 80, textAlignVertical: 'top', marginBottom: spacing.v12, },
  rejectConfirmBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderRadius: radii.v10, paddingVertical: spacing.v12 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.v10, paddingVertical: spacing.v12 },
  cancelBtnText: { ...typography.bodySm, color: colors.ink, },
});