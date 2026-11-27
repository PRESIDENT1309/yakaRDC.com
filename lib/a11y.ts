import { Platform } from 'react-native';

/**
 * États d'accessibilité qui ne s'écrivent pas de la même façon sur le web et
 * en natif.
 *
 * Règle générale du projet : écrire les états en `aria-*` (`aria-checked`,
 * `aria-busy`, `aria-expanded`, `aria-disabled`), jamais en
 * `accessibilityState`. React Native les comprend en natif, alors que
 * react-native-web ne transmet PAS `accessibilityState` au navigateur : l'état
 * existait sur téléphone et disparaissait sur le site.
 *
 * Restent deux cas où le bon attribut dépend de la plateforme — d'où ces deux
 * fonctions, à étaler sur l'élément : `{...etatBascule(actif)}`.
 */

/**
 * Bouton à deux positions : filtre actif, favori, point de pagination.
 * Le web attend `aria-pressed` (`aria-selected` n'est pas permis sur un
 * bouton) ; le natif ne connaît que « sélectionné ».
 */
export function etatBascule(actif: boolean | undefined): object {
  if (actif === undefined) return {};
  return Platform.OS === 'web' ? { 'aria-pressed': actif } : { 'aria-selected': actif };
}

/**
 * Lien de navigation vers la page affichée. Le web a un attribut fait pour
 * cela, `aria-current` ; le natif, de nouveau, « sélectionné ».
 */
export function etatCourant(actif: boolean): object {
  if (Platform.OS === 'web') return actif ? { 'aria-current': 'page' } : {};
  return { 'aria-selected': actif };
}
