import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Plus, Pencil, Trash2, Camera, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Alert } from '../lib/alert';
import { useConfirm } from '../lib/confirm-context';
import { colors, typography, radii, spacing } from '../lib/theme';
import { pickImage, uploadToStorage, removeFromStorage } from '../lib/photo-upload';
import Sheet from './Sheet';
import FormField from './FormField';
import Button from './Button';
import Chip from './Chip';
import type {
  EstablishmentType, OfferCategory, EstablishmentOffer, ListingPhoto, OfferUnit,
} from '../lib/types';
import { offerLabel } from '../lib/types';

export interface OfferManagerProps {
  establishmentId: string;
  establishmentType: EstablishmentType;
  amenityOptions: string[];
  /** Appelé après toute écriture, pour que l'écran parent rafraîchisse le tarif affiché */
  onChanged?: () => void;
}

// Titre de section adapté au métier : un hôtelier ne parle pas d'« offres ».
const SECTION_TITLE: Record<EstablishmentType, string> = {
  hotel: 'Mes chambres',
  furnished_house: 'Mon logement',
  restaurant: 'Mes formules',
  site: 'Mes billets',
};

const ADD_LABEL: Record<EstablishmentType, string> = {
  hotel: 'Ajouter une chambre',
  furnished_house: 'Ajouter un logement',
  restaurant: 'Ajouter une formule',
  site: 'Ajouter un billet',
};

// L'unité découle du type : on ne demande pas au partenaire de la choisir,
// il n'aurait aucun moyen de savoir laquelle attendre.
const UNIT_FOR_TYPE: Record<EstablishmentType, OfferUnit> = {
  hotel: 'night',
  furnished_house: 'night',
  restaurant: 'person',
  site: 'person',
};

// Libellés de quantity/max_guests selon le type — la distinction entre les
// deux est la source d'erreur principale de cet écran.
function quantityLabel(type: EstablishmentType): string {
  if (type === 'hotel' || type === 'furnished_house') return "Nombre d'unités disponibles";
  return 'Places par créneau';
}
function maxGuestsLabel(type: EstablishmentType): string {
  if (type === 'hotel' || type === 'furnished_house') return 'Personnes par unité';
  return 'Personnes par billet';
}

interface Draft {
  id: string | null;
  categoryId: string;
  customLabel: string;
  description: string;
  price: string;
  currency: string;
  quantity: string;
  maxGuests: string;
  amenities: string[];
}

const EMPTY_DRAFT: Draft = {
  id: null, categoryId: '', customLabel: '', description: '',
  price: '', currency: 'USD', quantity: '', maxGuests: '', amenities: [],
};

