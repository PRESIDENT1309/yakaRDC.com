import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Dégagements d'un écran qui dessine lui-même son haut et son bas.
 *
 * Une quinzaine d'écrans écrivaient `Platform.OS === 'ios' ? 56 : 20`. Deux
 * défauts : sur Android, la barre d'état (24 à 48 px selon l'encoche) n'était
 * pas comptée, et le contenu passait dessous ; sur iPhone, 56 était une
 * estimation, juste sur certains modèles seulement.
 *
 * On part désormais de la mesure réelle. Le plancher de 20 redonne la valeur
 * d'origine là où il n'y a pas d'encoche — sur le web en particulier, où les
 * marges mesurées valent 0.
 *
 * Les en-têtes passent par `components/ScreenHeader`, qui fait déjà ce calcul.
 */
export function useZonesSures() {
  const insets = useSafeAreaInsets();
  return {
    /** Haut d'un écran sans en-tête : barre d'état, puis une respiration. */
    haut: Math.max(insets.top + 12, 20),
    /** Bas d'une feuille ou d'un pied d'écran : au-dessus de la barre de geste. */
    bas: Math.max(insets.bottom + 8, 20),
    insets,
  };
}
