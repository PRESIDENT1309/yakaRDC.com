import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Search,
  X,
  MapPin,
  DollarSign,
  Star,
  ChevronDown,
  Building2,
  Home,
  UtensilsCrossed,
  Mountain,
  Check,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, categoryColors } from '../../lib/theme';
import type { Establishment, EstablishmentType } from '../../lib/types';

type CategoryFilter = EstablishmentType | 'all';

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'hotel', label: 'Hôtels' },
  { key: 'furnished_house', label: 'Maisons' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'site', label: 'Sites' },
];

// Communes de Kinshasa (liste non exhaustive — la ville en compte 24 au total)
const COMMUNES = [
  'Toutes', 'Gombe', 'Limete', 'Bandal', 'Ngaliema', "N'Sele",
  'Kintambo', 'Lemba', 'Kalamu', 'Ngiri-Ngiri', 'Barumbu',
];
const PRIX = ['Tous', '0–20 $', '20–50 $', '50–100 $', '100 $ +'];
const NOTES = ['Toutes', '4.5 +', '4.0 +', '3.5 +'];

function CategoryIcon({ type, size = 24 }: { type: EstablishmentType; size?: number }) {
  const cat = categoryColors[type];
  const props = { size, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

function ResultCard({ item }: { item: Establishment }) {
  const cat = categoryColors[item.type];
  const accent = cat?.accent ?? colors.lave;
  const soft = cat?.soft ?? '#FAECE7';

  const priceLabel: Record<EstablishmentType, string> = {
    hotel: '45 $ / nuit',
    furnished_house: '35 $ / nuit',
    restaurant: 'Sur place',
    site: '10 $ / pers.',
  };

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/listing/${item.id}`)}
    >
      <View style={[styles.cardThumb, { backgroundColor: soft }]}>
        <CategoryIcon type={item.type} size={28} />
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingBadge}>
            <Star size={9} color="#854F0B" fill="#854F0B" />
            <Text style={styles.ratingText}>4.8</Text>
          </View>
        </View>
        <View style={styles.cardLocationRow}>
          <MapPin size={10} color={colors.faint} />
          <Text style={styles.cardLocationText} numberOfLines={1}>
            {item.commune ?? item.neighborhood ?? item.city}
          </Text>
        </View>
        <View style={styles.cardBottomRow}>
          <Text style={[styles.cardPrice, { color: accent }]}>
            {priceLabel[item.type]}
          </Text>
          <View style={styles.availableBadge}>
            <Text style={styles.availableText}>Disponible</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function FilterModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={styles.modalOption}
                onPress={() => { onSelect(opt); onClose(); }}
              >
                <Text style={[
                  styles.modalOptionText,
                  selected === opt && { color: colors.lave, fontWeight: '500' },
                ]}>{opt}</Text>
                {selected === opt && <Check size={16} color={colors.lave} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ commune?: string }>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [commune, setCommune] = useState('Toutes');
  const [prix, setPrix] = useState('Tous');
  const [note, setNote] = useState('Toutes');
  const [results, setResults] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<'commune' | 'prix' | 'note' | null>(null);

  // Si on arrive depuis une commune tapée sur l'accueil, on pré-remplit le filtre
  useEffect(() => {
    if (params.commune && COMMUNES.includes(params.commune)) {
      setCommune(params.commune);
    } else if (params.commune) {
      setCommune(params.commune);
    }
  }, [params.commune]);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('establishments')
      .select('*')
      .eq('status', 'approved');

    if (category !== 'all') q = q.eq('type', category);
    if (commune !== 'Toutes') q = q.eq('commune', commune);
    if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);

    const { data } = await q.limit(30);
    setResults((data as Establishment[]) ?? []);
    setLoading(false);
  }, [query, category, commune]);

  useEffect(() => {
    const timer = setTimeout(fetchResults, 350);
    return () => clearTimeout(timer);
  }, [fetchResults]);

  return (
    <View style={styles.screen}>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rechercher</Text>

        <View style={styles.searchBar}>
          <Search size={16} color={colors.faint} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Hôtel, restaurant, site..."
            placeholderTextColor={colors.faint}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={colors.faint} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
          contentContainerStyle={{ gap: 6 }}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              style={[
                styles.catPill,
                category === cat.key && styles.catPillActive,
              ]}
              onPress={() => setCategory(cat.key)}
            >
              <Text style={[
                styles.catPillText,
                category === cat.key && styles.catPillTextActive,
              ]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ gap: 6 }}
        >
          <Pressable
            style={[styles.filterPill, commune !== 'Toutes' && styles.filterPillActive]}
            onPress={() => setActiveModal('commune')}
          >
            <MapPin size={12} color={commune !== 'Toutes' ? colors.lave : colors.muted} />
            <Text style={[styles.filterPillText, commune !== 'Toutes' && { color: colors.lave }]}>
              {commune === 'Toutes' ? 'Commune' : commune}
            </Text>
            <ChevronDown size={12} color={commune !== 'Toutes' ? colors.lave : colors.faint} />
          </Pressable>

          <Pressable
            style={[styles.filterPill, prix !== 'Tous' && styles.filterPillActive]}
            onPress={() => setActiveModal('prix')}
          >
            <DollarSign size={12} color={prix !== 'Tous' ? colors.lave : colors.muted} />
            <Text style={[styles.filterPillText, prix !== 'Tous' && { color: colors.lave }]}>
              {prix === 'Tous' ? 'Prix' : prix}
            </Text>
            <ChevronDown size={12} color={prix !== 'Tous' ? colors.lave : colors.faint} />
          </Pressable>

          <Pressable
            style={[styles.filterPill, note !== 'Toutes' && styles.filterPillActive]}
            onPress={() => setActiveModal('note')}
          >
            <Star size={12} color={note !== 'Toutes' ? colors.lave : colors.muted} />
            <Text style={[styles.filterPillText, note !== 'Toutes' && { color: colors.lave }]}>
              {note === 'Toutes' ? 'Note' : note}
            </Text>
            <ChevronDown size={12} color={note !== 'Toutes' ? colors.lave : colors.faint} />
          </Pressable>
        </ScrollView>

        <Text style={styles.resultCount}>
          {loading ? 'Recherche...' : `${results.length} résultat${results.length !== 1 ? 's' : ''} trouvé${results.length !== 1 ? 's' : ''}`}
        </Text>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ResultCard item={item} />}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Search size={36} color={colors.borderStrong} />
              <Text style={styles.emptyTitle}>Aucun résultat</Text>
              <Text style={styles.emptyText}>
                Essayez un autre mot-clé ou modifiez les filtres.
              </Text>
            </View>
          ) : null
        }
      />

      <FilterModal
        visible={activeModal === 'commune'}
        title="Choisir une commune"
        options={COMMUNES}
        selected={commune}
        onSelect={setCommune}
        onClose={() => setActiveModal(null)}
      />
      <FilterModal
        visible={activeModal === 'prix'}
        title="Fourchette de prix"
        options={PRIX}
        selected={prix}
        onSelect={setPrix}
        onClose={() => setActiveModal(null)}
      />
      <FilterModal
        visible={activeModal === 'note'}
        title="Note minimale"
        options={NOTES}
        selected={note}
        onSelect={setNote}
        onClose={() => setActiveModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: '#FAF8F4',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingHorizontal: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  categoryRow: { marginBottom: 10 },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  catPillActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  catPillText: { fontSize: 12, color: colors.muted },
  catPillTextActive: { color: '#FAF8F4', fontWeight: '500' },
  filterRow: { marginBottom: 10 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  filterPillActive: {
    borderColor: colors.lave,
    backgroundColor: colors.laveSoft,
  },
  filterPillText: { fontSize: 11, color: colors.muted },
  resultCount: { fontSize: 11, color: colors.faint, marginTop: 2 },
  listContent: { padding: 14, paddingBottom: 90 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardThumb: {
    width: 85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, padding: 12 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardName: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.ink, marginRight: 8 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FAEEDA',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingText: { fontSize: 10, color: '#854F0B', fontWeight: '500' },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  cardLocationText: { fontSize: 11, color: colors.faint, flex: 1 },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: { fontSize: 12, fontWeight: '500' },
  availableBadge: {
    backgroundColor: '#E1F5EE',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  availableText: { fontSize: 10, color: '#0F6E56', fontWeight: '500' },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: colors.ink },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FAF8F4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.borderStrong,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 14,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionText: { fontSize: 15, color: colors.ink },
});