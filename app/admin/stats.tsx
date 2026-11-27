import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { TrendingUp, Users, Award, BarChart3 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, typography, radii, spacing, fonts, breakpoints, cible } from '../../lib/theme';
import type { EstablishmentType } from '../../lib/types';
import { etatBascule } from '../../lib/a11y';

type Period = 'day' | 'week' | 'month' | 'year';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Année' },
];

const CATEGORY_LABELS: Record<EstablishmentType, string> = {
  hotel: 'Hôtels',
  furnished_house: 'Maisons',
  restaurant: 'Restaurants',
  site: 'Sites',
};

const CATEGORY_COLORS: Record<EstablishmentType, string> = {
  hotel: colors.lave,
  furnished_house: colors.fleuve,
  restaurant: colors.warning,
  site: colors.success,
};

function periodStart(period: Period): Date {
  const d = new Date();
  if (period === 'day') { d.setHours(0, 0, 0, 0); }
  else if (period === 'week') { d.setDate(d.getDate() - 7); }
  else if (period === 'month') { d.setMonth(d.getMonth() - 1); }
  else { d.setFullYear(d.getFullYear() - 1); }
  return d;
}

export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [totalBookings, setTotalBookings] = useState(0);
  const [confirmationRate, setConfirmationRate] = useState(0);
  const [newSignups, setNewSignups] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ type: EstablishmentType; count: number; pct: number }[]>([]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const since = periodStart(period).toISOString();

    const [{ data: bookings }, { count: signups }] = await Promise.all([
      supabase.from('bookings').select('status, establishment:establishments(type)').gte('created_at', since),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ]);

    const all = bookings ?? [];
    setTotalBookings(all.length);
    const confirmedOrBetter = all.filter((b: any) => ['confirmed', 'checked_in'].includes(b.status)).length;
    setConfirmationRate(all.length > 0 ? Math.round((confirmedOrBetter / all.length) * 100) : 0);
    setNewSignups(signups ?? 0);

    const counts: Record<string, number> = {};
    all.forEach((b: any) => {
      const t = b.establishment?.type;
      if (t) counts[t] = (counts[t] ?? 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const breakdown = (Object.keys(counts) as EstablishmentType[]).map(type => ({
      type, count: counts[type], pct: Math.round((counts[type] / total) * 100),
    })).sort((a, b) => b.count - a.count);
    setCategoryBreakdown(breakdown);

    setLoading(false);
  }, [period]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Statistiques</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* La pastille visible garde sa taille ; c'est la zone qui l'entoure
            qui atteint 44 px. */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => {
            const actif = period === p.key;
            return (
              <Pressable
                key={p.key}
                style={styles.periodZone}
                accessibilityRole="button"
                {...etatBascule(actif)}
                onPress={() => setPeriod(p.key)}
              >
                <View style={[styles.periodPill, actif && styles.periodPillActive]}>
                  <Text style={[styles.periodText, actif && styles.periodTextActive]}>{p.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {loading ? <ActivityIndicator color={colors.lave} style={{ marginTop: 30 }} /> : (
          <>
            <View style={styles.statsGrid}>
              {/* Cartes locales, et non StatCard : sur téléphone ces libellés
                  passent sur deux lignes, et StatCard ne centre pas un texte
                  qui revient à la ligne. Chiffre et libellé sont lus ensemble. */}
              <View style={styles.bigCard} accessible accessibilityLabel={`${totalBookings}, Réservations`}>
                <BarChart3 size={18} color={colors.lave} />
                <Text style={styles.bigValue}>{totalBookings}</Text>
                <Text style={styles.bigLabel}>Réservations</Text>
              </View>
              <View style={styles.bigCard} accessible accessibilityLabel={`${confirmationRate} %, Taux confirmation`}>
                <TrendingUp size={18} color={colors.success} />
                <Text style={[styles.bigValue, { color: colors.success }]}>{confirmationRate}%</Text>
                <Text style={styles.bigLabel}>Taux confirmation</Text>
              </View>
              <View style={styles.bigCard} accessible accessibilityLabel={`${newSignups}, Nouveaux inscrits`}>
                <Users size={18} color={colors.warning} />
                <Text style={[styles.bigValue, { color: colors.warning }]}>{newSignups}</Text>
                <Text style={styles.bigLabel}>Nouveaux inscrits</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>Répartition par catégorie</Text>
              {categoryBreakdown.length === 0 ? (
                <Text style={styles.emptyText}>Aucune réservation sur cette période.</Text>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.v12 }}>
                  {categoryBreakdown.map(c => (
                    // Une ligne, une annonce : la barre seule ne se lit pas.
                    <View key={c.type} style={styles.barRow} accessible accessibilityLabel={`${CATEGORY_LABELS[c.type]} : ${c.pct} %`}>
                      <Text style={styles.barLabel}>{CATEGORY_LABELS[c.type]}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${c.pct}%`, backgroundColor: CATEGORY_COLORS[c.type] }]} />
                      </View>
                      <Text style={styles.barPct}>{c.pct}%</Text>
                    </View>
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
  // Meme largeur que le contenu : sans cela, le filet du bas et les actions
  // de droite depassaient la colonne de plusieurs centaines de pixels.
  // La colonne est centrée : calée à gauche, elle laissait sur grand écran tout
  // le vide du même côté. La zone sûre, elle, est dégagée par le layout de l'admin.
  header: { maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center', paddingTop: spacing.md, paddingHorizontal: spacing.v20, paddingBottom: spacing.v12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  content: { padding: spacing.v20, gap: spacing.v12, width: '100%', maxWidth: breakpoints.panelMax, alignSelf: 'center' },
  periodRow: { flexDirection: 'row', gap: spacing.sm },
  // Le surplus de la zone tactile est repris en marge négative : la rangée
  // garde la hauteur de ses pastilles (texte de 17, retraits de 8, filet).
  periodZone: { minHeight: cible.min, justifyContent: 'center', marginVertical: -(cible.min - 35) / 2 },
  periodPill: { paddingHorizontal: spacing.v12, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  periodPillActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  periodText: { ...typography.bodyXs, color: colors.muted, },
  periodTextActive: { color: colors.cream, fontFamily: fonts.sansMedium },
  statsGrid: { flexDirection: 'row', gap: spacing.v12 },
  bigCard: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12, alignItems: 'center', gap: spacing.sm },
  bigValue: { ...typography.titleLg, color: colors.ink, },
  bigLabel: { ...typography.captionSm, color: colors.muted, textAlign: 'center', },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  cardTitle: { ...typography.pillLabel, color: colors.ink, },
  emptyText: { ...typography.bodyXs, color: colors.muted, marginTop: spacing.v12, },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12 },
  barLabel: { ...typography.captionSm, width: 80, color: colors.muted, },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.surfaceSunken, borderRadius: radii.v4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radii.v4 },
  barPct: { ...typography.captionSm, width: 36, color: colors.ink, textAlign: 'right', },
});