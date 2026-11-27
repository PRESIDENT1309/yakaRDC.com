import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { cible, radii } from '../lib/theme';
import { etatBascule } from '../lib/a11y';

export interface BoutonIconeProps {
  icon: ReactNode;
  /**
   * Ce que fait le bouton, en clair : « Retirer des favoris », « Fermer ».
   * Obligatoire — une icône seule ne dit rien à un lecteur d'écran.
   */
  label: string;
  onPress?: () => void;
  /** Côté de la pastille visible. La zone tactile, elle, fait toujours 44. */
  taille?: number;
  /** Fond de la pastille. Absent : l'icône est posée nue. */
  fond?: string;
  /** Filet de la pastille. */
  bordure?: string;
  /** État d'une bascule (favori actif, filtre ouvert) : annoncé par la lecture vocale. */
  selected?: boolean;
  /** Le bouton ouvre ou referme quelque chose (menu, panneau) : état annoncé. */
  expanded?: boolean;
  disabled?: boolean;
  /** Positionnement dans l'écran appelant (absolu, marges). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Bouton réduit à une icône, avec une zone tactile de 44 px.
 *
 * L'audit a relevé des boutons de 18 à 34 px : retour et partage de la fiche,
 * cœur des favoris, cloche, fermeture des feuilles. `hitSlop` ne règle rien sur
 * le web, où react-native-web l'ignore. Ici la zone qui reçoit le doigt et le
 * dessin sont deux boîtes distinctes : on agrandit la première sans grossir le
 * second — le principe déjà appliqué à la flèche de ScreenHeader.
 *
 * La marge négative annule le surplus : dans la mise en page, le bouton occupe
 * exactement la place de sa pastille. On peut donc le substituer à un ancien
 * bouton sans rien décaler autour.
 */
export default function BoutonIcone({
  icon, label, onPress, taille = 34, fond, bordure, selected, expanded, disabled = false, style,
}: BoutonIconeProps) {
  const zone = Math.max(cible.min, taille);
  const debord = (zone - taille) / 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-expanded={expanded}
      {...etatBascule(selected)}
      onPress={onPress}
      disabled={disabled}
      style={[styles.zone, { width: zone, height: zone, margin: -debord }, disabled && styles.inactif, style]}
    >
      <View
        style={[
          styles.pastille,
          { width: taille, height: taille },
          fond ? { backgroundColor: fond } : null,
          bordure ? { borderWidth: 1, borderColor: bordure } : null,
        ]}
      >
        {icon}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: { alignItems: 'center', justifyContent: 'center' },
  pastille: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  inactif: { opacity: 0.5 },
});
