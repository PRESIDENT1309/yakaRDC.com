import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Check, X, UserCog, Store, History as HistoryIcon } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, typography, radii, spacing, breakpoints } from '../../lib/theme';
import type { AdminActivityLog } from '../../lib/types';
import EmptyState from '../../components/EmptyState';

// L'icône est posée nue, dans la couleur de l'action : la pastille de fond qui
// l'entourait n'ajoutait rien à ce que la couleur dit déjà.
const ACTION_CONFIG: Record<string, { icon: (c: string) => React.ReactNode; color: string }> = {
  establishment_approved:       { icon: c => <Check size={16} color={c} />, color: colors.success },
  partner_request_approved:     { icon: c => <Check size={16} color={c} />, color: colors.success },
  partner_request_rejected:     { icon: c => <X size={16} color={c} />, color: colors.danger },
  role_changed:                 { icon: c => <UserCog size={16} color={c} />, color: colors.lave },
};

function describeAction(log: AdminActivityLog): string {
  const name = log.details?.establishment_name ?? log.details?.email ?? '';
  switch (log.action) {
    case 'partner_request_approved':
      return `Demande de partenariat approuvée — ${name}`;
    case 'partner_request_rejected':
      return `Demande de partenariat refusée — ${name}${log.details?.reason ? ` (motif : ${log.details.reason})` : ''}`;
    case 'role_changed':
      return `Rôle de ${name} changé en ${log.details?.new_role ?? '—'}`;
    case 'establishment_approved':
      return `Établissement approuvé — ${name}`;
    default:
      return log.action;
  }
}

export default function HistoryScreen() {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs((data as AdminActivityLog[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Historique d'activité</Text>
        <Text style={styles.headerSub}>{logs.length} action{logs.length !== 1 ? 's' : ''} enregistrée{logs.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.lave} style={{ marginTop: 30 }} /> : logs.length === 0 ? (
          /* Sans action : ce journal se remplit tout seul à mesure que les
             administrateurs agissent. Rien à proposer, seulement à expliquer. */
          <EmptyState
            icon={<HistoryIcon size={44} color={colors.borderStrong} strokeWidth={1.75} />}
            title="Aucune action enregistrée"
            description="Les approbations, suspensions et changements de rôle apparaîtront ici, du plus récent au plus ancien."
          />
        ) : (
          <View style={styles.card}>
            {logs.map((log, i) => {
              const cfg = ACTION_CONFIG[log.action] ?? { icon: (c: string) => <Check size={16} color={c} />, color: colors.muted };
              return (
                <View key={log.id} style={[styles.row, i !== logs.length - 1 && styles.rowBorder]}>
                  {cfg.icon(cfg.color)}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText}>{describeAction(log)}</Text>
                    <Text style={styles.rowDate}>
                      {new Date(log.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  // Meme largeur que le contenu : sans cela, le filet du bas et les actions
  // de droite depassaient la colonne de plusieurs centaines de pixels.
  // La colonne est centrée : calée à gauche, elle laissait sur grand écran tout
  // le vide du même côté. La zone sûre, elle, est dégagée par le layout de l'admin.
  header: { maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center', paddingTop: spacing.md, paddingHorizontal: spacing.v20, paddingBottom: spacing.v12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  content: { padding: spacing.v20, width: '100%', maxWidth: breakpoints.panelMax, alignSelf: 'center' },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, padding: spacing.v12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceSunken },
  rowText: { ...typography.bodyXs, color: colors.ink, },
  rowDate: { ...typography.captionSm, color: colors.faint, marginTop: spacing.v2, },
});