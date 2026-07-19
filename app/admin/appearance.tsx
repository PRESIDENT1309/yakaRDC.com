import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
  Image, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageIcon, Upload, Trash2, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

// ─────────────────────────────────────────────
// Emplacement à IMAGE UNIQUE (Accueil & Connexion)
// ─────────────────────────────────────────────
function SingleImageSlot({ settingKey, title, description }:
  { settingKey: string; title: string; description: string }) {
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
    if (status !== 'granted') { Alert.alert('Permission requise', "L'accès à vos photos est nécessaire."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const path = `app-assets/${settingKey}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('establishment-photos')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (uploadError) { Alert.alert('Erreur', uploadError.message); setUploading(false); return; }

      const { data } = supabase.storage.from('establishment-photos').getPublicUrl(path);
      await supabase.from('app_settings').upsert({ key: settingKey, value: data.publicUrl, updated_at: new Date().toISOString() });
      setCurrentUrl(data.publicUrl);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "L'envoi de l'image a échoué.");
    }
    setUploading(false);
  }

  function confirmDelete() {
    if (!currentUrl) return;
    Alert.alert('Supprimer cette image', "L'illustration dessinée par défaut s'affichera de nouveau.", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        setDeleting(true);
        const storagePath = currentUrl.split('/establishment-photos/')[1];
        if (storagePath) await supabase.storage.from('establishment-photos').remove([storagePath]);
        await supabase.from('app_settings').upsert({ key: settingKey, value: null, updated_at: new Date().toISOString() });
        setCurrentUrl(null);
        setDeleting(false);
      }},
    ]);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>

      {loading ? <ActivityIndicator color={colors.lave} style={{ marginVertical: 30 }} /> : (
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
        <Pressable style={[styles.uploadBtn, uploading && { opacity: 0.7 }]} onPress={handlePickImage} disabled={uploading || deleting}>
          {uploading ? <ActivityIndicator color="#FAF8F4" size="small" /> : (
            <><Upload size={14} color="#FAF8F4" /><Text style={styles.uploadBtnText}>{currentUrl ? 'Changer' : 'Choisir une image'}</Text></>
          )}
        </Pressable>
        {currentUrl && (
          <Pressable style={[styles.deleteBtn, deleting && { opacity: 0.7 }]} onPress={confirmDelete} disabled={uploading || deleting}>
            {deleting ? <ActivityIndicator color="#C0392B" size="small" /> : <Trash2 size={14} color="#C0392B" />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Emplacement MULTI-PHOTOS (Page d'accueil, défilement auto)
// ─────────────────────────────────────────────
const MAX_PHOTOS = 10;

function MultiImageSlot({ settingKey, title, description }:
  { settingKey: string; title: string; description: string }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', settingKey).maybeSingle()
      .then(({ data }) => {
        try { setPhotos(data?.value ? JSON.parse(data.value) : []); }
        catch { setPhotos([]); }
        setLoading(false);
      });
  }, [settingKey]);

  async function savePhotos(next: string[]) {
    setPhotos(next);
    await supabase.from('app_settings').upsert({
      key: settingKey,
      value: next.length > 0 ? JSON.stringify(next) : null,
      updated_at: new Date().toISOString(),
    });
  }

  async function handleAddPhoto() {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limite atteinte', `Vous ne pouvez pas ajouter plus de ${MAX_PHOTOS} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission requise', "L'accès à vos photos est nécessaire."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const path = `app-assets/${settingKey}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('establishment-photos')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (uploadError) { Alert.alert('Erreur', uploadError.message); setUploading(false); return; }

      const { data } = supabase.storage.from('establishment-photos').getPublicUrl(path);
      await savePhotos([...photos, data.publicUrl]);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "L'envoi de l'image a échoué.");
    }
    setUploading(false);
  }

  async function handleDeletePhoto(url: string) {
    const storagePath = url.split('/establishment-photos/')[1];
    if (storagePath) await supabase.storage.from('establishment-photos').remove([storagePath]);
    await savePhotos(photos.filter(p => p !== url));
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>

      {loading ? <ActivityIndicator color={colors.lave} style={{ marginVertical: 30 }} /> : (
        <>
          {photos.length === 0 ? (
            <View style={[styles.previewBox, { aspectRatio: undefined, height: 80 }]}>
              <View style={styles.previewEmpty}>
                <ImageIcon size={22} color={colors.faint} />
                <Text style={styles.previewEmptyText}>Illustration par défaut (aucune photo)</Text>
              </View>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              {photos.map((url, i) => (
                <View key={url} style={styles.photoThumbWrap}>
                  <Image source={{ uri: url }} style={styles.photoThumb} />
                  <View style={styles.photoOrderBadge}><Text style={styles.photoOrderText}>{i + 1}</Text></View>
                  <Pressable style={styles.photoDeleteBtn} onPress={() => handleDeletePhoto(url)} hitSlop={6}>
                    <X size={10} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable style={styles.addPhotoBtn} onPress={handleAddPhoto} disabled={uploading}>
                  {uploading ? <ActivityIndicator color={colors.faint} size="small" /> : <Upload size={16} color={colors.faint} />}
                </Pressable>
              )}
            </View>
          )}

          {photos.length === 0 && (
            <Pressable style={[styles.uploadBtn, uploading && { opacity: 0.7 }]} onPress={handleAddPhoto} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#FAF8F4" size="small" /> : (
                <><Upload size={14} color="#FAF8F4" /><Text style={styles.uploadBtnText}>Ajouter une photo</Text></>
              )}
            </Pressable>
          )}

          <Text style={styles.hint}>
            {photos.length} / {MAX_PHOTOS} photos {photos.length > 1 ? '· défilement automatique activé' : ''}
          </Text>
        </>
      )}
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
        <SingleImageSlot
          settingKey="auth_background_url"
          title="Accueil & Connexion"
          description="Écran « Yaka ! » et écran de connexion"
        />
        <MultiImageSlot
          settingKey="home_hero_image_url"
          title="Page d'accueil de l'app"
          description="Jusqu'à 10 photos — défilent automatiquement si plus d'une"
        />

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Sans photo, l'illustration dessinée s'affiche automatiquement. Avec 2 photos ou plus, elles défilent toutes seules avec un fondu, dans l'ordre où vous les avez ajoutées.
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
  uploadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.lave, borderRadius: 10, paddingVertical: 11, marginBottom: 8 },
  uploadBtnText: { fontSize: 12.5, color: '#FAF8F4', fontWeight: '500' },
  deleteBtn: { width: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFD5D5', borderRadius: 10, marginBottom: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  photoThumbWrap: { width: 64, height: 64, borderRadius: 10, position: 'relative' },
  photoThumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#F5F4F0' },
  photoOrderBadge: { position: 'absolute', bottom: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  photoOrderText: { fontSize: 8.5, color: '#FFFFFF', fontWeight: '600' },
  photoDeleteBtn: {
    position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#C0392B', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FAF8F4',
  },
  addPhotoBtn: { width: 64, height: 64, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 10.5, color: colors.faint },
  infoCard: { backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  infoText: { fontSize: 11.5, color: colors.muted, lineHeight: 17 },
});