import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, TextInput, ActivityIndicator, } from 'react-native';
import { Alert } from '../../lib/alert';
import { MapPin, Plus, Check, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
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
                ? <ActivityIndicator color="#FAF8F4" size="small" />
                : <><Plus size={14} color="#FAF8F4" /><Text style={styles.addBtnText}>Ajouter</Text></>
              }
            </Pressable>
          </View>
        </View>

        {/* Liste des villes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Villes configurées</Text>
          {loading ? (
            <ActivityIndicator color={colors.lave} style={{ marginTop: 14 }} />
          ) : cities.length === 0 ? (
            <View style={styles.empty}>
              <MapPin size={28} color={colors.borderStrong} />
              <Text style={styles.emptyText}>Aucune ville configurée.</Text>
            </View>
          ) : (
            <View style={{ marginTop: 10, gap: 0 }}>
              {cities.map((city, i) => (
                <View key={city.id} style={[styles.cityRow, i !== cities.length - 1 && styles.cityRowBorder]}>
                  <View style={[styles.cityDot, { backgroundColor: city.is_active ? '#1F4D3A' : colors.borderStrong }]} />
                  <Text style={[styles.cityName, !city.is_active && styles.cityNameInactive]}>{city.name}</Text>
                  <View style={styles.cityActions}>
                    <Pressable
                      style={[styles.toggleBtn, city.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                      onPress={() => toggleCity(city)}
                    >
                      {city.is_active
                        ? <><Check size={11} color="#1F4D3A" /><Text style={[styles.toggleText, { color: '#1F4D3A' }]}>Active</Text></>
                        : <Text style={[styles.toggleText, { color: colors.muted }]}>Inactive</Text>
                      }
                    </Pressable>
                    <Pressable style={styles.deleteBtn} onPress={() => deleteCity(city)} hitSlop={8}>
                      <X size={13} color="#C0392B" />
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
                    ? <ActivityIndicator color="#FAF8F4" size="small" />
                    : <><Plus size={14} color="#FAF8F4" /><Text style={styles.addBtnText}>Ajouter</Text></>}
                </Pressable>
              </View>

              <View style={{ marginTop: 10 }}>
                {categories.filter(c => c.establishment_type === newCatType).map((c, i, arr) => (
                  <View key={c.id} style={[styles.cityRow, i !== arr.length - 1 && styles.cityRowBorder]}>
                    <View style={[styles.cityDot, { backgroundColor: c.is_active ? '#1F4D3A' : colors.borderStrong }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cityName, !c.is_active && styles.cityNameInactive]}>{c.label}</Text>
                      {!!c.description_hint && <Text style={styles.hintText}>{c.description_hint}</Text>}
                    </View>
                    <Pressable
                      style={[styles.toggleBtn, c.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                      onPress={() => toggleCategory(c)}
                    >
                      <Text style={[styles.toggleText, { color: c.is_active ? '#1F4D3A' : colors.muted }]}>
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
              { label: 'Hôtels', color: '#712B13', bg: '#FAECE7' },
              { label: 'Maisons meublées', color: '#085041', bg: '#E1F5EE' },
              { label: 'Restaurants', color: '#854F0B', bg: '#FAEEDA' },
              { label: 'Sites touristiques', color: '#1F4D3A', bg: '#DCEEE3' },
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
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '500', color: colors.ink },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  content: { padding: 20, gap: 12, maxWidth: 600 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 13, fontWeight: '500', color: colors.ink, marginBottom: 12 },
  addRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 13, color: colors.ink },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.lave, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  addBtnText: { fontSize: 12, color: '#FAF8F4', fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 12, color: colors.muted },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  cityRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F4F0' },
  cityDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  cityName: { flex: 1, fontSize: 13, color: colors.ink },
  cityNameInactive: { color: colors.muted, textDecorationLine: 'line-through' },
  hintText: { fontSize: 11, color: colors.faint, lineHeight: 16, marginTop: 4 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 10 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderStrong },
  typeBtnActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  typeBtnText: { fontSize: 12, color: colors.muted },
  typeBtnTextActive: { color: '#FAF8F4', fontWeight: '500' },
  cityActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  toggleBtnActive: { backgroundColor: '#DCEEE3', borderColor: '#A8D5B5' },
  toggleBtnInactive: { backgroundColor: '#F5F4F0', borderColor: colors.borderStrong },
  toggleText: { fontSize: 10.5, fontWeight: '500' },
  deleteBtn: {
    width: 26, height: 26, borderRadius: 6,
    backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
  },
  infoCard: { backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  infoTitle: { fontSize: 13, fontWeight: '500', color: colors.ink, marginBottom: 8 },
  infoText: { fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 12 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  catChipText: { fontSize: 11, fontWeight: '500' },
});