export default function OfferManager({
  establishmentId, establishmentType, amenityOptions, onChanged,
}: OfferManagerProps) {
  const confirm = useConfirm();
  const [categories, setCategories] = useState<OfferCategory[]>([]);
  const [offers, setOffers] = useState<EstablishmentOffer[]>([]);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTables, setMissingTables] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [cats, offs, phs] = await Promise.all([
      supabase.from('offer_categories').select('*')
        .eq('establishment_type', establishmentType).eq('is_active', true)
        .order('position', { ascending: true }),
      supabase.from('establishment_offers').select('*')
        .eq('establishment_id', establishmentId)
        .order('position', { ascending: true }).order('price', { ascending: true }),
      supabase.from('listing_photos').select('*').eq('establishment_id', establishmentId),
    ]);

    // La migration 0007 n'a pas encore été appliquée : on le dit clairement
    // plutôt que d'afficher une section vide qui ressemblerait à un bug.
    if (cats.error || offs.error) {
      setMissingTables(true);
      setLoading(false);
      return;
    }
    setMissingTables(false);
    setCategories((cats.data as OfferCategory[]) ?? []);
    setOffers((offs.data as EstablishmentOffer[]) ?? []);
    setPhotos(((phs.data as ListingPhoto[]) ?? []).filter(p => p.offer_id));
    setLoading(false);
  }, [establishmentId, establishmentType]);

  useEffect(() => { load(); }, [load]);

  function categoryOf(offer: EstablishmentOffer) {
    return categories.find(c => c.id === offer.category_id);
  }
  function photoOf(offerId: string) {
    return photos.find(p => p.offer_id === offerId) ?? null;
  }

  function openNew() {
    setDraft({ ...EMPTY_DRAFT, categoryId: categories[0]?.id ?? '' });
  }

  function openEdit(o: EstablishmentOffer) {
    setDraft({
      id: o.id,
      categoryId: o.category_id,
      customLabel: o.custom_label ?? '',
      description: o.description ?? '',
      price: String(o.price),
      currency: o.currency,
      quantity: o.quantity != null ? String(o.quantity) : '',
      maxGuests: o.max_guests != null ? String(o.max_guests) : '',
      amenities: o.amenities ?? [],
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.categoryId) { Alert.alert('Catégorie requise', 'Choisissez une catégorie.'); return; }
    const price = parseFloat(draft.price.replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Prix invalide', 'Indiquez un prix, même approximatif.');
      return;
    }

    setSaving(true);
    const payload = {
      establishment_id: establishmentId,
      category_id: draft.categoryId,
      custom_label: draft.customLabel.trim() || null,
      description: draft.description.trim() || null,
      price,
      currency: draft.currency.trim() || 'USD',
      unit: UNIT_FOR_TYPE[establishmentType],
      quantity: draft.quantity ? parseInt(draft.quantity, 10) : null,
      max_guests: draft.maxGuests ? parseInt(draft.maxGuests, 10) : null,
      amenities: draft.amenities,
    };

    const { error } = draft.id
      ? await supabase.from('establishment_offers').update(payload).eq('id', draft.id)
      : await supabase.from('establishment_offers').insert({ ...payload, position: offers.length });

    setSaving(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    setDraft(null);
    await load();
    onChanged?.();
  }

  /**
   * Réservations à venir portant sur une offre : celles qu'un masquage
   * laisserait en suspens. Le passé n'est pas concerné — on ne réécrit pas
   * l'histoire, on ne s'occupe que de ce que le partenaire devra honorer.
   */
  async function upcomingBookings(offerId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('booking_items')
      .select('booking_id, bookings!inner(id, status, check_out, visit_date)')
      .eq('offer_id', offerId)
      .in('bookings.status', ['pending', 'confirmed']);
    if (error) return { rows: null as any[] | null, error };

    const rows = ((data as any[]) ?? []).filter(r => {
      const b = r.bookings;
      const end = b.check_out ?? b.visit_date;
      return end == null || end >= today;
    });
    return { rows, error: null };
  }

  // Masquer plutôt que supprimer : l'offre disparaît de l'app, les données
  // restent. C'est réversible, contrairement à la suppression.
  async function toggleActive(o: EstablishmentOffer) {
    // Remettre en ligne n'engage personne : aucune vérification à faire.
    if (!o.is_active) {
      const { error } = await supabase.from('establishment_offers')
        .update({ is_active: true }).eq('id', o.id);
      if (error) { Alert.alert('Erreur', error.message); return; }
      await load(); onChanged?.();
      return;
    }

    // Retirer une catégorie déjà réservée laisserait des voyageurs avec une
    // demande que le partenaire ne compte plus honorer. On l'annonce, et si le
    // partenaire confirme, on annule ces réservations avec un motif explicite
    // plutôt que de les laisser pourrir en attente.
    const { rows, error: checkError } = await upcomingBookings(o.id);
    if (checkError) {
      Alert.alert('Masquage impossible', "Impossible de vérifier les réservations en cours sur cette offre. Réessayez plus tard.");
      return;
    }

    const affected = rows ?? [];
    if (affected.length > 0) {
      const ok = await confirm({
        title: 'Réservations en cours',
        message: `${affected.length} réservation(s) à venir portent sur « ${offerLabel(o, categoryOf(o))} ». Les masquer signifie les annuler : les voyageurs en seront informés.`,
        confirmLabel: 'Masquer et annuler',
        destructive: true,
      });
      if (!ok) return;

      const { error: cancelError } = await supabase.from('bookings')
        .update({
          status: 'cancelled',
          cancellation_reason: `L'établissement ne propose plus « ${offerLabel(o, categoryOf(o))} ».`,
        })
        .in('id', affected.map(r => r.booking_id));

      if (cancelError) {
        // On ne masque pas l'offre si les annulations ont échoué : mieux vaut
        // un état inchangé qu'une offre invisible avec des demandes ouvertes.
        Alert.alert('Annulation impossible', cancelError.message);
        return;
      }
    }

    const { error } = await supabase.from('establishment_offers')
      .update({ is_active: false }).eq('id', o.id);
    if (error) { Alert.alert('Erreur', error.message); return; }
    await load();
    onChanged?.();
    if (affected.length > 0) {
      Alert.alert('Offre masquée', `${affected.length} réservation(s) ont été annulées.`);
    }
  }

  async function remove(o: EstablishmentOffer) {
    // Une offre déjà réservée n'est plus supprimable : la ligne de réservation
    // porte le prix gelé, l'effacer amputerait l'historique comptable du
    // partenaire. Le masquage reste ouvert, lui, et suffit dans tous les cas.
    const { count, error: countError } = await supabase.from('booking_items')
      .select('id', { count: 'exact', head: true })
      .eq('offer_id', o.id);

    // Un compte illisible n'autorise pas la suppression : en cas de doute on
    // protège l'historique plutôt que de laisser passer.
    if (countError) {
      Alert.alert('Suppression impossible', "Impossible de vérifier si cette offre a déjà été réservée. Réessayez plus tard.");
      return;
    }

    if ((count ?? 0) > 0) {
      Alert.alert(
        'Suppression impossible',
        `Cette offre est rattachée à ${count} réservation(s). Masquez-la plutôt : elle disparaîtra de l'app sans effacer votre historique.`,
      );
      return;
    }

    const ok = await confirm({
      title: 'Supprimer cette offre',
      message: 'Cette action est irréversible. Pour la retirer temporairement, masquez-la plutôt.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;

    const photo = photoOf(o.id);
    const { error } = await supabase.from('establishment_offers').delete().eq('id', o.id);
    if (error) { Alert.alert('Erreur', error.message); return; }
    if (photo) await removeFromStorage(photo.url);
    await load();
    onChanged?.();
  }

  async function attachPhoto(offerId: string) {
    const uri = await pickImage();
    if (!uri) return;
    setUploading(true);
    const url = await uploadToStorage(uri, `${establishmentId}/offer-${offerId}-${Date.now()}.jpg`);
    if (url) {
      const existing = photoOf(offerId);
      if (existing) {
        await supabase.from('listing_photos').update({ url }).eq('id', existing.id);
        await removeFromStorage(existing.url);
      } else {
        await supabase.from('listing_photos').insert({
          establishment_id: establishmentId, offer_id: offerId,
          url, position: 0, category: 'general',
        });
      }
      await load();
    }
    setUploading(false);
  }

  if (loading) return <ActivityIndicator color={colors.lave} style={{ marginVertical: spacing.lg }} />;

  if (missingTables) {
    return (
      <Text style={styles.hint}>
        Le catalogue d&apos;offres n&apos;est pas encore disponible : la base de données doit être
        mise à jour (migration 0007). Vos tarifs actuels restent inchangés.
      </Text>
    );
  }

  const draftCategory = categories.find(c => c.id === draft?.categoryId);

  return (
    <View>
      {offers.length === 0 ? (
        <Text style={styles.hint}>
          Aucune offre pour l&apos;instant. Ajoutez-en une pour que les voyageurs voient vos tarifs.
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {offers.map(o => {
            const photo = photoOf(o.id);
            return (
              <View key={o.id} style={[styles.row, !o.is_active && styles.rowHidden]}>
                <Pressable accessibilityRole="button" accessibilityLabel="Changer la photo de l'offre" onPress={() => attachPhoto(o.id)} style={styles.thumb}>
                  {photo ? (
                    <Image source={{ uri: photo.url }} style={styles.thumbImg} />
                  ) : (
                    <Camera size={16} color={colors.faint} strokeWidth={1.75} />
                  )}
                </Pressable>

                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{offerLabel(o, categoryOf(o))}</Text>
                  <Text style={styles.rowMeta}>
                    {o.price} {o.currency}
                    {o.quantity != null ? ` · ${o.quantity} dispo.` : ''}
                    {o.max_guests != null ? ` · ${o.max_guests} pers.` : ''}
                  </Text>
                </View>

                <Pressable accessibilityRole="button" accessibilityLabel={o.is_active ? 'Masquer cette offre' : 'Afficher cette offre'} onPress={() => toggleActive(o)} hitSlop={8} style={styles.iconBtn}>
                  {o.is_active
                    ? <Eye size={16} color={colors.muted} strokeWidth={1.75} />
                    : <EyeOff size={16} color={colors.faint} strokeWidth={1.75} />}
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Modifier l'offre" onPress={() => openEdit(o)} hitSlop={8} style={styles.iconBtn}>
                  <Pencil size={15} color={colors.lave} strokeWidth={1.75} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Supprimer l'offre" onPress={() => remove(o)} hitSlop={8} style={styles.iconBtn}>
                  <Trash2 size={15} color={colors.faint} strokeWidth={1.75} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {uploading && <ActivityIndicator color={colors.lave} style={{ marginTop: spacing.sm }} />}

      <View style={{ marginTop: spacing.md }}>
        <Button
          label={ADD_LABEL[establishmentType]}
          variant="secondary"
          onPress={openNew}
          icon={<Plus size={15} color={colors.lave} strokeWidth={1.75} />}
        />
      </View>

      <Sheet
        visible={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Modifier' : ADD_LABEL[establishmentType]}
        subtitle={SECTION_TITLE[establishmentType]}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
          <Text style={styles.fieldLabel}>Catégorie</Text>
          <View style={styles.chipWrap}>
            {categories.map(c => (
              <Chip
                key={c.id}
                label={c.label}
                active={draft?.categoryId === c.id}
                onPress={() => setDraft(d => d && { ...d, categoryId: c.id })}
              />
            ))}
          </View>
          {!!draftCategory?.description_hint && (
            <Text style={styles.hint}>{draftCategory.description_hint}</Text>
          )}

          <FormField
            label="Nom personnalisé (facultatif)"
            value={draft?.customLabel ?? ''}
            onChange={v => setDraft(d => d && { ...d, customLabel: v })}
            placeholder={draftCategory?.label ?? 'Ex : Suite Fleuve'}
          />

          <View style={styles.row2}>
            <View style={{ flex: 2 }}>
              <FormField
                label="Prix"
                value={draft?.price ?? ''}
                onChange={v => setDraft(d => d && { ...d, price: v })}
                placeholder="Ex : 45"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormField
                label="Devise"
                value={draft?.currency ?? 'USD'}
                onChange={v => setDraft(d => d && { ...d, currency: v })}
                placeholder="USD"
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <FormField
                label={quantityLabel(establishmentType)}
                value={draft?.quantity ?? ''}
                onChange={v => setDraft(d => d && { ...d, quantity: v })}
                placeholder="Illimité si vide"
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormField
                label={maxGuestsLabel(establishmentType)}
                value={draft?.maxGuests ?? ''}
                onChange={v => setDraft(d => d && { ...d, maxGuests: v })}
                placeholder="Ex : 2"
                keyboardType="number-pad"
              />
            </View>
          </View>

          <FormField
            label="Description (facultatif)"
            value={draft?.description ?? ''}
            onChange={v => setDraft(d => d && { ...d, description: v })}
            placeholder="Ce qui distingue cette offre"
            multiline
          />

          <Text style={styles.fieldLabel}>Équipements de cette offre</Text>
          <View style={styles.chipWrap}>
            {amenityOptions.map(a => (
              <Chip
                key={a}
                label={a}
                active={draft?.amenities.includes(a)}
                onPress={() => setDraft(d => d && {
                  ...d,
                  amenities: d.amenities.includes(a)
                    ? d.amenities.filter(x => x !== a)
                    : [...d.amenities, a],
                })}
              />
            ))}
          </View>

          {draft?.id ? (
            <Text style={styles.hint}>
              La photo se change depuis la liste, en touchant la vignette.
            </Text>
          ) : (
            <Text style={styles.hint}>
              Vous pourrez ajouter une photo depuis la liste une fois l&apos;offre créée.
            </Text>
          )}

          <View style={{ marginTop: spacing.md }}>
            <Button label={draft?.id ? 'Enregistrer' : 'Créer'} onPress={save} loading={saving} />
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.faint, lineHeight: 17, marginBottom: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.ink, marginBottom: 5, marginTop: spacing.sm, },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.v6, marginBottom: spacing.sm },
  row2: { flexDirection: 'row', gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.sm,
  },
  rowHidden: { opacity: 0.55 },
  thumb: {
    width: 46, height: 46, borderRadius: radii.sm, backgroundColor: colors.surfaceSunken,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  rowTitle: { ...typography.cardTitle, color: colors.ink },
  rowMeta: { ...typography.caption, color: colors.muted, marginTop: spacing.v2 },
  iconBtn: { padding: spacing.xs },
});
