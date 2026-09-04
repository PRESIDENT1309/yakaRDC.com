import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
  Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { Alert } from '../../lib/alert';
import * as ImagePicker from 'expo-image-picker';
import { ImageIcon, Upload, RotateCcw } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { ecrire } from '../../lib/db';
import { photoAssezGrande } from '../../lib/images';
import { colors, typography } from '../../lib/theme';

const SETTING_KEY = 'auth_background_url';

export default function AppearanceScreen() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', SETTING_KEY).maybeSingle()
      .then(({ data }) => { setCurrentUrl(data?.value ?? null); setLoading(false); });
  }, []);

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "L'accès à vos photos est nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    // Ce fond occupe tout l'écran de connexion — le premier contact avec la
    // marque. C'est l'image de l'app qui souffre le plus d'une définition faible.
    if (!photoAssezGrande(result.assets[0])) return;

    setUploading(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const path = `app-assets/auth-background-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('establishment-photos')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('establishment-photos').getPublicUrl(path);

      // C'est cette ligne, et non l'envoi du fichier, qui décide du fond
      // affiché à l'écran de connexion.
      const enregistre = await ecrire(
        supabase.from('app_settings')
          .upsert({ key: SETTING_KEY, value: data.publicUrl, updated_at: new Date().toISOString() }),
        "Enregistrement de l'image",
      );
      if (enregistre) setCurrentUrl(data.publicUrl);
    } catch {
      Alert.alert('Erreur', "L'envoi de l'image a échoué. Réessayez.");
    }
    setUploading(false);
  }

  function confirmReset() {
    Alert.alert(
      "Revenir à l'illustration par défaut",
      "L'écran d'accueil et de connexion afficheront à nouveau le paysage illustré intégré.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: async () => {
          const remis = await ecrire(
            supabase.from('app_settings')
              .upsert({ key: SETTING_KEY, value: null, updated_at: new Date().toISOString() }),
            "Retour à l'illustration par défaut",
          );
          if (remis) setCurrentUrl(null);
        }},
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Apparence</Text>
        <Text style={styles.headerSub}>Image de fond — écrans d'accueil et de connexion</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Image actuelle</Text>

          {loading ? (
            <ActivityIndicator color={colors.lave} style={{ marginVertical: 30 }} />
          ) : (
            <View style={styles.previewBox}>
              {currentUrl ? (
                <Image source={{ uri: currentUrl }} style={styles.previewImage} resizeMode="cover" />
              ) : (
                <View style={styles.previewEmpty}>
                  <ImageIcon size={28} color={colors.faint} />
                  <Text style={styles.previewEmptyText}>Illustration par défaut (paysage dessiné)</Text>
                </View>
              )}
            </View>
          )}

          <Pressable style={[styles.uploadBtn, uploading && { opacity: 0.7 }]} onPress={handlePickImage} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.cream} size="small" />
            ) : (
              <>
                <Upload size={15} color={colors.cream} />
                <Text style={styles.uploadBtnText}>Changer l'image</Text>
              </>
            )}
          </Pressable>

          {currentUrl && (
            <Pressable style={styles.resetBtn} onPress={confirmReset}>
              <RotateCcw size={13} color={colors.muted} />
              <Text style={styles.resetBtnText}>Revenir à l'illustration par défaut</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Cette image s'affiche en fond sur l'écran d'accueil ("Yaka !") et l'écran de connexion. Sans image personnalisée, l'illustration dessinée (soleil, montagnes, fleuve) s'affiche automatiquement.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  // Meme largeur que le contenu : sans cela, le filet du bas et les actions
  // de droite depassaient la colonne de plusieurs centaines de pixels.
  header: {
    maxWidth: 500, width: '100%',
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: 2, },
  content: { padding: 20, gap: 14, maxWidth: 500 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  cardTitle: { ...typography.pillLabel, color: colors.ink, marginBottom: 12, },
  previewBox: { borderRadius: 12, overflow: 'hidden', marginBottom: 14, aspectRatio: 16 / 10, backgroundColor: colors.surfaceSunken },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewEmptyText: { ...typography.captionSm, color: colors.faint, textAlign: 'center', paddingHorizontal: 20, },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.lave, borderRadius: 10, paddingVertical: 12 },
  uploadBtnText: { ...typography.pillLabel, color: colors.cream, },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 8 },
  resetBtnText: { ...typography.captionSm, color: colors.muted, },
  infoCard: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  infoText: { ...typography.captionSm, color: colors.muted, },
});