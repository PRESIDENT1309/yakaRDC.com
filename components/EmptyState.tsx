import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing } from '../lib/theme';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Source officielle pour tout état vide. L'icône reste nue — jamais de
// cercle coloré générique autour (anti-pattern explicitement interdit par le
// Design System YakaRDC). icon est optionnelle : pour un état vide léger en
// ligne (ex. section vide sur l'accueil), on peut n'afficher qu'un titre —
// {icon} ne rend rien quand icon est absente, donc gap ne réserve pas
// d'espace pour elle.
export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.actionBtn} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.lg, gap: spacing.v10 },
  // Ce style attendait un jeton qui n'existait pas encore. `titleSm` le porte
  // désormais, avec exactement les mêmes valeurs (sansSemiBold 16) : le rendu
  // ne bouge pas, mais la taille cesse d'être décidée ici.
  title: { ...typography.titleSm, color: colors.ink },
  description: { ...typography.body, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  actionBtn: { marginTop: spacing.v6, backgroundColor: colors.lave, borderRadius: radii.md, paddingHorizontal: spacing.v20, paddingVertical: spacing.v12 },
  actionText: { ...typography.button, color: colors.cream },
});
