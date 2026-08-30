import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, typography } from '../lib/theme';
import type { Booking } from '../lib/types';

export interface StatusBadgeProps {
  status: Booking['status'];
}

// Pastille de statut de réservation — extraite de app/(tabs)/bookings.tsx,
// où Planner (onglet Réservations) dupliquait la même logique à 3 états
// (confirmé/en attente/refusé) en plus superficiel (pas de distinction
// checked_in/cancelled). Source unique pour les 5 états de Booking['status'].
// checked_in et cancelled restent hors des jetons success/warning/danger —
// ce ne sont ni des succès ni des alertes au même titre qu'une confirmation.
export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    pending: { label: 'En attente', bg: colors.warningSoft, color: colors.warning },
    confirmed: { label: 'Confirmée', bg: colors.successSoft, color: colors.success },
    checked_in: { label: 'Utilisée', bg: colors.fleuveSoft, color: colors.fleuveDark },
    rejected: { label: 'Refusée', bg: colors.dangerSoft, color: colors.danger },
    cancelled: { label: 'Annulée', bg: colors.surfaceSunken, color: colors.faint },
  };
  const c = config[status] ?? config.pending;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill },
  badgeText: { ...typography.captionMd, },
});
