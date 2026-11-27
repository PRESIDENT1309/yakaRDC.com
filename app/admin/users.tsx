import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, Modal, } from 'react-native';
import { Alert } from '../../lib/alert';
import { Search, ChevronRight, X, Check } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { ecrire } from '../../lib/db';
import { useAuth } from '../../lib/auth-context';
import { colors, typography, radii, spacing, fonts, breakpoints, cible } from '../../lib/theme';
import type { Profile, UserRole } from '../../lib/types';
import BoutonIcone from '../../components/BoutonIcone';

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; color: string }> = {
  traveler: { label: 'Voyageur', bg: colors.fleuveSoft, color: colors.fleuveDark },
  partner:  { label: 'Partenaire', bg: colors.laveSoft, color: colors.lave },
  admin:    { label: 'Admin', bg: colors.chrome, color: colors.cream },
};

export default function UsersScreen() {
  const { profile: currentAdmin } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [bookingCount, setBookingCount] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (query.trim()) {
      q = q.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
    }
    const { data } = await q.limit(100);
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  async function openDetail(u: Profile) {
    setSelected(u);
    const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('traveler_id', u.id);
    setBookingCount(count ?? 0);
  }

  async function changeRole(newRole: UserRole) {
    if (!selected || !currentAdmin?.id) return;
    // Le journal d'audit ne doit consigner que des changements réels : si la
    // base refuse la promotion, l'enregistrer laisserait une trace mensongère
    // dans l'historique, et l'écran afficherait un rôle que l'utilisateur n'a pas.
    const applique = await ecrire(
      supabase.from('profiles').update({ role: newRole }).eq('id', selected.id),
      'Changement de rôle',
    );
    if (!applique) return;
    await supabase.from('admin_activity_log').insert({
      actor_id: currentAdmin.id,
      action: 'role_changed',
      target_type: 'profile',
      target_id: selected.id,
      details: { email: selected.email, new_role: newRole, old_role: selected.role },
    });
    setSelected({ ...selected, role: newRole });
    fetchUsers();
  }

  function confirmSuspend() {
    if (!selected) return;
    // Ce bouton demandait une confirmation, puis répondait par une note
    // technique en jargon (« Edge Function avec service_role ») : il laissait
    // croire à une suspension qui n'existe pas encore. Il dit maintenant la
    // vérité d'emblée, et ce qu'on peut faire en attendant.
    Alert.alert(
      'Suspension non disponible',
      "La suspension d'un compte n'est pas encore disponible. En attendant, vous pouvez "
      + 'changer son rôle ci-dessus, ou suspendre ses établissements depuis « Établissements ».',
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Utilisateurs</Text>
          <Text style={styles.headerSub}>{users.length} compte{users.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.searchBox}>
          <Search size={13} color={colors.faint} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un nom, email, téléphone..."
            placeholderTextColor={colors.faint}
            accessibilityLabel="Rechercher un utilisateur par nom, email ou téléphone"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? <ActivityIndicator color={colors.lave} style={{ marginTop: 30 }} /> : (
          users.map(u => {
            const r = ROLE_CONFIG[u.role];
            return (
              <Pressable key={u.id} style={styles.row} accessibilityRole="button" onPress={() => openDetail(u)}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(u.full_name ?? u.email ?? 'U').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{u.full_name ?? 'Sans nom'}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>{u.email ?? u.phone}</Text>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: r.bg }]}>
                  <Text style={[styles.roleBadgeText, { color: r.color }]}>{r.label}</Text>
                </View>
                <ChevronRight size={14} color={colors.borderStrong} />
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} accessibilityRole="header" aria-level={2}>Fiche utilisateur</Text>
                  <BoutonIcone label="Fermer la fiche" taille={18} onPress={() => setSelected(null)} icon={<X size={18} color={colors.muted} />} />
                </View>

                <View style={styles.modalProfileRow}>
                  <View style={[styles.avatar, { width: 48, height: 48, borderRadius: radii.lg }]}>
                    <Text style={[styles.avatarText, { fontSize: 18 }]}>{(selected.full_name ?? selected.email ?? 'U').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalName}>{selected.full_name ?? 'Sans nom'}</Text>
                    <Text style={styles.modalEmail}>{selected.email ?? selected.phone}</Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Inscrit le</Text>
                    <Text style={styles.infoValue}>{new Date(selected.created_at).toLocaleDateString('fr-FR')}</Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Réservations faites</Text>
                    <Text style={styles.infoValue}>{bookingCount}</Text>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Changer le rôle</Text>
                {/* Un choix parmi trois : annoncé comme tel, avec l'option en cours. */}
                <View style={styles.roleOptions} accessibilityRole="radiogroup" accessibilityLabel="Changer le rôle">
                  {(['traveler', 'partner', 'admin'] as UserRole[]).map(r => (
                    <Pressable
                      key={r}
                      style={styles.roleZone}
                      accessibilityRole="radio"
                      aria-checked={selected.role === r}
                      onPress={() => changeRole(r)}
                    >
                      <View style={[styles.roleOption, selected.role === r && styles.roleOptionActive]}>
                        {selected.role === r && <Check size={12} color={colors.lave} />}
                        <Text style={[styles.roleOptionText, selected.role === r && styles.roleOptionTextActive]}>
                          {ROLE_CONFIG[r].label}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <Pressable style={styles.suspendBtn} accessibilityRole="button" onPress={confirmSuspend}>
                  <Text style={styles.suspendBtnText}>Suspendre ce compte</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  // Meme largeur que le contenu : sans cela, le filet du bas et les actions
  // de droite depassaient la colonne de plusieurs centaines de pixels.
  // La colonne est centrée : calée à gauche, elle laissait sur grand écran tout
  // le vide du même côté. La zone sûre, elle, est dégagée par le layout de l'admin.
  header: { maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center', paddingTop: spacing.md, paddingHorizontal: spacing.v20, paddingBottom: spacing.v12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.v12 },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderField, borderRadius: radii.sm, paddingHorizontal: spacing.v12, minHeight: cible.min, maxWidth: 360 },
  // La saisie occupe toute la hauteur de la barre (44 px) : un appui n'importe
  // où dans la barre tombe dans le champ.
  searchInput: { ...typography.bodyXs, flex: 1, alignSelf: 'stretch', color: colors.ink },
  list: { padding: spacing.v20, gap: spacing.sm, width: '100%', maxWidth: breakpoints.panelMax, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12 },
  avatar: { width: 36, height: 36, borderRadius: radii.lg, backgroundColor: colors.laveSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { ...typography.labelMd, color: colors.lave, },
  rowName: { ...typography.pillLabel, color: colors.ink, },
  rowMeta: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  roleBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.v2, borderRadius: radii.pill },
  roleBadgeText: { ...typography.captionMd, },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.v20 },
  modalBox: { backgroundColor: colors.cream, borderRadius: radii.v16, padding: spacing.v20, width: '100%', maxWidth: 380 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.v12 },
  modalTitle: { ...typography.sheetOption, color: colors.ink, },
  modalProfileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, marginBottom: spacing.md },
  modalName: { ...typography.sheetOption, color: colors.ink, },
  modalEmail: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  infoGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  infoBox: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: spacing.sm },
  infoLabel: { ...typography.captionSm, color: colors.faint, },
  infoValue: { ...typography.bodyXs, color: colors.ink, marginTop: spacing.v2, },
  sectionLabel: { ...typography.captionMd, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm, },
  roleOptions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  // Zone tactile de 44 px autour d'une option de 33 : la marge négative rend
  // à la rangée sa hauteur d'origine.
  roleZone: { flex: 1, minHeight: cible.min, justifyContent: 'center', marginVertical: -(cible.min - 33) / 2 },
  roleOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.sm, paddingVertical: spacing.sm },
  roleOptionActive: { borderColor: colors.lave, backgroundColor: colors.laveSoft },
  roleOptionText: { ...typography.captionSm, color: colors.muted, },
  roleOptionTextActive: { color: colors.lave, fontFamily: fonts.sansMedium },
  suspendBtn: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radii.md, paddingVertical: spacing.v12, alignItems: 'center', justifyContent: 'center', minHeight: cible.min },
  suspendBtnText: { ...typography.caption, color: colors.danger, },
});