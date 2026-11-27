import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, } from 'react-native';
import { Alert } from '../../lib/alert';
import { MapPin, Plus, Check, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { ecrire } from '../../lib/db';
import { useConfirm } from '../../lib/confirm-context';
import { messageErreur } from '../../lib/erreurs';
import { colors, typography, radii, spacing, fonts, breakpoints, cible } from '../../lib/theme';
import type { City, OfferCategory, EstablishmentType } from '../../lib/types';
import BoutonIcone from '../../components/BoutonIcone';
import { etatBascule } from '../../lib/a11y';

const TYPE_LABELS: { key: EstablishmentType; label: string }[] = [
  { key: 'hotel', label: 'Hôtels' },
  { key: 'furnished_house', label: 'Maisons' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'site', label: 'Sites' },
];

export default function CitiesScreen() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCity, setNewCity] = useState('');
  const [adding, setAdding] = useState(false);
  const [categories, setCategories] = useState<OfferCategory[]>([]);
  const [categoriesMissing, setCategoriesMissing] = useState(false);
  const [newCatType, setNewCatType] = useState<EstablishmentType>('hotel');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const confirm = useConfirm();

  const fetchCities = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cities')
      .select('*')
      .order('name', { ascending: true });
    setCities((data as City[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCities(); }, [fetchCities]);

  async function handleAddCity() {
    if (!newCity.trim()) return;
    setAdding(true);
    const { error } = await supabase.from('cities').insert({
      name: newCity.trim(),
      is_active: true,
    });
    if (error) {
      Alert.alert('Ajout impossible', error.code === '23505'
        ? 'Cette ville figure déjà dans la liste.'
        : messageErreur(error, "La ville n'a pas pu être ajoutée. Réessayez dans un instant."));
    } else {
      setNewCity('');
      fetchCities();
    }
    setAdding(false);
  }

  async function toggleCity(city: City) {
    // L'échec n'était pas regardé : la bascule revenait à sa position sans
    // qu'on sache pourquoi.
    await ecrire(
      supabase.from('cities').update({ is_active: !city.is_active }).eq('id', city.id),
      city.is_active ? 'Désactivation de la ville' : 'Activation de la ville',
    );
    fetchCities();
  }

  async function deleteCity(city: City) {
    const ok = await confirm({
      title: 'Supprimer cette ville ?',
      message: `« ${city.name} » sera retirée de la liste. Ses établissements resteront enregistrés, mais ne seront plus accessibles par ville.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    await ecrire(supabase.from('cities').delete().eq('id', city.id), 'Suppression de la ville');
    fetchCities();
  }

  // ── Catégories d'offres ──
  // Référentiel partagé : le partenaire y pioche, il n'invente pas ses
  // catégories. Pouvoir en ajouter ici évite un redéploiement à chaque
  // évolution de la nomenclature hôtelière.
  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('offer_categories').select('*')
      .order('establishment_type', { ascending: true })
      .order('position', { ascending: true });
    if (error) { setCategoriesMissing(true); return; }
    setCategoriesMissing(false);
    setCategories((data as OfferCategory[]) ?? []);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  async function toggleCategory(c: OfferCategory) {
    const { error } = await supabase.from('offer_categories')
      .update({ is_active: !c.is_active }).eq('id', c.id);
    if (error) { Alert.alert('Modification impossible', messageErreur(error, "La catégorie n'a pas pu être modifiée. Réessayez dans un instant.")); return; }
    fetchCategories();
  }

  async function handleAddCategory() {
    if (!newCatLabel.trim()) return;
    setAddingCat(true);
    // La clé est dérivée du libellé : le référentiel s'appuie dessus pour
    // rester stable si le libellé affiché évolue plus tard.
    const key = newCatLabel.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const sameType = categories.filter(c => c.establishment_type === newCatType);
    const { error } = await supabase.from('offer_categories').insert({
      establishment_type: newCatType,
      key,
      label: newCatLabel.trim(),
      position: sameType.length + 1,
      is_active: true,
    });
    if (error) {
      Alert.alert('Ajout impossible', error.code === '23505'
        ? 'Une catégorie porte déjà ce nom pour ce type d\'établissement.'
        : messageErreur(error, "La catégorie n'a pas pu être ajoutée. Réessayez dans un instant."));
    } else {
      setNewCatLabel('');
      fetchCategories();
    }
    setAddingCat(false);
  }

  const activeCount = cities.filter(c => c.is_active).length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Villes & catégories</Text>
          <Text style={styles.headerSub}>{cities.length} villes · {activeCount} actives</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Ajouter une ville */}
        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>Ajouter une ville</Text>
          <View style={styles.addRow}>
            <View style={styles.addInput}>
              <MapPin size={14} color={colors.faint} />
              <TextInput
                style={styles.input}
                value={newCity}
                onChangeText={setNewCity}
                placeholder="Ex : Lubumbashi, Goma, Bukavu..."
                placeholderTextColor={colors.faint}
                onSubmitEditing={handleAddCity}
                accessibilityLabel="Nom de la ville à ajouter"
              />
            </View>
            <Pressable
              style={[styles.addBtn, (!newCity.trim() || adding) && { opacity: 0.5 }]}
              // Libellé répété : le texte laisse place à l'indicateur pendant l'ajout.
              accessibilityRole="button"
              accessibilityLabel="Ajouter la ville"
              aria-disabled={!newCity.trim() || adding} aria-busy={adding}
              onPress={handleAddCity}
              disabled={!newCity.trim() || adding}
            >
              {adding
                ? <ActivityIndicator color={colors.cream} size="small" />
                : <><Plus size={14} color={colors.cream} /><Text style={styles.addBtnText}>Ajouter</Text></>
              }
            </Pressable>
          </View>
        </View>

        {/* Liste des villes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>Villes configurées</Text>
          {loading ? (
            <ActivityIndicator color={colors.lave} style={{ marginTop: spacing.v12 }} />
          ) : cities.length === 0 ? (
            <View style={styles.empty}>
              <MapPin size={28} color={colors.borderStrong} />
              <Text style={styles.emptyText}>Aucune ville configurée.</Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.v12, gap: 0 }}>
              {cities.map((city, i) => (
                <View key={city.id} style={[styles.cityRow, i !== cities.length - 1 && styles.cityRowBorder]}>
                  <View style={[styles.cityDot, { backgroundColor: city.is_active ? colors.success : colors.borderStrong }]} />
                  <Text style={[styles.cityName, !city.is_active && styles.cityNameInactive]}>{city.name}</Text>
                  <View style={styles.cityActions}>
                    {/* Une bascule : annoncée comme telle, avec la ville qu'elle
                        concerne — « Active » seul ne dit pas de quoi. La zone
                        tactile fait 44 px, la pastille garde sa taille. */}
                    <Pressable
                      style={styles.toggleZone}
                      accessibilityRole="switch"
                      accessibilityLabel={`${city.name}, ville active`}
                      aria-checked={city.is_active}
                      onPress={() => toggleCity(city)}
                    >
                      <View style={[styles.toggleBtn, city.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive]}>
                        {city.is_active
                          ? <><Check size={11} color={colors.success} /><Text style={[styles.toggleText, { color: colors.success }]}>Active</Text></>
                          : <Text style={[styles.toggleText, { color: colors.muted }]}>Inactive</Text>
                        }
                      </View>
                    </Pressable>
                    <BoutonIcone
                      label={'Supprimer ' + city.name}
                      taille={26}
                      fond={colors.dangerSoft}
                      onPress={() => deleteCity(city)}
                      icon={<X size={13} color={colors.danger} />}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Catégories d'offres — référentiel dans lequel les partenaires piochent */}
        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>Catégories d&apos;offres</Text>
          {categoriesMissing ? (
            <Text style={styles.emptyText} accessibilityRole="alert" accessibilityLiveRegion="polite">
              Référentiel indisponible : la migration 0007 n&apos;a pas encore été appliquée.
            </Text>
          ) : (
            <>
              <View style={styles.typeRow}>
                {TYPE_LABELS.map(t => {
                  const actif = newCatType === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      style={styles.typeZone}
                      accessibilityRole="button"
                      {...etatBascule(actif)}
                      onPress={() => setNewCatType(t.key)}
                    >
                      <View style={[styles.typeBtn, actif && styles.typeBtnActive]}>
                        <Text style={[styles.typeBtnText, actif && styles.typeBtnTextActive]}>
                          {t.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.addRow}>
                <View style={styles.addInput}>
                  <TextInput
                    style={styles.input}
                    value={newCatLabel}
                    onChangeText={setNewCatLabel}
                    placeholder="Ex : Suite Junior Vue Fleuve"
                    placeholderTextColor={colors.faint}
                    onSubmitEditing={handleAddCategory}
                    accessibilityLabel="Nom de la catégorie à ajouter"
                  />
                </View>
                <Pressable
                  style={[styles.addBtn, (!newCatLabel.trim() || addingCat) && { opacity: 0.5 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter la catégorie"
                  aria-disabled={!newCatLabel.trim() || addingCat} aria-busy={addingCat}
                  onPress={handleAddCategory}
                  disabled={!newCatLabel.trim() || addingCat}
                >
                  {addingCat
                    ? <ActivityIndicator color={colors.cream} size="small" />
                    : <><Plus size={14} color={colors.cream} /><Text style={styles.addBtnText}>Ajouter</Text></>}
                </Pressable>
              </View>

              <View style={{ marginTop: spacing.v12 }}>
                {categories.filter(c => c.establishment_type === newCatType).map((c, i, arr) => (
                  <View key={c.id} style={[styles.cityRow, i !== arr.length - 1 && styles.cityRowBorder]}>
                    <View style={[styles.cityDot, { backgroundColor: c.is_active ? colors.success : colors.borderStrong }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cityName, !c.is_active && styles.cityNameInactive]}>{c.label}</Text>
                      {!!c.description_hint && <Text style={styles.hintText}>{c.description_hint}</Text>}
                    </View>
                    <Pressable
                      style={styles.toggleZone}
                      accessibilityRole="switch"
                      accessibilityLabel={`${c.label}, catégorie active`}
                      aria-checked={c.is_active}
                      onPress={() => toggleCategory(c)}
                    >
                      <View style={[styles.toggleBtn, c.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive]}>
                        <Text style={[styles.toggleText, { color: c.is_active ? colors.success : colors.muted }]}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
              <Text style={styles.hintText}>
                Désactiver une catégorie la retire du choix des partenaires. Les offres
                déjà créées avec elle continuent de fonctionner.
              </Text>
            </>
          )}
        </View>

        {/* Info catégories */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle} accessibilityRole="header" aria-level={2}>Catégories d'établissements</Text>
          <Text style={styles.infoText}>
            Les 4 catégories (Hôtels, Maisons meublées, Restaurants, Sites touristiques) sont définies dans le schéma de la base de données. Pour en ajouter de nouvelles, une migration SQL est nécessaire — contacte l'équipe technique.
          </Text>
          <View style={styles.categoriesList}>
            {[
              { label: 'Hôtels', color: colors.lave, bg: colors.laveSoft },
              { label: 'Maisons meublées', color: colors.fleuveDark, bg: colors.fleuveSoft },
              { label: 'Restaurants', color: colors.warning, bg: colors.warningSoft },
              { label: 'Sites touristiques', color: colors.success, bg: colors.successSoft },
            ].map(cat => (
              <View key={cat.label} style={[styles.catChip, { backgroundColor: cat.bg }]}>
                <Text style={[styles.catChipText, { color: cat.color }]}>{cat.label}</Text>
              </View>
            ))}
          </View>
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
  // le vide du même côté. La zone sûre, elle, est dégagée par le layout de l'admin.
  header: {
    maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.v20, paddingBottom: spacing.v12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  content: { padding: spacing.v20, gap: spacing.v12, width: '100%', maxWidth: breakpoints.panelMax, alignSelf: 'center' },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  cardTitle: { ...typography.pillLabel, color: colors.ink, marginBottom: spacing.v12, },
  addRow: { flexDirection: 'row', gap: spacing.v12, alignItems: 'center' },
  addInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.borderField,
    borderRadius: radii.sm, paddingHorizontal: spacing.v12, paddingVertical: spacing.v12,
    minHeight: cible.min,
  },
  input: { ...typography.bodySm, flex: 1, color: colors.ink, },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.lave, borderRadius: radii.sm,
    paddingHorizontal: spacing.v12, paddingVertical: spacing.v12,
    minHeight: cible.min,
  },
  addBtnText: { ...typography.caption, color: colors.cream, },
  empty: { alignItems: 'center', paddingVertical: spacing.v20, gap: spacing.sm },
  emptyText: { ...typography.bodyXs, color: colors.muted, },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, paddingVertical: spacing.v12 },
  cityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceSunken },
  cityDot: { width: 8, height: 8, borderRadius: radii.v4, flexShrink: 0 },
  cityName: { ...typography.bodySm, flex: 1, color: colors.ink, },
  cityNameInactive: { color: colors.muted, textDecorationLine: 'line-through' },
  hintText: { ...typography.captionSm, color: colors.faint, marginTop: spacing.xs, },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.v12, marginBottom: spacing.v12 },
  // Zones tactiles de 44 px autour de pastilles plus petites (35 pour un type,
  // 26 pour une bascule) : la marge négative reprend le surplus, la rangée
  // garde sa hauteur.
  typeZone: { minHeight: cible.min, justifyContent: 'center', marginVertical: -(cible.min - 35) / 2 },
  typeBtn: { paddingHorizontal: spacing.v12, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  typeBtnActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  typeBtnText: { ...typography.bodyXs, color: colors.muted, },
  typeBtnTextActive: { color: colors.cream, fontFamily: fonts.sansMedium },
  cityActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleZone: { minHeight: cible.min, minWidth: cible.min, alignItems: 'center', justifyContent: 'center', marginVertical: -(cible.min - 26) / 2 },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill, borderWidth: 1,
  },
  toggleBtnActive: { backgroundColor: colors.successSoft, borderColor: colors.successBorder },
  toggleBtnInactive: { backgroundColor: colors.surfaceSunken, borderColor: colors.borderStrong },
  toggleText: { ...typography.captionMd, },
  infoCard: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  infoTitle: { ...typography.pillLabel, color: colors.ink, marginBottom: spacing.sm, },
  infoText: { ...typography.bodyXs, color: colors.muted, marginBottom: spacing.v12, },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catChip: { paddingHorizontal: spacing.v12, paddingVertical: spacing.sm, borderRadius: radii.pill },
  catChipText: { ...typography.captionMd, },
});