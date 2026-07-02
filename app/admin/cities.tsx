import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { MapPin, Plus, Check, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { City } from '../../lib/types';

export default function CitiesScreen() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCity, setNewCity] = useState('');
  const [adding, setAdding] = useState(false);

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

        {/* Info catégories */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 Catégories d'établissements</Text>
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