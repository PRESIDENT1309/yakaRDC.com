import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Image, Modal,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useConfirm } from '../../lib/confirm-context';
import * as ImagePicker from 'expo-image-picker';
import {
  Save, Camera, Check, Building2, X,
  ChevronLeft, ChevronRight, Trash2,
  Images, Info, Contact, MapPin, Sparkles, Tag, DollarSign,
  UtensilsCrossed, Ticket, Clock, Users,
} from 'lucide-react-native';
import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, typography, spacing } from '../../lib/theme';
import { getCitySubdivisions } from '../../lib/geography';
import OfferManager from '../../components/OfferManager';
import type { Establishment, ListingPhoto, EstablishmentType } from '../../lib/types';
import type { DayKey, DayHours, OpeningHours } from '../../lib/opening-hours';

// Titre de section : icône lucide nue + libellé. La pastille colorée qui
// entourait l'icône a été retirée (anti-pattern « icône dans un cercle
// coloré »), en même temps que components/SectionIcons.tsx — une seconde
// bibliothèque d'icônes maison dans un projet qui impose lucide.
function CardTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.cardTitleRow}>
      {icon}
      <Text style={styles.cardTitleText}>{label}</Text>
    </View>
  );
}

const SECTION_ICON = { size: 15, color: colors.lave, strokeWidth: 1.75 } as const;

// Un hôtelier ne parle pas d'« offres » : le titre suit son métier.
const OFFER_SECTION_TITLE: Record<EstablishmentType, string> = {
  hotel: 'Mes chambres',
  furnished_house: 'Mon logement',
  restaurant: 'Mes formules',
  site: 'Mes billets',
};

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Lundi' },
  { key: 'tue', label: 'Mardi' },
  { key: 'wed', label: 'Mercredi' },
  { key: 'thu', label: 'Jeudi' },
  { key: 'fri', label: 'Vendredi' },
  { key: 'sat', label: 'Samedi' },
  { key: 'sun', label: 'Dimanche' },
];

const ALL_AMENITIES = [
  'Wifi', 'Parking', 'Climatisation', 'Petit-déjeuner',
  'Piscine', 'Salle de conférence', 'Restaurant', 'Bar',
  'Sécurité 24h', 'Générateur', 'Eau chaude', 'TV satellite',
];

function Field({ label, value, onChange, placeholder, multiline = false, keyboardType = 'default' }:
  { label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; multiline?: boolean; keyboardType?: any }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.faint} multiline={multiline}
        numberOfLines={multiline ? 4 : 1} keyboardType={keyboardType}
      />
    </View>
  );
}

