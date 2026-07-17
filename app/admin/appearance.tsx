import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
  Image, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageIcon, Upload, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

const SETTING_KEY = 'auth_background_url';

export default function AppearanceScreen() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

    setUploading(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const path = `app-assets/auth-background-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('establishment-photos')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });

      if (uploadError) {
        Alert.alert('Erreur', `L'envoi a échoué : ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from('establishment-photos').getPublicUrl(path);

      const { error: settingError } = await supabase.from('app_settings')
        .upsert({ key: SETTING_KEY, value: data.publicUrl, updated_at: new Date().toISOString() });

      if (settingError) {
        Alert.alert('Erreur', `Image envoyée mais non enregistrée : ${settingError.message}`);
        setUploading(false);
        return;
      }

      setCurrentUrl(data.publicUrl);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "L'envoi de l'image a échoué.");
    }
    setUploading(false);
  }

  function confirmDelete() {
    if (!currentUrl) return;
    Alert.alert(
      "Supprimer cette image",
      "L'écran d'accueil et de connexion afficheront de nouveau l'illustration dessinée par défaut.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: handleDelete },
      ]
    );
  }

  async function handleDelete() {
    if (!currentUrl) return;
    setDeleting(true);

    // Supprime le vrai fichier du Storage (pas seulement la référence)
    const storagePath = currentUrl.split('/establishment-photos/')[1];
    if (storagePath) {
      await supabase.storage.from('establishment-photos').remove([storagePath]);
    }

    await supabase.from('app_settings')
      .upsert({ key: SETTING_KEY, value: null, updated_at: new Date().toISOString() });

    setCurrentUrl(null);
    setDeleting(false);
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

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.uploadBtn, uploading && { opacity: 0.7 }]}
              onPress={handlePickImage}
              disabled={uploading || deleting}
            >
              {uploading ? (
                <ActivityIndicator color="#FAF8F4" size="small" />
              ) : (
                <>
                  <Upload size={15} color="#FAF8F4" />
                  <Text style={styles.uploadBtnText}>
                    {currentUrl ? "Changer l'image" : 'Choisir une image'}
                  </Text>
                </>
              )}
            </Pressable>

            {currentUrl && (
              <Pressable
                style={[styles.deleteBtn, deleting && { opacity: 0.7 }]}
                onPress={confirmDelete}
                disabled={uploading || deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#C0392B" size="small" />
                ) : (
                  <Trash2 size={15} color="#C0392B" />
                )}
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Sans image personnalisée, l'illustration dessinée (soleil, montagnes, fleuve) s'affiche automatiquement — jamais d'écran vide. Supprimer l'image actuelle revient directement à cette illustration.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '500', color: colors.ink },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  content: { padding: 20, gap: 14, maxWidth: 500 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  cardTitle: { fontSize: 13, fontWeight: '500', color: colors.ink, marginBottom: 12 },
  previewBox: { borderRadius: 12, overflow: 'hidden', marginBottom: 14, aspectRatio: 16 / 10, backgroundColor: '#F5F4F0' },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewEmptyText: { fontSize: 11.5, color: colors.faint, textAlign: 'center', paddingHorizontal: 20 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  uploadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.lave, borderRadius: 10, paddingVertical: 12 },
  uploadBtnText: { fontSize: 13, color: '#FAF8F4', fontWeight: '500' },
  deleteBtn: { width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFD5D5', borderRadius: 10 },
  infoCard: { backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  infoText: { fontSize: 11.5, color: colors.muted, lineHeight: 17 },
});