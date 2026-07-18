import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
  Image, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageIcon, Upload, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

interface ImageSlotProps {
  settingKey: string;
  title: string;
  description: string;
}

function ImageSlot({ settingKey, title, description }: ImageSlotProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', settingKey).maybeSingle()
      .then(({ data }) => { setCurrentUrl(data?.value ?? null); setLoading(false); });
  }, [settingKey]);

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
      const path = `app-assets/${settingKey}-${Date.now()}.jpg`;
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
        .upsert({ key: settingKey, value: data.publicUrl, updated_at: new Date().toISOString() });

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
      'Supprimer cette image',
      "L'illustration dessinée par défaut s'affichera de nouveau à la place.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: handleDelete },
      ]
    );
  }

  async function handleDelete() {
    if (!currentUrl) return;
    setDeleting(true);
    const storagePath = currentUrl.split('/establishment-photos/')[1];
    if (storagePath) {
      await supabase.storage.from('establishment-photos').remove([storagePath]);
    }
    await supabase.from('app_settings')
      .upsert({ key: settingKey, value: null, updated_at: new Date().toISOString() });
    setCurrentUrl(null);
    setDeleting(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>

      {loading ? (
        <ActivityIndicator color={colors.lave} style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.previewBox}>
          {currentUrl ? (
            <Image source={{ uri: currentUrl }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.previewEmpty}>
              <ImageIcon size={26} color={colors.faint} />
              <Text style={styles.previewEmptyText}>Illustration par défaut</Text>
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
              <Upload size={14} color="#FAF8F4" />
              <Text style={styles.uploadBtnText}>{currentUrl ? "Changer" : 'Choisir une image'}</Text>
            </>
          )}
        </Pressable>

        {currentUrl && (
          <Pressable
            style={[styles.deleteBtn, deleting && { opacity: 0.7 }]}
            onPress={confirmDelete}
            disabled={uploading || deleting}
          >
            {deleting ? <ActivityIndicator color="#C0392B" size="small" /> : <Trash2 size={14} color="#C0392B" />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function AppearanceScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Apparence</Text>
        <Text style={styles.headerSub}>Images de fond utilisées dans l'app</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ImageSlot
          settingKey="auth_background_url"
          title="Accueil & Connexion"
          description="Écran « Yaka ! » et écran de connexion"
        />
        <ImageSlot
          settingKey="home_hero_image_url"
          title="Page d'accueil de l'app"
          description="Image en haut de l'écran d'accueil, après connexion"
        />

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Sans image personnalisée, l'illustration dessinée (soleil, montagnes, fleuve) s'affiche automatiquement — jamais d'écran vide. Chaque emplacement est indépendant : changer l'un ne modifie pas l'autre.
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
  cardTitle: { fontSize: 13, fontWeight: '500', color: colors.ink },
  cardDescription: { fontSize: 10.5, color: colors.faint, marginTop: 2, marginBottom: 12 },
  previewBox: { borderRadius: 12, overflow: 'hidden', marginBottom: 14, aspectRatio: 16 / 10, backgroundColor: '#F5F4F0' },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewEmptyText: { fontSize: 11.5, color: colors.faint, textAlign: 'center', paddingHorizontal: 20 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  uploadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.lave, borderRadius: 10, paddingVertical: 11 },
  uploadBtnText: { fontSize: 12.5, color: '#FAF8F4', fontWeight: '500' },
  deleteBtn: { width: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFD5D5', borderRadius: 10 },
  infoCard: { backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  infoText: { fontSize: 11.5, color: colors.muted, lineHeight: 17 },
});