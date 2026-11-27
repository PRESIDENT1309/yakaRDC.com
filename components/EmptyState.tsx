import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../lib/theme';
import Button from './Button';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Niveau du titre. 2 par défaut (l'état vide d'une liste, sous le titre de
   * l'écran) ; 1 quand l'état vide tient lieu d'écran entier.
   */
  niveau?: 1 | 2 | 3;
}

// Source officielle pour tout état vide. L'icône reste nue — jamais de
// cercle coloré générique autour (anti-pattern explicitement interdit par le
// Design System YakaRDC). icon est optionnelle : pour un état vide léger en
// ligne (ex. section vide sur l'accueil), on peut n'afficher qu'un titre —
// {icon} ne rend rien quand icon est absente, donc gap ne réserve pas
// d'espace pour elle.
//
// L'action passe par `Button` : ce composant dessinait le sien, sans rôle, si
// bien que « Réessayer » — souvent la seule issue proposée — n'était pas
// annoncé comme un bouton.
export default function EmptyState({ icon, title, description, actionLabel, onAction, niveau = 2 }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.title} accessibilityRole="header" aria-level={niveau}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.lg, gap: spacing.v12 },
  title: { ...typography.titleSm, color: colors.ink, textAlign: 'center' },
  description: { ...typography.body, color: colors.muted, textAlign: 'center', maxWidth: 280 },
  action: { marginTop: spacing.sm },
});
