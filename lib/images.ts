import type { ImagePickerAsset } from 'expo-image-picker';
import { Alert } from './alert';

/**
 * Plancher de qualité photographique.
 *
 * L'audit du 03/09/2026 a relevé qu'il n'existait aucune direction
 * photographique : les partenaires téléversaient ce qu'ils voulaient, et
 * l'écran de connexion a fini par afficher une image de stock filigranée.
 * Une direction photo, concrètement, commence par une contrainte à l'entrée —
 * pas par une correction après coup.
 *
 * Le seuil n'est pas arbitraire : la fiche affiche sa photo sur toute la
 * largeur de l'écran, soit environ 430 points sur un grand téléphone, ce qui
 * réclame près de 1 300 px en densité 3×. 1 000 px est le compromis retenu —
 * assez pour que l'image tienne en pleine largeur sans bouillie, assez bas
 * pour ne pas exclure une photo prise avec un appareil modeste.
 */
export const LARGEUR_MINIMALE = 1000;

/**
 * Vérifie qu'une image choisie est assez définie, et le dit à l'utilisateur
 * sinon. Retourne `true` si l'image peut être envoyée.
 *
 * `width` vaut 0 lorsque le système n'a pas fourni la dimension — c'est
 * documenté pour `ImagePickerAsset`. On ne refuse donc que sur une mesure
 * réelle : sans information, on laisse passer. Bloquer une photo valable
 * faute de métadonnée serait un défaut pire que celui qu'on corrige.
 */
export function photoAssezGrande(asset: Pick<ImagePickerAsset, 'width'>): boolean {
  if (!asset.width || asset.width <= 0) return true;
  if (asset.width >= LARGEUR_MINIMALE) return true;

  Alert.alert(
    'Photo trop petite',
    `Cette image ne fait que ${asset.width} px de large. En dessous de ${LARGEUR_MINIMALE} px, elle apparaîtra floue une fois affichée en pleine largeur. Choisissez une photo plus grande, ou reprenez-la.`,
  );
  return false;
}
