import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, TextInput, ActivityIndicator, } from 'react-native';
import { Alert } from '../../lib/alert';
import { MapPin, Plus, Check, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, typography, radii, spacing } from '../../lib/theme';
import type { City, OfferCategory, EstablishmentType } from '../../lib/types';

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
      Alert.alert('Erreur', error.message);
    } else {
      setNewCity('');
      fetchCities();
    }
    setAdding(false);
  }

  async function toggleCity(city: City) {
    await supabase
      .from('cities')
      .update({ is_active: !city.is_active })
      .eq('id', city.id);
    fetchCities();
  }

  async function deleteCity(city: City) {
    Alert.alert(
      'Supprimer cette ville',
      `Supprimer "${city.name}" ? Les établissements associés resteront mais ne seront plus accessibles par ville.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          await supabase.from('cities').delete().eq('id', city.id);
          fetchCities();
        }},
      ]
    );
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
    if (error) { Alert.alert('Erreur', error.message); return; }
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
      Alert.alert('Erreur', error.code === '23505'
        ? 'Une catégorie porte déjà ce nom pour ce type d\'établissement.'
        : error.message);
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
          <Text style={styles.headerTitle}>Villes & catégories</Text>
          <Text style={styles.headerSub}>{cities.length} villes · {activeCount} actives</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Ajouter une ville */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ajouter une ville</Text>
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
              />
            </View>
            <Pressable
              style={[styles.addBtn, (!newCity.trim() || adding) && { opacity: 0.5 }]}
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
          <Text style={styles.cardTitle}>Villes configurées</Text>
          {loading ? (
            <ActivityIndicator color={colors.lave} style={{ marginTop: spacing.v14 }} />
          ) : cities.length === 0 ? (
            <View style={styles.empty}>
              <MapPin size={28} color={colors.borderStrong} />
              <Text style={styles.emptyText}>Aucune ville configurée.</Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.v10, gap: 0 }}>
              {cities.map((city, i) => (
                <View key={city.id} style={[styles.cityRow, i !== cities.length - 1 && styles.cityRowBorder]}>
                  <View style={[styles.cityDot, { backgroundColor: city.is_active ? colors.success : colors.borderStrong }]} />
                  <Text style={[styles.cityName, !city.is_active && styles.cityNameInactive]}>{city.name}</Text>
                  <View style={styles.cityActions}>
                    <Pressable
                      style={[styles.toggleBtn, city.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                      onPress={() => toggleCity(city)}
                    >
                      {city.is_active
                        ? <><Check size={11} color={colors.success} /><Text style={[styles.toggleText, { color: colors.success }]}>Active</Text></>
                        : <Text style={[styles.toggleText, { color: colors.muted }]}>Inactive</Text>
                      }
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={'Supprimer ' + city.name} style={styles.deleteBtn} onPress={() => deleteCity(city)} hitSlop={9}>
                      <X size={13} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Catégories d'offres — référentiel dans lequel les partenaires piochent */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Catégories d&apos;offres</Text>
          {categoriesMissing ? (
            <Text style={styles.emptyText}>
              Référentiel indisponible : la migration 0007 n&apos;a pas encore été appliquée.
            </Text>
          ) : (
            <>
              <View style={styles.typeRow}>
                {TYPE_LABELS.map(t => (
                  <Pressable
                    key={t.key}
                    style={[styles.typeBtn, newCatType === t.key && styles.typeBtnActive]}
                    onPress={() => setNewCatType(t.key)}
                  >
                    <Text style={[styles.typeBtnText, newCatType === t.key && styles.typeBtnTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
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
                  />
                </View>
                <Pressable
                  style={[styles.addBtn, (!newCatLabel.trim() || addingCat) && { opacity: 0.5 }]}
                  onPress={handleAddCategory}
                  disabled={!newCatLabel.trim() || addingCat}
                >
                  {addingCat
                    ? <ActivityIndicator color={colors.cream} size="small" />
                    : <><Plus size={14} color={colors.cream} /><Text style={styles.addBtnText}>Ajouter</Text></>}
                </Pressable>
              </View>

              <View style={{ marginTop: spacing.v10 }}>
                {categories.filter(c => c.establishment_type === newCatType).map((c, i, arr) => (
                  <View key={c.id} style={[styles.cityRow, i !== arr.length - 1 && styles.cityRowBorder]}>
                    <View style={[styles.cityDot, { backgroundColor: c.is_active ? colors.success : colors.borderStrong }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cityName, !c.is_active && styles.cityNameInactive]}>{c.label}</Text>
                      {!!c.description_hint && <Text style={styles.hintText}>{c.description_hint}</Text>}
                    </View>
                    <Pressable
                      style={[styles.toggleBtn, c.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                      onPress={() => toggleCategory(c)}
                    >
                      <Text style={[styles.toggleText, { color: c.is_active ? colors.success : colors.muted }]}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Text>
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
          <Text style={styles.infoTitle}>Catégories d'établissements</Text>
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
  header: {
    maxWidth: 600, width: '100%',
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    paddingHorizontal: spacing.v20, paddingBottom: spacing.v14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  content: { padding: spacing.v20, gap: spacing.v12, maxWidth: 600 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  cardTitle: { ...typography.pillLabel, color: colors.ink, marginBottom: spacing.v12, },
  addRow: { flexDirection: 'row', gap: spacing.v10, alignItems: 'center' },
  addInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.sm, paddingHorizontal: spacing.v12, paddingVertical: spacing.v10,
  },
  input: { ...typography.bodySm, flex: 1, color: colors.ink, },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v6,
    backgroundColor: colors.lave, borderRadius: radii.sm,
    paddingHorizontal: spacing.v14, paddingVertical: spacing.v10,
  },
  addBtnText: { ...typography.caption, color: colors.cream, },
  empty: { alignItems: 'center', paddingVertical: spacing.v20, gap: spacing.sm },
  emptyText: { ...typography.bodyXs, color: colors.muted, },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v10, paddingVertical: 11 },
  cityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceSunken },
  cityDot: { width: 8, height: 8, borderRadius: radii.v4, flexShrink: 0 },
  cityName: { ...typography.bodySm, flex: 1, color: colors.ink, },
  cityNameInactive: { color: colors.muted, textDecorationLine: 'line-through' },
  hintText: { ...typography.captionSm, color: colors.faint, marginTop: spacing.xs, },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.v6, marginTop: spacing.v10, marginBottom: spacing.v10 },
  typeBtn: { paddingHorizontal: spacing.v12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  typeBtnActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  typeBtnText: { ...typography.bodyXs, color: colors.muted, },
  typeBtnTextActive: { color: colors.cream, fontWeight: '500' },
  cityActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.v6 },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1,
  },
  toggleBtnActive: { backgroundColor: colors.successSoft, borderColor: colors.successBorder },
  toggleBtnInactive: { backgroundColor: colors.surfaceSunken, borderColor: colors.borderStrong },
  toggleText: { ...typography.captionMd, },
  deleteBtn: {
    width: 26, height: 26, borderRadius: radii.v6,
    backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center',
  },
  infoCard: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  infoTitle: { ...typography.pillLabel, color: colors.ink, marginBottom: spacing.sm, },
  infoText: { ...typography.bodyXs, color: colors.muted, marginBottom: spacing.v12, },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  catChip: { paddingHorizontal: spacing.v12, paddingVertical: spacing.v6, borderRadius: radii.pill },
  catChipText: { ...typography.captionMd, },
});