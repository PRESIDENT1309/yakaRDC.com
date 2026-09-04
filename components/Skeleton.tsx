import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { DimensionValue, ViewStyle, StyleProp } from 'react-native';
import { colors, radii, ratios } from '../lib/theme';
import { courbe, useMouvementReduit } from '../lib/motion';

/**
 * Bloc d'attente : la forme du contenu à venir, pas un disque qui tourne.
 *
 * L'audit du 03/09/2026 a compté 83 `ActivityIndicator` et zéro squelette.
 * Le disque a deux défauts : il ne dit rien de ce qui arrive, et il fait
 * paraître l'attente plus longue qu'elle n'est, parce que rien ne prépare
 * l'œil à la mise en page. Un squelette fait l'inverse — il occupe déjà la
 * place, si bien que l'arrivée du contenu ne déplace rien.
 *
 * Réservé aux écrans dont la forme est prévisible : accueil, recherche,
 * fiche. Ailleurs, un disque reste le bon outil — notamment dans un bouton,
 * où c'est l'action qui attend, pas le contenu.
 *
 * La pulsation s'efface si l'utilisateur a demandé moins d'animations : le
 * bloc reste alors visible, simplement immobile.
 */

const DUREE = 900;
const OPACITE_BASSE = 0.45;

type Props = {
  width?: DimensionValue;
  height?: number;
  /**
   * Rapport largeur/hauteur, à la place d'une hauteur fixe. Prioritaire sur
   * `height` : c'est ce qui permet à la silhouette de suivre la géométrie
   * réelle d'une photo de carte, dont la hauteur dépend de la largeur.
   */
  ratio?: number;
  /** Rayon des angles. Par défaut `radii.sm`; passer `radii.pill` pour un trait de texte. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Skeleton({ width = '100%', height = 14, ratio, radius = radii.sm, style }: Props) {
  const opacite = useRef(new Animated.Value(1)).current;
  // Lecture du réglage système centralisée dans lib/motion : ce composant en
  // portait sa propre copie, écrite avant que les jetons de mouvement existent.
  const anime = !useMouvementReduit();

  useEffect(() => {
    if (!anime) return;
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(opacite, {
          toValue: OPACITE_BASSE, duration: DUREE,
          easing: courbe.symetrique, useNativeDriver: true,
        }),
        Animated.timing(opacite, {
          toValue: 1, duration: DUREE,
          easing: courbe.symetrique, useNativeDriver: true,
        }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [anime, opacite]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.bloc,
        ratio != null
          ? { width, aspectRatio: ratio, borderRadius: radius }
          : { width, height, borderRadius: radius },
        anime ? { opacity: opacite } : null,
        style,
      ]}
    />
  );
}

/**
 * Silhouette d'une carte d'établissement — reprend la géométrie de
 * `ListingCard` : image, puis deux lignes de texte de longueurs inégales.
 * L'inégalité compte : deux traits identiques se lisent comme un motif,
 * pas comme du texte.
 */
export function SkeletonCarte() {
  return (
    <View style={styles.carte}>
      <Skeleton ratio={ratios.carte} radius={0} />
      <View style={styles.carteTexte}>
        <Skeleton width="72%" height={13} radius={radii.pill} />
        <Skeleton width="45%" height={11} radius={radii.pill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { backgroundColor: colors.border },
  carte: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  carteTexte: { padding: 12, gap: 8 },
});
