import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Check, X, UserCog, Store, History as HistoryIcon } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { AdminActivityLog } from '../../lib/types';

const ACTION_CONFIG: Record<string, { icon: (c: string) => React.ReactNode; bg: string; color: string }> = {
  establishment_approved:       { icon: c => <Check size={13} color={c} />, bg: '#DCEEE3', color: '#1F4D3A' },
  partner_request_approved:     { icon: c => <Check size={13} color={c} />, bg: '#DCEEE3', color: '#1F4D3A' },
  partner_request_rejected:     { icon: c => <X size={13} color={c} />, bg: '#FFF0F0', color: '#C0392B' },
  role_changed:                 { icon: c => <UserCog size={13} color={c} />, bg: '#FAECE7', color: '#712B13' },
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
        <Text style={styles.headerTitle}>Historique d'activité</Text>
        <Text style={styles.headerSub}>{logs.length} action{logs.length !== 1 ? 's' : ''} enregistrée{logs.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.lave} style={{ marginTop: 30 }} /> : logs.length === 0 ? (
          <View style={styles.empty}>
            <HistoryIcon size={32} color={colors.borderStrong} />
            <Text style={styles.emptyText}>Aucune action enregistrée pour le moment.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {logs.map((log, i) => {
              const cfg = ACTION_CONFIG[log.action] ?? { icon: (c: string) => <Check size={13} color={c} />, bg: '#F5F4F0', color: colors.muted };
              return (
                <View key={log.id} style={[styles.row, i !== logs.length - 1 && styles.rowBorder]}>
                  <View style={[styles.icon, { backgroundColor: cfg.bg }]}>{cfg.icon(cfg.color)}</View>
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
  header: { paddingTop: Platform.OS === 'web' ? 16 : 50, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 16, fontWeight: '500', color: colors.ink },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  content: { padding: 20, maxWidth: 700 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 12, color: colors.muted },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F4F0' },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowText: { fontSize: 12.5, color: colors.ink },
  rowDate: { fontSize: 10.5, color: colors.faint, marginTop: 2 },
});