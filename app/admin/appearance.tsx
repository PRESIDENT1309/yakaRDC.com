import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { Alert } from '../../lib/alert';
import * as ImagePicker from 'expo-image-picker';
import { ImageIcon, Upload, Trash2, X, Lightbulb } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { ecrire } from '../../lib/db';
import { photoAssezGrande } from '../../lib/images';
import { uploadToStorage, COTE_MAX } from '../../lib/photo-upload';
import { useConfirm } from '../../lib/confirm-context';
import { colors, typography, radii, spacing, breakpoints, cible } from '../../lib/theme';
import BoutonIcone from '../../components/BoutonIcone';

// ─────────────────────────────────────────────
// Emplacement à IMAGE UNIQUE (Accueil & Connexion)
// ─────────────────────────────────────────────
// `niveau` : rang du titre de la carte dans la page — 3 quand la carte est
// rangée sous un intitulé de groupe, 2 sinon.
function SingleImageSlot({ settingKey, title, description, niveau = 2 }:
  { settingKey: string; title: string; description: string; niveau?: 2 | 3 }) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', settingKey).maybeSingle()
      .then(({ data }) => { setCurrentUrl(data?.value ?? null); setLoading(false); });
  }, [settingKey]);

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission requise', "L'accès à vos photos est nécessaire."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    // Ces images occupent la pleine largeur de l'écran : le plancher de
    // définition y compte davantage encore que sur une vignette de fiche.
    if (!photoAssezGrande(result.assets[0])) return;

    setUploading(true);
    // `uploadToStorage` allège l'image avant l'envoi et prévient lui-même
    // l'utilisateur en cas d'échec : `null` signifie « déjà signalé ».
    const publicUrl = await uploadToStorage(
      result.assets[0].uri,
      `app-assets/${settingKey}-${Date.now()}.jpg`,
      COTE_MAX.bandeau,
    );
    if (publicUrl) {
      // Le fichier est envoyé, mais c'est cette ligne qui décide de ce que
      // l'app affiche. Sans elle, l'aperçu montrerait une image que personne
      // d'autre ne verra.
      const enregistre = await ecrire(
        supabase.from('app_settings').upsert({ key: settingKey, value: publicUrl, updated_at: new Date().toISOString() }),
        "Enregistrement de l'image",
      );
      if (enregistre) setCurrentUrl(publicUrl);
    }
    setUploading(false);
  }

  async function confirmDelete() {
    if (!currentUrl) return;
    // Le dialogue de l'application, et non `Alert.alert` : sur le web, ce
    // dernier ouvre la fenêtre grise du navigateur, sans rapport avec le reste
    // de l'interface et sans bouton rouge pour signaler une suppression.
    const ok = await confirm({
      title: 'Supprimer cette image ?',
      message: "L'illustration dessinée par défaut s'affichera de nouveau.",
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;

    setDeleting(true);
    // Le réglage d'abord, le fichier ensuite : si la base refuse, l'image doit
    // rester en place plutôt que de laisser un réglage pointer dans le vide.
    const efface = await ecrire(
      supabase.from('app_settings').upsert({ key: settingKey, value: null, updated_at: new Date().toISOString() }),
      "Suppression de l'image",
    );
    if (efface) {
      const storagePath = currentUrl.split('/establishment-photos/')[1];
      if (storagePath) await supabase.storage.from('establishment-photos').remove([storagePath]);
      setCurrentUrl(null);
    }
    setDeleting(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} accessibilityRole="header" aria-level={niveau}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>

      {loading ? <ActivityIndicator color={colors.lave} style={{ marginVertical: 30 }} /> : (
        <View style={styles.previewBox}>
          {currentUrl ? (
            <Image source={{ uri: currentUrl }} style={styles.previewImage} resizeMode="cover" accessibilityLabel={`Image actuelle : ${title}`} />
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
          // Libellé explicite : le texte laisse place à l'indicateur pendant
          // l'envoi, et « Changer » seul ne dit pas quelle image.
          accessibilityRole="button"
          accessibilityLabel={`${currentUrl ? "Changer l'image" : 'Choisir une image'} : ${title}`}
          aria-disabled={uploading || deleting} aria-busy={uploading}
          onPress={handlePickImage}
          disabled={uploading || deleting}
        >
          {uploading ? <ActivityIndicator color={colors.cream} size="small" /> : (
            <><Upload size={14} color={colors.cream} /><Text style={styles.uploadBtnText}>{currentUrl ? 'Changer' : 'Choisir une image'}</Text></>
          )}
        </Pressable>
        {currentUrl && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Supprimer l'image : ${title}`}
            aria-disabled={uploading || deleting} aria-busy={deleting}
            style={[styles.deleteBtn, deleting && { opacity: 0.7 }]}
            onPress={confirmDelete}
            disabled={uploading || deleting}
          >
            {deleting ? <ActivityIndicator color={colors.danger} size="small" /> : <Trash2 size={14} color={colors.danger} />}
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
  const confirm = useConfirm();

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', settingKey).maybeSingle()
      .then(({ data }) => {
        try { setPhotos(data?.value ? JSON.parse(data.value) : []); }
        catch { setPhotos([]); }
        setLoading(false);
      });
  }, [settingKey]);

  async function savePhotos(next: string[]) {
    // On écrit avant d'afficher, et non l'inverse : le carrousel de l'accueil
    // doit montrer ce qui est réellement en base. L'ordre initial affichait
    // la nouvelle liste puis tentait de l'enregistrer, si bien qu'un refus
    // laissait l'écran en avance sur la réalité jusqu'au rechargement.
    const enregistre = await ecrire(
      supabase.from('app_settings').upsert({
        key: settingKey,
        value: next.length > 0 ? JSON.stringify(next) : null,
        updated_at: new Date().toISOString(),
      }),
      'Enregistrement des photos',
    );
    if (!enregistre) return false;
    setPhotos(next);
    return true;
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
    // Ces images occupent la pleine largeur de l'écran : le plancher de
    // définition y compte davantage encore que sur une vignette de fiche.
    if (!photoAssezGrande(result.assets[0])) return;

    setUploading(true);
    const publicUrl = await uploadToStorage(
      result.assets[0].uri,
      `app-assets/${settingKey}-${Date.now()}.jpg`,
      COTE_MAX.bandeau,
    );
    if (publicUrl) await savePhotos([...photos, publicUrl]);
    setUploading(false);
  }

  async function handleDeletePhoto(url: string) {
    // La petite croix supprimait sur-le-champ une photo de la page d'accueil,
    // fichier compris : un appui à côté suffisait.
    const ok = await confirm({
      title: 'Retirer cette photo ?',
      message: "Elle ne défilera plus sur la page d'accueil.",
      confirmLabel: 'Retirer',
      destructive: true,
    });
    if (!ok) return;
    // La liste d'abord, le fichier ensuite : dans l'ordre inverse, un refus de
    // la base laissait le carrousel afficher une photo déjà effacée.
    if (!(await savePhotos(photos.filter(p => p !== url)))) return;
    const storagePath = url.split('/establishment-photos/')[1];
    if (storagePath) await supabase.storage.from('establishment-photos').remove([storagePath]);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>{title}</Text>
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
                  <Image source={{ uri: url }} style={styles.photoThumb} accessibilityLabel={`Photo ${i + 1}`} />
                  <View style={styles.photoOrderBadge}><Text style={styles.photoOrderText}>{i + 1}</Text></View>
                  {/* La croix mesurait 18 px, élargie par `hitSlop` — que le web
                      ignore. Le numéro dit de quelle photo il s'agit. */}
                  <BoutonIcone
                    label={`Supprimer la photo ${i + 1}`}
                    taille={18}
                    fond={colors.danger}
                    bordure={colors.cream}
                    style={styles.photoDeleteBtn}
                    onPress={() => handleDeletePhoto(url)}
                    icon={<X size={10} color={colors.white} />}
                  />
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter une photo"
                  aria-disabled={uploading} aria-busy={uploading}
                  style={styles.addPhotoBtn}
                  onPress={handleAddPhoto}
                  disabled={uploading}
                >
                  {uploading ? <ActivityIndicator color={colors.faint} size="small" /> : <Upload size={16} color={colors.faint} />}
                </Pressable>
              )}
            </View>
          )}

          {photos.length === 0 && (
            <Pressable
              style={[styles.uploadBtn, uploading && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Ajouter une photo"
              aria-disabled={uploading} aria-busy={uploading}
              onPress={handleAddPhoto}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator color={colors.cream} size="small" /> : (
                <><Upload size={14} color={colors.cream} /><Text style={styles.uploadBtnText}>Ajouter une photo</Text></>
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
        <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Apparence</Text>
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

        <Text style={styles.groupLabel} accessibilityRole="header" aria-level={2}>Catégories — page d'accueil</Text>
        <SingleImageSlot
          niveau={3}
          settingKey="home_category_hotel_url"
          title="Hôtels"
          description="Vignette de la catégorie « Hôtels » sur l'accueil"
        />
        <SingleImageSlot
          niveau={3}
          settingKey="home_category_furnished_house_url"
          title="Maisons meublées"
          description="Vignette de la catégorie « Maisons meublées » sur l'accueil"
        />
        <SingleImageSlot
          niveau={3}
          settingKey="home_category_restaurant_url"
          title="Restaurants"
          description="Vignette de la catégorie « Restaurants » sur l'accueil"
        />
        <SingleImageSlot
          niveau={3}
          settingKey="home_category_site_url"
          title="Sites touristiques"
          description="Vignette de la catégorie « Sites touristiques » sur l'accueil"
        />

        <Text style={styles.groupLabel} accessibilityRole="header" aria-level={2}>Bande éditoriale</Text>
        <SingleImageSlot
          niveau={3}
          settingKey="home_story_image_url"
          title="« Le Fleuve Congo »"
          description="Section pleine largeur sur l'accueil, sous les recommandations"
        />

        <View style={styles.infoCard}>
          <Lightbulb size={14} color={colors.muted} />
          <Text style={styles.infoText}>
            Sans photo, l'illustration dessinée s'affiche automatiquement. Avec 2 photos ou plus, elles défilent toutes seules, dans l'ordre où vous les avez ajoutées.
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
  // La colonne est centrée : calée à gauche, elle laissait sur grand écran tout
  // le vide du même côté. `formMax` et non `panelMax` : les aperçus gardent
  // leur rapport d'image, donc élargir la colonne les grandirait d'autant.
  // La zone sûre, elle, est dégagée par le layout de l'admin.
  header: {
    maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.v20, paddingBottom: spacing.v12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  content: { padding: spacing.v20, gap: spacing.v12, width: '100%', maxWidth: breakpoints.formMax, alignSelf: 'center' },
  groupLabel: { ...typography.overline, color: colors.faint, textTransform: 'uppercase', marginTop: spacing.sm, },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  cardTitle: { ...typography.pillLabel, color: colors.ink, },
  cardDescription: { ...typography.captionSm, color: colors.faint, marginTop: spacing.v2, marginBottom: spacing.v12, },
  previewBox: { borderRadius: radii.md, overflow: 'hidden', marginBottom: spacing.v12, aspectRatio: 16 / 10, backgroundColor: colors.surfaceSunken },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  previewEmptyText: { ...typography.captionSm, color: colors.faint, textAlign: 'center', paddingHorizontal: spacing.v20, },
  actionsRow: { flexDirection: 'row', gap: spacing.v12 },
  uploadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.lave, borderRadius: radii.md, paddingVertical: spacing.v12, minHeight: cible.min, marginBottom: spacing.sm },
  uploadBtnText: { ...typography.caption, color: colors.cream, },
  deleteBtn: { width: cible.min, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radii.md, marginBottom: spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.v12 },
  photoThumbWrap: { width: 64, height: 64, borderRadius: radii.md, position: 'relative' },
  photoThumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.surfaceSunken },
  photoOrderBadge: { position: 'absolute', bottom: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radii.sm, paddingHorizontal: spacing.xs, paddingVertical: spacing.v2 },
  photoOrderText: { ...typography.badgeSm, color: colors.white, },
  // Position seule : la pastille (taille, fond, filet) est dessinée par BoutonIcone.
  photoDeleteBtn: { position: 'absolute', top: -5, right: -5 },
  addPhotoBtn: { width: 64, height: 64, borderRadius: radii.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  hint: { ...typography.captionSm, color: colors.faint, },
  infoCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12 },
  infoText: { ...typography.captionSm, color: colors.muted, flex: 1 },
});