import type { ReactNode } from 'react';
import { View, Text, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, typography, radii, spacing } from '../lib/theme';

export interface StatCardProps {
  /** Le chiffre, déjà mis en forme par l'appelant (« 12 », « 4,6 », « — »). */
  value: string | number;
  label: string;
  /** Précision sous le libellé (« sur 30 jours »). */
  sub?: string;
  icon?: ReactNode;
  /**
   * `clair` — carte blanche à filet, chiffre encre : listes et panneaux.
   * `plein` — aplat de couleur, texte crème : tableau de bord.
   */
  variante?: 'clair' | 'plein';
  /** Couleur de l'aplat (variante `plein`) ou du chiffre (variante `clair`). */
  couleur?: string;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}

/**
 * Carte de statistique : un chiffre, ce qu'il mesure, éventuellement sa période.
 *
 * Elle était réécrite dans chaque écran qui en avait besoin (tableau de bord
 * partenaire, fiche établissement côté pro, modération, vue d'ensemble admin),
 * avec des rayons, des graisses et des tailles légèrement différents.
 *
 * Pour un lecteur d'écran, la carte est UN élément : « 12, réservations
 * confirmées, sur 30 jours ». Lus séparément, le chiffre et son libellé sont
 * deux annonces sans lien.
 */
export default function StatCard({
  value, label, sub, icon, variante = 'clair', couleur, align = 'left', style,
}: StatCardProps) {
  const plein = variante === 'plein';
  const centre = align === 'center';
  return (
    <View
      accessible
      // Sur le web, un libellé posé sur un bloc sans rôle n'est pas lu.
      role={Platform.OS === 'web' ? 'group' : undefined}
      accessibilityLabel={[String(value), label, sub].filter(Boolean).join(', ')}
      style={[
        styles.carte,
        plein ? { backgroundColor: couleur ?? colors.lave } : styles.claire,
        centre && styles.centre,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.valeur, { color: plein ? colors.cream : couleur ?? colors.ink }]}>{value}</Text>
      <Text style={[styles.libelle, centre && styles.texteCentre, { color: plein ? colors.cream : colors.muted }]}>{label}</Text>
      {sub ? <Text style={[styles.precision, centre && styles.texteCentre, { color: plein ? colors.onBrandMuted : colors.faint }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radii.md, padding: spacing.v12, gap: spacing.v2 },
  claire: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  centre: { alignItems: 'center' },
  // `alignItems` centre le bloc, pas ses lignes : un libellé sur deux lignes
  // restait calé à gauche.
  texteCentre: { textAlign: 'center' },
  valeur: { ...typography.titleMd },
  libelle: { ...typography.captionSm },
  precision: { ...typography.captionSm },
});