export default function EstablishmentScreen() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone]             = useState('');
  const [email, setEmail]             = useState('');
  const [instagram, setInstagram]     = useState('');
  const [tiktok, setTiktok]           = useState('');
  const [commune, setCommune]         = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [avenue, setAvenue]           = useState('');
  const [numero, setNumero]           = useState('');
  const [reference, setReference]     = useState('');
  const [amenities, setAmenities]     = useState<string[]>([]);
  const [price, setPrice]             = useState('');
  const [currency, setCurrency]       = useState('USD');
  const [capacity, setCapacity]       = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountLabel, setDiscountLabel]     = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [checkinCount, setCheckinCount] = useState(0);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Photos Menu (restaurant) ou Tarifs (site)
  const [menuPhotos, setMenuPhotos] = useState<ListingPhoto[]>([]);
  const [uploadingMenuPhoto, setUploadingMenuPhoto] = useState(false);
  const [menuViewerIndex, setMenuViewerIndex] = useState<number | null>(null);

  // Index de la photo affichée en plein écran dans la visionneuse (null = fermée)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Horaires d'ouverture
  const [alwaysOpen, setAlwaysOpen] = useState(false);
  const [hours, setHours] = useState<Partial<Record<DayKey, DayHours | null>>>({});

  const fetchEstablishment = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('establishments').select('*')
      .eq('owner_id', profile.id).limit(1).maybeSingle();

    if (data) {
      const e = data as Establishment;
      setEstablishment(e);
      setName(e.name ?? '');
      setDescription(e.description ?? '');
      setPhone(e.phone ?? '');
      setEmail((e as any).email ?? '');
      setInstagram((e as any).instagram ?? '');
      setTiktok((e as any).tiktok ?? '');
      setCommune((e as any).commune ?? '');
      setNeighborhood(e.neighborhood ?? '');
      setAvenue((e as any).avenue ?? '');
      setNumero((e as any).numero ?? '');
      setReference((e as any).reference ?? '');
      setAmenities(e.amenities ?? []);
      setDiscountPercent(e.discount_percent != null ? String(e.discount_percent) : '');
      setDiscountLabel(e.discount_label ?? '');
      setCapacity(e.capacity != null ? String(e.capacity) : '');
      setLogoUrl(e.logo_url ?? null);
      const oh = (e as any).opening_hours as OpeningHours | null | undefined;
      setAlwaysOpen(oh?.always_open ?? false);
      setHours(oh?.days ?? {});

      const { data: photoRows } = await supabase.from('listing_photos')
        .select('*').eq('establishment_id', e.id).order('position', { ascending: true });
      const allPhotos = (photoRows as ListingPhoto[]) ?? [];
      // Les photos rattachées à une offre (offer_id) sont gérées dans « Mes
      // offres » et ne doivent pas apparaître dans la galerie générale.
      setPhotos(allPhotos.filter(p => !p.offer_id && (!p.category || p.category === 'general')));
      setMenuPhotos(allPhotos.filter(p => p.category === 'menu' || p.category === 'pricing'));

      // « À partir de » affiché sur la vignette : l'offre active la moins
      // chère. Lu directement dans le catalogue, plus dans `rates`.
      const { data: cheapest } = await supabase.from('establishment_offers')
        .select('price, currency').eq('establishment_id', e.id).eq('is_active', true)
        .order('price', { ascending: true }).limit(1).maybeSingle();
      if (cheapest) { setPrice(String(cheapest.price)); setCurrency(cheapest.currency); }
      else { setPrice(''); }

      const { data: bookings } = await supabase.from('bookings')
        .select('status').eq('establishment_id', e.id);
      if (bookings) {
        setPendingCount(bookings.filter((b: any) => b.status === 'pending').length);
        setConfirmedCount(bookings.filter((b: any) => b.status === 'confirmed').length);
        setCheckinCount(bookings.filter((b: any) => b.status === 'checked_in').length);
      }
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchEstablishment(); }, [fetchEstablishment]);

  // Si des photos sont supprimées pendant que la visionneuse est ouverte,
  // ramène l'index dans les limites valides (ou ferme si plus aucune photo)
  useEffect(() => {
    if (viewerIndex === null) return;
    if (photos.length === 0) { setViewerIndex(null); return; }
    if (viewerIndex > photos.length - 1) { setViewerIndex(photos.length - 1); }
  }, [photos.length, viewerIndex]);

  useEffect(() => {
    if (menuViewerIndex === null) return;
    if (menuPhotos.length === 0) { setMenuViewerIndex(null); return; }
    if (menuViewerIndex > menuPhotos.length - 1) { setMenuViewerIndex(menuPhotos.length - 1); }
  }, [menuPhotos.length, menuViewerIndex]);

  // Ouvre le sélecteur d'image et retourne l'URI choisie, ou null si annulé
  async function pickImage(): Promise<string | null> {
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

  // Envoie un fichier local vers Supabase Storage et retourne son URL publique
  async function uploadToStorage(uri: string, path: string): Promise<string | null> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('establishment-photos')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('establishment-photos').getPublicUrl(path);
      return data.publicUrl;
    } catch {
      Alert.alert('Erreur', "L'envoi de l'image a échoué. Vérifiez votre connexion et réessayez.");
      return null;
    }
  }

  async function handlePickLogo() {
    if (!establishment) return;
    const uri = await pickImage();
    if (!uri) return;
    setUploadingLogo(true);
    const path = `${establishment.id}/logo-${Date.now()}.jpg`;
    const publicUrl = await uploadToStorage(uri, path);
    if (publicUrl) {
      await supabase.from('establishments').update({ logo_url: publicUrl }).eq('id', establishment.id);
      setLogoUrl(publicUrl);
    }
    setUploadingLogo(false);
  }

  async function handleAddPhoto() {
    if (!establishment) return;
    if (photos.length >= 10) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez pas ajouter plus de 10 photos.');
      return;
    }
    const uri = await pickImage();
    if (!uri) return;
    setUploadingPhoto(true);
    const path = `${establishment.id}/photo-${Date.now()}.jpg`;
    const publicUrl = await uploadToStorage(uri, path);
    if (publicUrl) {
      const { data } = await supabase.from('listing_photos')
        .insert({ establishment_id: establishment.id, url: publicUrl, position: photos.length, category: 'general' })
        .select()
        .single();
      if (data) setPhotos(prev => [...prev, data as ListingPhoto]);
    }
    setUploadingPhoto(false);
  }

  async function handleDeletePhoto(photo: ListingPhoto) {
    const ok = await confirm({
      title: 'Supprimer cette photo',
      message: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    await supabase.from('listing_photos').delete().eq('id', photo.id);
    const storagePath = photo.url.split('/establishment-photos/')[1];
    if (storagePath) {
      await supabase.storage.from('establishment-photos').remove([storagePath]);
    }
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
  }

  // ── Photos Menu / Tarifs ──
  const menuCategory: 'menu' | 'pricing' | null =
    establishment?.type === 'restaurant' ? 'menu' :
    establishment?.type === 'site' ? 'pricing' : null;

  async function handleAddMenuPhoto() {
    if (!establishment || !menuCategory) return;
    if (menuPhotos.length >= 10) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez pas ajouter plus de 10 photos.');
      return;
    }
    const uri = await pickImage();
    if (!uri) return;
    setUploadingMenuPhoto(true);
    const path = `${establishment.id}/${menuCategory}-${Date.now()}.jpg`;
    const publicUrl = await uploadToStorage(uri, path);
    if (publicUrl) {
      const { data } = await supabase.from('listing_photos')
        .insert({ establishment_id: establishment.id, url: publicUrl, position: menuPhotos.length, category: menuCategory })
        .select()
        .single();
      if (data) setMenuPhotos(prev => [...prev, data as ListingPhoto]);
    }
    setUploadingMenuPhoto(false);
  }

  async function handleDeleteMenuPhoto(photo: ListingPhoto) {
    const ok = await confirm({
      title: 'Supprimer cette photo',
      message: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    await supabase.from('listing_photos').delete().eq('id', photo.id);
    const storagePath = photo.url.split('/establishment-photos/')[1];
    if (storagePath) {
      await supabase.storage.from('establishment-photos').remove([storagePath]);
    }
    setMenuPhotos(prev => prev.filter(p => p.id !== photo.id));
  }

  async function handleSave() {
    if (!establishment) return;
    setSaving(true);

    const openingHours: OpeningHours = { always_open: alwaysOpen, days: hours };
    const { error } = await supabase.from('establishments').update({
      name, description, phone,
      email, instagram, tiktok,
      commune, neighborhood, avenue, numero, reference, amenities,
      discount_percent: discountPercent ? parseInt(discountPercent, 10) : null,
      discount_label: discountLabel.trim() || null,
      capacity: capacity ? parseInt(capacity, 10) : null,
      opening_hours: openingHours,
    }).eq('id', establishment.id);

    // 42703 = colonne inexistante : la migration opening_hours n'a pas encore
    // été appliquée en base. On le dit clairement plutôt que d'échouer en
    // silence sur l'ensemble de l'enregistrement.
    if (error) {
      setSaving(false);
      Alert.alert(
        'Enregistrement incomplet',
        (error as any).code === '42703'
          ? "Les horaires n'ont pas pu être enregistrés : la colonne opening_hours n'existe pas encore en base. Les autres informations non plus — contactez le support."
          : error.message,
      );
      return;
    }

    // `rates` n'est plus écrite ici : elle est désormais alimentée par le
    // trigger sur establishment_offers, qui y répercute le prix le plus bas
    // parmi les offres actives. Réécrire depuis cet écran écraserait la valeur
    // calculée par une valeur d'état devenue périmée dès la première offre.
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // Un jour absent/null = fermé. Basculer vers « ouvert » propose un créneau
  // par défaut plutôt que deux champs vides.
  function toggleDay(key: DayKey) {
    setHours(prev => ({
      ...prev,
      [key]: prev[key] ? null : { from: '08:00', to: '18:00' },
    }));
  }

  function setDayTime(key: DayKey, field: 'from' | 'to', value: string) {
    setHours(prev => {
      const cur = prev[key];
      if (!cur) return prev;
      return { ...prev, [key]: { ...cur, [field]: value } };
    });
  }

  // Saisir sept fois le même créneau est pénible : on recopie lundi partout.
  // Les jours explicitement fermés le restent.
  function applyMondayToAll() {
    const monday = hours.mon;
    if (!monday) {
      Alert.alert('Lundi fermé', "Renseignez d'abord les horaires du lundi.");
      return;
    }
    setHours(prev => {
      const next: Partial<Record<DayKey, DayHours | null>> = { ...prev };
      for (const d of DAYS) {
        if (prev[d.key]) next[d.key] = { ...monday };
      }
      next.mon = { ...monday };
      return next;
    });
  }

  function toggleAmenity(a: string) {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  if (!establishment) return (
    <View style={styles.loading}>
      <Building2 size={36} color={colors.borderStrong} />
      <Text style={styles.emptyText}>Aucun établissement trouvé.</Text>
    </View>
  );

  const unitLabel = establishment.type === 'hotel' || establishment.type === 'furnished_house'
    ? 'nuit' : 'personne';
  // La commune est déterminée par la ville de l'établissement (fixe, non
  // modifiable ici) — pas par une ville "actuellement parcourue".
  const subdivisions = getCitySubdivisions(establishment.city);
  // Donnée historique qui ne correspond à aucune commune connue (ex. saisie
  // libre d'avant ce chantier) — à signaler, jamais à corriger seule ni à
  // bloquer la sauvegarde du reste de la fiche.
  const isUnknownCommune = !!(commune && subdivisions && !subdivisions.all.includes(commune));
  const currentViewerPhoto = viewerIndex !== null ? photos[viewerIndex] : null;
  const currentMenuViewerPhoto = menuViewerIndex !== null ? menuPhotos[menuViewerIndex] : null;
  const menuSectionTitle = menuCategory === 'menu' ? 'Photos du menu' : 'Tarifs des attractions';
  const menuSectionHint = menuCategory === 'menu'
    ? 'Prenez en photo votre carte ou votre menu — les voyageurs la verront sur votre fiche.'
    : "Prenez en photo votre grille tarifaire — les voyageurs la verront sur votre fiche.";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Mon établissement</Text>
            <Text style={styles.headerSub}>Modifications visibles par les voyageurs</Text>
          </View>
          <Pressable style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FAF8F4" size="small" /> :
             saved ? <><Check size={14} color="#FAF8F4" /><Text style={styles.saveBtnText}>Sauvegardé ✓</Text></> :
             <><Save size={14} color="#FAF8F4" /><Text style={styles.saveBtnText}>Sauvegarder</Text></>}
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: colors.lave }]}>{pendingCount}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: '#1F4D3A' }]}>{confirmedCount}</Text>
              <Text style={styles.statLabel}>Confirmées</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: colors.ink }]}>{checkinCount}</Text>
              <Text style={styles.statLabel}>Check-ins</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FAEEDA', borderColor: '#F0C070' }]}>
              <Text style={[styles.statVal, { color: '#854F0B', fontSize: 15 }]}>
                {price ? `${price}$` : '—'}
              </Text>
              <Text style={[styles.statLabel, { color: '#854F0B' }]}>/{unitLabel}</Text>
            </View>
          </View>

          {/* Logo + Photos */}
          <View style={styles.card}>
            <CardTitle icon={<Images {...SECTION_ICON} />} label="Logo & Photos" />
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View style={{ alignItems: 'center', gap: 5 }}>
                <Text style={styles.subLabel}>Logo</Text>
                <Pressable style={styles.logoBox} onPress={handlePickLogo} disabled={uploadingLogo}>
                  {uploadingLogo ? (
                    <ActivityIndicator color={colors.lave} size="small" />
                  ) : logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={styles.logoImage} />
                  ) : (
                    <Svg width="40" height="40" viewBox="0 0 120 120">
                      <Rect width="120" height="120" rx="20" fill="#993C1D" />
                      <Circle cx="60" cy="48" r="22" fill="#FAC775" />
                      <Polygon points="34,80 60,38 86,80" fill="#712B13" />
                      <Path d="M28,96 Q60,88 92,96" stroke="#FAC775" strokeWidth="5" fill="none" strokeLinecap="round" />
                    </Svg>
                  )}
                  <Text style={{ fontSize: 9, color: colors.lave, marginTop: 4 }}>Changer</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subLabel, { marginBottom: 8 }]}>Photos ({photos.length}/10)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {photos.map((photo, index) => (
                    <View key={photo.id} style={styles.photoThumbWrap}>
                      <Pressable onPress={() => setViewerIndex(index)}>
                        <Image source={{ uri: photo.url }} style={styles.photoThumb} />
                      </Pressable>
                      <Pressable style={styles.photoDeleteBtn} onPress={() => handleDeletePhoto(photo)} hitSlop={6}>
                        <X size={11} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                  {photos.length < 10 && (
                    <Pressable style={styles.addPhotoBtn} onPress={handleAddPhoto} disabled={uploadingPhoto}>
                      {uploadingPhoto ? (
                        <ActivityIndicator color={colors.faint} size="small" />
                      ) : (
                        <>
                          <Camera size={20} color={colors.faint} />
                          <Text style={{ fontSize: 10, color: colors.faint, marginTop: 4, textAlign: 'center' }}>
                            Ajouter
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
                <Text style={styles.hint}>JPG, PNG · Max 5 MB · 10 photos max · Touchez une photo pour l'agrandir</Text>
              </View>
            </View>
          </View>

          {/* Menu (restaurant) ou Tarifs (site) — uniquement pour ces deux types */}
          {menuCategory && (
            <View style={styles.card}>
              <CardTitle icon={menuCategory === 'menu' ? <UtensilsCrossed {...SECTION_ICON} /> : <Ticket {...SECTION_ICON} />} label={menuSectionTitle} />
              <Text style={styles.promoHint}>{menuSectionHint}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {menuPhotos.map((photo, index) => (
                  <View key={photo.id} style={styles.photoThumbWrap}>
                    <Pressable onPress={() => setMenuViewerIndex(index)}>
                      <Image source={{ uri: photo.url }} style={styles.photoThumb} />
                    </Pressable>
                    <Pressable style={styles.photoDeleteBtn} onPress={() => handleDeleteMenuPhoto(photo)} hitSlop={6}>
                      <X size={11} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
                {menuPhotos.length < 10 && (
                  <Pressable style={styles.addPhotoBtn} onPress={handleAddMenuPhoto} disabled={uploadingMenuPhoto}>
                    {uploadingMenuPhoto ? (
                      <ActivityIndicator color={colors.faint} size="small" />
                    ) : (
                      <>
                        <Camera size={20} color={colors.faint} />
                        <Text style={{ fontSize: 10, color: colors.faint, marginTop: 4, textAlign: 'center' }}>
                          Ajouter
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
              <Text style={styles.hint}>{menuPhotos.length}/10 photos</Text>
            </View>
          )}

          {/* Infos générales */}
          <View style={styles.card}>
            <CardTitle icon={<Info {...SECTION_ICON} />} label="Informations générales" />
            <Field label="Nom de l'établissement" value={name} onChange={setName} placeholder="Ex : Hôtel Wenge" />
            <Field label="Description" value={description} onChange={setDescription}
              placeholder="Décrivez votre établissement en quelques phrases..." multiline />
          </View>

          {/* Contact */}
          <View style={styles.card}>
            <CardTitle icon={<Contact {...SECTION_ICON} />} label="Contact & Réseaux sociaux" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Email" value={email} onChange={setEmail} placeholder="contact@exemple.cd" keyboardType="email-address" /></View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="@votre_compte" /></View>
              <View style={{ flex: 1 }}><Field label="TikTok" value={tiktok} onChange={setTiktok} placeholder="@votre_compte" /></View>
            </View>
          </View>

          {/* Adresse */}
          <View style={styles.card}>
            <CardTitle icon={<MapPin {...SECTION_ICON} />} label="Adresse complète" />
            {subdivisions && (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Commune</Text>
                {isUnknownCommune && (
                  <View style={styles.communeWarning}>
                    <Text style={styles.communeWarningText}>
                      Valeur actuelle non reconnue : « {commune} ».{'\n'}Sélectionnez une commune pour mettre à jour cette information.
                    </Text>
                  </View>
                )}
                <View style={styles.amenitiesGrid}>
                  {subdivisions.all.map(c => {
                    const active = commune === c;
                    return (
                      <Pressable
                        key={c}
                        style={[styles.communeChip, active && styles.communeChipActive]}
                        onPress={() => setCommune(c)}
                      >
                        <Text style={[styles.communeChipText, active && styles.communeChipTextActive]}>{c}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            <Field label="Quartier" value={neighborhood} onChange={setNeighborhood} placeholder="Ex : Centre-ville" />
            <View style={styles.row}>
              <View style={{ flex: 2 }}><Field label="Avenue" value={avenue} onChange={setAvenue} placeholder="Ex : Roi Baudouin" /></View>
              <View style={{ flex: 1 }}><Field label="Numéro" value={numero} onChange={setNumero} placeholder="Ex : 14" /></View>
            </View>
            <Field label="Référence / point de repère" value={reference} onChange={setReference}
              placeholder="Ex : En face de la Banque Centrale" />
          </View>

          {/* Équipements */}
          <View style={styles.card}>
            <CardTitle icon={<Sparkles {...SECTION_ICON} />} label="Équipements & services" />
            <View style={styles.amenitiesGrid}>
              {ALL_AMENITIES.map(a => {
                const active = amenities.includes(a);
                return (
                  <Pressable key={a}
                    style={[styles.amenityChip, active && styles.amenityChipActive]}
                    onPress={() => toggleAmenity(a)}>
                    {active && <Check size={11} color="#1F4D3A" />}
                    <Text style={[styles.amenityText, active && styles.amenityTextActive]}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Promotion du jour */}
          <View style={styles.card}>
            <CardTitle icon={<Tag {...SECTION_ICON} />} label="Promotion du jour" />
            <Text style={styles.promoHint}>
              Affichez une réduction dans le planificateur de voyage des utilisateurs. Laissez vide pour ne pas afficher de promotion.
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Réduction (%)" value={discountPercent} onChange={setDiscountPercent} placeholder="Ex : 20" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 2 }}>
                <Field label="Libellé (optionnel)" value={discountLabel} onChange={setDiscountLabel} placeholder="Ex : Happy hour -20%" />
              </View>
            </View>
          </View>

          {/* Horaires d'ouverture */}
          <View style={styles.card}>
            <CardTitle icon={<Clock {...SECTION_ICON} />} label="Horaires d'ouverture" />

            <Pressable style={styles.hoursToggleRow} onPress={() => setAlwaysOpen(v => !v)}>
              <View style={[styles.checkbox, alwaysOpen && styles.checkboxOn]}>
                {alwaysOpen && <Check size={12} color={colors.cream} strokeWidth={2.5} />}
              </View>
              <Text style={styles.hoursToggleLabel}>Ouvert 24h/24</Text>
            </Pressable>

            {!alwaysOpen && (
              <>
                <Pressable style={styles.applyAllBtn} onPress={applyMondayToAll}>
                  <Text style={styles.applyAllText}>Appliquer lundi à tous les jours</Text>
                </Pressable>

                {DAYS.map(d => {
                  const dh = hours[d.key];
                  const isOpen = !!dh;
                  return (
                    <View key={d.key} style={styles.dayRow}>
                      <Pressable style={styles.dayToggle} onPress={() => toggleDay(d.key)}>
                        <View style={[styles.checkbox, isOpen && styles.checkboxOn]}>
                          {isOpen && <Check size={12} color={colors.cream} strokeWidth={2.5} />}
                        </View>
                        <Text style={styles.dayLabel}>{d.label}</Text>
                      </Pressable>

                      {isOpen ? (
                        <View style={styles.dayTimes}>
                          <TextInput
                            style={styles.timeInput}
                            value={dh!.from}
                            onChangeText={v => setDayTime(d.key, 'from', v)}
                            placeholder="08:00"
                            placeholderTextColor={colors.faint}
                            maxLength={5}
                          />
                          <Text style={styles.timeSeparator}>→</Text>
                          <TextInput
                            style={styles.timeInput}
                            value={dh!.to}
                            onChangeText={v => setDayTime(d.key, 'to', v)}
                            placeholder="22:00"
                            placeholderTextColor={colors.faint}
                            maxLength={5}
                          />
                        </View>
                      ) : (
                        <Text style={styles.dayClosed}>Fermé</Text>
                      )}
                    </View>
                  );
                })}
                <Text style={styles.hoursHint}>
                  Format 24h (ex. 08:00). Une fermeture après minuit s'écrit 19:00 → 02:00.
                </Text>
              </>
            )}
          </View>

          {/* Tarif */}
          <View style={styles.card}>
            <CardTitle icon={<DollarSign {...SECTION_ICON} />} label={OFFER_SECTION_TITLE[establishment.type]} />
            {/* Le prix n'est plus saisi ici : il découle des offres. Depuis le
                lot B2, tous les écrans lisent `establishment_offers`
                directement — la table `rates` n'a plus de lecteur. */}
            <OfferManager
              establishmentId={establishment.id}
              establishmentType={establishment.type}
              amenityOptions={ALL_AMENITIES}
              onChanged={fetchEstablishment}
            />
          </View>

          {/* Capacité — reste au niveau de l'établissement pour l'instant.
              Elle descendra au niveau de l'offre au lot B2, quand le calcul de
              disponibilité basculera dessus. */}
          <View style={styles.card}>
            <CardTitle icon={<Users {...SECTION_ICON} />} label="Capacité d'accueil" />
            <Field
              label={
                establishment.type === 'restaurant' ? 'Capacité (couverts par créneau)'
                : establishment.type === 'site' ? 'Capacité (visiteurs par créneau)'
                : 'Capacité (personnes par nuit)'
              }
              value={capacity}
              onChange={setCapacity}
              placeholder="Ex : 40 — laissez vide pour aucune limite"
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>
              Sert à bloquer automatiquement les dates complètes côté voyageur. Ce nombre ne lui est jamais affiché.
            </Text>
          </View>

          <Pressable style={[styles.saveBtnFull, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FAF8F4" /> :
             <><Save size={16} color="#FAF8F4" /><Text style={styles.saveBtnFullText}>Sauvegarder les modifications</Text></>}
          </Pressable>
        </ScrollView>

        {/* Visionneuse plein écran : photos générales */}
        <Modal
          visible={viewerIndex !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerIndex(null)}
        >
          <View style={styles.viewerOverlay}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerCounter}>
                {viewerIndex !== null ? `${viewerIndex + 1} / ${photos.length}` : ''}
              </Text>
              <Pressable onPress={() => setViewerIndex(null)} hitSlop={12}>
                <X size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.viewerImageWrap}>
              {currentViewerPhoto && (
                <Image
                  source={{ uri: currentViewerPhoto.url }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              )}
            </View>

            <View style={styles.viewerFooter}>
              <Pressable
                style={[styles.viewerNavBtn, viewerIndex === 0 && styles.viewerNavBtnDisabled]}
                onPress={() => setViewerIndex(i => (i !== null && i > 0 ? i - 1 : i))}
                disabled={viewerIndex === 0}
                hitSlop={10}
              >
                <ChevronLeft size={22} color="#FFFFFF" />
              </Pressable>

              <Pressable
                style={styles.viewerDeleteBtn}
                onPress={() => currentViewerPhoto && handleDeletePhoto(currentViewerPhoto)}
              >
                <Trash2 size={15} color="#FFFFFF" />
                <Text style={styles.viewerDeleteText}>Supprimer</Text>
              </Pressable>

              <Pressable
                style={[styles.viewerNavBtn, viewerIndex === photos.length - 1 && styles.viewerNavBtnDisabled]}
                onPress={() => setViewerIndex(i => (i !== null && i < photos.length - 1 ? i + 1 : i))}
                disabled={viewerIndex === photos.length - 1}
                hitSlop={10}
              >
                <ChevronRight size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Visionneuse plein écran : Menu / Tarifs */}
        <Modal
          visible={menuViewerIndex !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuViewerIndex(null)}
        >
          <View style={styles.viewerOverlay}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerCounter}>
                {menuViewerIndex !== null ? `${menuViewerIndex + 1} / ${menuPhotos.length}` : ''}
              </Text>
              <Pressable onPress={() => setMenuViewerIndex(null)} hitSlop={12}>
                <X size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.viewerImageWrap}>
              {currentMenuViewerPhoto && (
                <Image
                  source={{ uri: currentMenuViewerPhoto.url }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              )}
            </View>

            <View style={styles.viewerFooter}>
              <Pressable
                style={[styles.viewerNavBtn, menuViewerIndex === 0 && styles.viewerNavBtnDisabled]}
                onPress={() => setMenuViewerIndex(i => (i !== null && i > 0 ? i - 1 : i))}
                disabled={menuViewerIndex === 0}
                hitSlop={10}
              >
                <ChevronLeft size={22} color="#FFFFFF" />
              </Pressable>

              <Pressable
                style={styles.viewerDeleteBtn}
                onPress={() => currentMenuViewerPhoto && handleDeleteMenuPhoto(currentMenuViewerPhoto)}
              >
                <Trash2 size={15} color="#FFFFFF" />
                <Text style={styles.viewerDeleteText}>Supprimer</Text>
              </Pressable>

              <Pressable
                style={[styles.viewerNavBtn, menuViewerIndex === menuPhotos.length - 1 && styles.viewerNavBtnDisabled]}
                onPress={() => setMenuViewerIndex(i => (i !== null && i < menuPhotos.length - 1 ? i + 1 : i))}
                disabled={menuViewerIndex === menuPhotos.length - 1}
                hitSlop={10}
              >
                <ChevronRight size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.cream },
  emptyText: { fontSize: 14, color: colors.muted },
  header: {
    backgroundColor: colors.lave, paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16, paddingHorizontal: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '500', color: '#FAF8F4' },
  headerSub: { fontSize: 11, color: 'rgba(250,248,244,0.7)', marginTop: 2 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  saveBtnText: { fontSize: 12, color: '#FAF8F4', fontWeight: '500' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  statVal: { fontSize: 20, fontWeight: '500' },
  statLabel: { fontSize: 9, color: colors.muted, marginTop: 2 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 13, fontWeight: '500', color: colors.ink, marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13 },
  cardTitleText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  // ── Horaires d'ouverture ──
  hoursToggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  hoursToggleLabel: { ...typography.body, color: colors.ink },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.lave, borderColor: colors.lave },
  applyAllBtn: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  applyAllText: { ...typography.caption, color: colors.lave, textDecorationLine: 'underline' },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  dayToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  dayLabel: { ...typography.body, color: colors.ink },
  dayTimes: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timeInput: {
    ...typography.caption, color: colors.ink, textAlign: 'center',
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, width: 66,
  },
  timeSeparator: { ...typography.caption, color: colors.faint },
  dayClosed: { ...typography.caption, color: colors.faint },
  hoursHint: { ...typography.caption, color: colors.faint, marginTop: spacing.sm, lineHeight: 17 },
  subLabel: { fontSize: 10, color: colors.faint },
  logoBox: { width: 70, height: 70, borderRadius: 12, backgroundColor: colors.laveSoft, borderWidth: 1, borderColor: '#F5C4B3', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%', borderRadius: 12 },
  addPhotoBtn: { width: 72, height: 72, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  photoThumbWrap: { width: 72, height: 72, borderRadius: 10, overflow: 'visible', position: 'relative' },
  photoThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F5F4F0' },
  photoDeleteBtn: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#C0392B', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FAF8F4',
  },
  hint: { fontSize: 10, color: colors.faint, marginTop: 6 },
  promoHint: { fontSize: 11, color: colors.muted, marginBottom: 10, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 10 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '500', color: colors.muted, marginBottom: 4 },
  fieldInput: { backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink },
  fieldInputMulti: { height: 80, textAlignVertical: 'top' },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  amenityChipActive: { backgroundColor: '#DCEEE3', borderColor: '#A8D5B5' },
  amenityText: { fontSize: 11, color: colors.muted },
  amenityTextActive: { color: '#1F4D3A', fontWeight: '500' },
  communeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderStrong },
  communeChipActive: { backgroundColor: colors.laveSoft, borderColor: colors.lave },
  communeChipText: { fontSize: 11.5, color: colors.muted },
  communeChipTextActive: { color: colors.lave, fontWeight: '500' },
  communeWarning: { backgroundColor: colors.orSoft, borderRadius: 8, padding: 10, marginBottom: 10 },
  communeWarningText: { fontSize: 11, color: colors.or, lineHeight: 16 },
  saveBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.lave, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  saveBtnFullText: { fontSize: 15, fontWeight: '500', color: '#FAF8F4' },

  // Visionneuse plein écran
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  viewerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 18, paddingBottom: 12,
  },
  viewerCounter: { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
  viewerImageWrap: { flex: 1, paddingHorizontal: 10 },
  viewerFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 12,
  },
  viewerNavBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  viewerNavBtnDisabled: { opacity: 0.3 },
  viewerDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(192,57,43,0.9)', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 11,
  },
  viewerDeleteText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
});