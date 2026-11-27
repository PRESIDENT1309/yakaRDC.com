import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { Alert } from './alert';
import { messageErreur } from './erreurs';

const BUCKET = 'establishment-photos';

// Sélection et envoi d'images — extrait de app/pro/establishment.tsx pour être
// partagé avec l'éditeur d'offres, qui a besoin exactement du même mécanisme.
// Sans cette extraction, la logique d'upload existerait en deux exemplaires
// dans deux fichiers voisins, ce qui est précisément la dette que ce projet
// s'emploie à réduire.

/**
 * Plus grand côté, en pixels, des images envoyées.
 *
 * L'audit du 26/11/2026 a relevé que les photos partaient au stockage telles
 * que sorties de l'appareil : un cliché de téléphone pèse couramment 4 à 8 Mo
 * pour 4 000 px de large, alors que la fiche l'affiche sur 430 points. Chaque
 * visiteur téléchargeait donc dix fois plus que ce que son écran peut montrer —
 * sur les réseaux mobiles que vise l'application, c'est la différence entre
 * une fiche qui s'ouvre et une fiche qu'on abandonne.
 *
 * Les plafonds restent au-dessus du plancher de qualité (`LARGEUR_MINIMALE`,
 * 1 000 px, dans lib/images.ts) : on allège, on ne dégrade pas.
 */
export const COTE_MAX = {
  /** Photo de fiche : pleine largeur d'un grand téléphone en densité 3×. */
  photo: 1600,
  /** Bandeau d'accueil, fond de connexion : pleine largeur d'un écran de bureau. */
  bandeau: 1920,
  /** Photo de profil, logo : jamais affichés au-delà de 170 px. */
  vignette: 512,
} as const;

/** Sous ce poids, une image déjà aux bonnes dimensions est envoyée telle quelle. */
const POIDS_ACCEPTABLE = 400 * 1024;
const QUALITE_JPEG = 0.82;

/** Ouvre la galerie. Renvoie l'URI locale, ou null si refus / annulation. */
export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission requise', "L'accès à vos photos est nécessaire pour en ajouter une.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

/**
 * Ramène une image à `coteMax` pixels de plus grand côté avant l'envoi.
 *
 * Web uniquement, par le canevas du navigateur — c'est là que travaillent les
 * partenaires et l'administration, et cela n'ajoute aucune dépendance. Sur
 * mobile natif, l'image part telle que la galerie la fournit (déjà compressée
 * par `quality` dans le sélecteur) ; l'y redimensionner demanderait
 * `expo-image-manipulator`.
 *
 * Ne lève jamais : au moindre doute (format non décodable, navigateur ancien,
 * résultat plus lourd que l'original), c'est le fichier d'origine qui part.
 * Une photo un peu lourde vaut mieux qu'un envoi qui échoue.
 */
async function alleger(blob: Blob, coteMax: number): Promise<Blob> {
  if (Platform.OS !== 'web') return blob;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return blob;
  // Un GIF perdrait son animation, un SVG n'a pas de pixels à réduire.
  if (!/^image\/(jpeg|png|webp)$/i.test(blob.type)) return blob;

  try {
    // `from-image` : applique l'orientation EXIF, sans quoi une photo prise
    // téléphone à la verticale ressortirait couchée une fois redessinée.
    const image = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const grandCote = Math.max(image.width, image.height);
    const echelle = Math.min(1, coteMax / grandCote);

    if (echelle === 1 && blob.size <= POIDS_ACCEPTABLE) { image.close(); return blob; }

    const canevas = document.createElement('canvas');
    canevas.width = Math.round(image.width * echelle);
    canevas.height = Math.round(image.height * echelle);
    const contexte = canevas.getContext('2d');
    if (!contexte) { image.close(); return blob; }
    contexte.imageSmoothingQuality = 'high';
    contexte.drawImage(image, 0, 0, canevas.width, canevas.height);
    image.close();

    // Un PNG reste un PNG : c'est le format des logos à fond transparent, et
    // le JPEG remplacerait cette transparence par du noir.
    const type = /png/i.test(blob.type) ? 'image/png' : 'image/jpeg';
    const reduit = await new Promise<Blob | null>((resolve) => {
      canevas.toBlob(resolve, type, QUALITE_JPEG);
    });

    return reduit && reduit.size < blob.size ? reduit : blob;
  } catch {
    return blob;
  }
}

/**
 * Envoie l'image et renvoie son URL publique, ou null en cas d'échec — auquel
 * cas l'utilisateur a déjà été prévenu.
 *
 * @param coteMax  plus grand côté conservé, voir `COTE_MAX`
 */
export async function uploadToStorage(
  uri: string,
  path: string,
  coteMax: number = COTE_MAX.photo,
): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await alleger(await response.blob(), coteMax);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: true,
        // Un an. Chaque envoi porte un nom unique (horodaté) : une image
        // remplacée change d'adresse, le navigateur n'a donc jamais de raison
        // de revérifier celle qu'il a déjà. La valeur par défaut, une heure,
        // faisait retélécharger tout le catalogue à chaque visite.
        cacheControl: '31536000',
      });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    Alert.alert(
      'Envoi impossible',
      messageErreur(e, "L'image n'a pas pu être envoyée. Vérifiez votre connexion, puis réessayez."),
    );
    return null;
  }
}

/** Retire le fichier du stockage à partir de son URL publique. */
export async function removeFromStorage(publicUrl: string): Promise<void> {
  const path = publicUrl.split(`/${BUCKET}/`)[1];
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}
