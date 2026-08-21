import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { Alert } from './alert';

const BUCKET = 'establishment-photos';

// Sélection et envoi d'images — extrait de app/pro/establishment.tsx pour être
// partagé avec l'éditeur d'offres, qui a besoin exactement du même mécanisme.
// Sans cette extraction, la logique d'upload existerait en deux exemplaires
// dans deux fichiers voisins, ce qui est précisément la dette que ce projet
// s'emploie à réduire.

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

/** Envoie l'image et renvoie son URL publique, ou null en cas d'échec. */
export async function uploadToStorage(uri: string, path: string): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    Alert.alert('Erreur', "L'envoi de l'image a échoué. Vérifiez votre connexion et réessayez.");
    return null;
  }
}

/** Retire le fichier du stockage à partir de son URL publique. */
export async function removeFromStorage(publicUrl: string): Promise<void> {
  const path = publicUrl.split(`/${BUCKET}/`)[1];
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}
