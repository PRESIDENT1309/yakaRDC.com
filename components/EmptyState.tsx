import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, fonts, radii } from '../lib/theme';

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
  container: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 10 },
  // Aucun jeton typography.* ne correspond précisément à un titre d'état
  // vide (~16px, sans-serif semi-gras) — composé directement depuis
  // fonts.sansSemiBold plutôt que d'inventer un nouveau nom d'échelle pour
  // un seul usage. À formaliser si ce besoin se généralise ailleurs.
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  description: { ...typography.body, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  actionBtn: { marginTop: 6, backgroundColor: colors.lave, borderRadius: radii.md, paddingHorizontal: 20, paddingVertical: 12 },
  actionText: { ...typography.button, color: colors.cream },
});
