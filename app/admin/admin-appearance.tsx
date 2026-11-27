import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { Alert } from '../../lib/alert';
import * as ImagePicker from 'expo-image-picker';
import { ImageIcon, Upload, RotateCcw, Lightbulb } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { ecrire } from '../../lib/db';
import { photoAssezGrande } from '../../lib/images';
import { colors, typography, radii, spacing, breakpoints, cible } from '../../lib/theme';

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
        <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Apparence</Text>
        <Text style={styles.headerSub}>Image de fond — écrans d'accueil et de connexion</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>Image actuelle</Text>

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

          <Pressable
            style={[styles.uploadBtn, uploading && { opacity: 0.7 }]}
            // Libellé répété : le texte laisse place à l'indicateur pendant l'envoi.
            accessibilityRole="button"
            accessibilityLabel="Changer l'image"
            aria-disabled={uploading} aria-busy={uploading}
            onPress={handlePickImage}
            disabled={uploading}
          >
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
            <Pressable style={styles.resetBtn} accessibilityRole="button" onPress={confirmReset}>
              <RotateCcw size={13} color={colors.muted} />
              <Text style={styles.resetBtnText}>Revenir à l'illustration par défaut</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.infoCard}>
          <Lightbulb size={14} color={colors.muted} />
          <Text style={styles.infoText}>
            Cette image s'affiche en fond sur l'écran d'accueil ("Yaka !") et l'écran de connexion. Sans image personnalisée, l'illustration dessinée (soleil, montagnes, fleuve) s'affiche automatiquement.
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
  // Colonne centrée, comme `appearance.tsx` ; la zone sûre est dégagée par le
  // layout de l'admin.
  header: {
    maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.v20, paddingBottom: spacing.v12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  content: { padding: spacing.v20, gap: spacing.v12, width: '100%', maxWidth: breakpoints.formMax, alignSelf: 'center' },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  cardTitle: { ...typography.pillLabel, color: colors.ink, marginBottom: spacing.v12, },
  previewBox: { borderRadius: radii.md, overflow: 'hidden', marginBottom: spacing.v12, aspectRatio: 16 / 10, backgroundColor: colors.surfaceSunken },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  previewEmptyText: { ...typography.captionSm, color: colors.faint, textAlign: 'center', paddingHorizontal: spacing.v20, },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.lave, borderRadius: radii.md, paddingVertical: spacing.v12, minHeight: cible.min },
  uploadBtnText: { ...typography.pillLabel, color: colors.cream, },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.v12, minHeight: cible.min, marginTop: spacing.sm },
  resetBtnText: { ...typography.captionSm, color: colors.muted, },
  infoCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12 },
  infoText: { ...typography.captionSm, color: colors.muted, flex: 1 },
});