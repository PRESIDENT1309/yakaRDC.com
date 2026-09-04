import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Search, X, MapPin, DollarSign, Star } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { cheapestActiveOffer } from '../../lib/offers';
import { colors, typography, spacing, radii } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import { useSelectedCity } from '../../lib/city-context';
import { getCitySubdivisions } from '../../lib/geography';
import SectionHeading from '../../components/SectionHeading';
import ListingCard from '../../components/ListingCard';
import Chip from '../../components/Chip';
import BottomSheet from '../../components/BottomSheet';
import EmptyState from '../../components/EmptyState';
import { SkeletonCarte } from '../../components/Skeleton';
import EntreeListe from '../../components/EntreeListe';
import type { Establishment, EstablishmentType } from '../../lib/types';

type CategoryFilter = EstablishmentType | 'all';

// Établissement enrichi avec ses vraies données liées (note, prix, photo)
type EnrichedEstablishment = Establishment & {
  avgRating: number | null;
  reviewCount: number;
  price: number | null;
  currency: string;
  priceUnit: string | null;
  coverPhoto: string | null;
};

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'hotel', label: 'Hôtels' },
  { key: 'furnished_house', label: 'Maisons' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'site', label: 'Sites' },
];

// Chaque fourchette porte ses bornes réelles, pour que le filtre agisse vraiment
const PRIX: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Tous', min: null, max: null },
  { label: '0–20 $', min: 0, max: 20 },
  { label: '20–50 $', min: 20, max: 50 },
  { label: '50–100 $', min: 50, max: 100 },
  { label: '100 $ +', min: 100, max: null },
];

const NOTES: { label: string; min: number | null }[] = [
  { label: 'Toutes', min: null },
  { label: '4.5 +', min: 4.5 },
  { label: '4.0 +', min: 4.0 },
  { label: '3.5 +', min: 3.5 },
];

function unitLabel(unit: string | null): string {
  if (unit === 'night') return '/ nuit';
  if (unit === 'person') return '/ pers.';
  if (unit === 'visit') return '/ visite';
  return '';
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ commune?: string }>();
  const { width, isDesktop, isTablet, isWide, contentWidth } = useResponsive();
  const { selectedCity } = useSelectedCity();
  const subdivisions = getCitySubdivisions(selectedCity?.name);
  const communeOptions = subdivisions ? ['Toutes', ...subdivisions.all] : null;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [commune, setCommune] = useState('Toutes');
  const [prix, setPrix] = useState('Tous');
  const [note, setNote] = useState('Toutes');
  const [results, setResults] = useState<EnrichedEstablishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<'commune' | 'prix' | 'note' | null>(null);

  // Si on arrive depuis une commune tapée sur l'accueil, on pré-remplit le filtre
  useEffect(() => {
    if (params.commune) setCommune(params.commune);
  }, [params.commune]);

  // La ville sélectionnée n'a pas de subdivisions configurées : le filtre
  // "Commune" n'a plus de sens, on l'efface pour éviter un filtre fantôme.
  useEffect(() => {
    if (!subdivisions) setCommune('Toutes');
  }, [subdivisions]);

  const fetchResults = useCallback(async () => {
    if (!selectedCity) return;
    setLoading(true);

    // On récupère les offres et photos liées en une seule requête,
    // plutôt qu'un appel supplémentaire par établissement. Le prix affiché
    // est celui de l'offre active la moins chère — un « à partir de ».
    let q = supabase
      .from('establishments')
      .select('*, establishment_offers(price, currency, unit, is_active), listing_photos(*)')
      .eq('status', 'approved')
      .eq('city', selectedCity.name);

    if (category !== 'all') q = q.eq('type', category);
    if (commune !== 'Toutes') q = q.eq('commune', commune);
    if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);

    const [{ data }, { data: ratings }] = await Promise.all([
      q.limit(50),
      supabase.from('establishment_ratings').select('*'),
    ]);

    // Index des notes par établissement, pour une association rapide
    const ratingMap = new Map<string, { avg_rating: number | null; review_count: number }>();
    (ratings ?? []).forEach((r: any) => {
      ratingMap.set(r.establishment_id, { avg_rating: r.avg_rating, review_count: r.review_count });
    });

    let enriched: EnrichedEstablishment[] = ((data as any[]) ?? []).map(e => {
      const rating = ratingMap.get(e.id);
      const cheapest = cheapestActiveOffer(e.establishment_offers as any[]);
      const generalPhotos = (e.listing_photos ?? [])
        .filter((p: any) => !p.offer_id && (!p.category || p.category === 'general'))
        .sort((a: any, b: any) => a.position - b.position);

      return {
        ...e,
        avgRating: rating?.avg_rating != null ? Number(rating.avg_rating) : null,
        reviewCount: rating?.review_count ?? 0,
        price: cheapest?.price != null ? Number(cheapest.price) : null,
        currency: cheapest?.currency ?? 'USD',
        priceUnit: cheapest?.unit ?? null,
        coverPhoto: generalPhotos[0]?.url ?? null,
      };
    });

    // Filtre prix — appliqué sur le vrai tarif enregistré
    const priceRange = PRIX.find(p => p.label === prix);
    if (priceRange && (priceRange.min != null || priceRange.max != null)) {
      enriched = enriched.filter(e => {
        // Sans tarif enregistré, on ne peut ni inclure ni exclure honnêtement.
        // On garde l'établissement (il s'affiche « Tarif sur demande ») plutôt
        // que de le faire disparaître : plus de la moitié du catalogue n'a
        // aucun tarif, les masquer en silence donnerait à l'utilisateur
        // l'impression d'un catalogue vide plutôt que d'un tarif manquant.
        if (e.price == null) return true;
        if (priceRange.min != null && e.price < priceRange.min) return false;
        if (priceRange.max != null && e.price > priceRange.max) return false;
        return true;
      });
    }

    // Filtre note — appliqué sur la vraie moyenne
    const noteRange = NOTES.find(n => n.label === note);
    if (noteRange?.min != null) {
      enriched = enriched.filter(e => e.avgRating != null && e.avgRating >= noteRange.min!);
    }

    setResults(enriched);
    setLoading(false);
  }, [query, category, commune, prix, note, selectedCity]);

  useEffect(() => {
    const timer = setTimeout(fetchResults, 350);
    return () => clearTimeout(timer);
  }, [fetchResults]);

  // ── Mise en page responsive : grille 2 (mobile/tablette) → grille 4 (desktop) ──
  const columns = isDesktop ? 4 : 2;
  const gridWidth = isWide ? contentWidth : width;
  const gutter = spacing.md + 2; // 18 — gouttière de facto déjà en usage sur cet écran
  const gap = 12;
  const cardWidth = (gridWidth - gutter * 2 - gap * (columns - 1)) / columns;
  const wide = { maxWidth: contentWidth, width: '100%' as const, alignSelf: 'center' as const };

  return (
    <View style={styles.screen}>

      <View style={styles.header}>
        <View style={isWide ? wide : undefined}>
          <SectionHeading
            kicker="Recherche"
            title={selectedCity?.name ? `Trouver une adresse à ${selectedCity.name}` : 'Rechercher'}
          />

          <View style={[styles.searchBar, { marginTop: spacing.v12 }]}>
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
              <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => setQuery('')} hitSlop={8}>
                <X size={16} color={colors.faint} strokeWidth={1.75} />
              </Pressable>
            )}
          </View>

          {(() => {
            const chips = (
              <>
                {CATEGORIES.map((cat) => (
                  <Chip key={cat.key} label={cat.label} active={category === cat.key} onPress={() => setCategory(cat.key)} />
                ))}
                <View style={styles.chipGroupGap} />
                {communeOptions && (
                  <Chip
                    variant="filter"
                    label={commune === 'Toutes' ? 'Commune' : commune}
                    active={commune !== 'Toutes'}
                    icon={<MapPin size={12} color={commune !== 'Toutes' ? colors.lave : colors.muted} strokeWidth={1.75} />}
                    onPress={() => setActiveModal('commune')}
                  />
                )}
                <Chip
                  variant="filter"
                  label={prix === 'Tous' ? 'Prix' : prix}
                  active={prix !== 'Tous'}
                  icon={<DollarSign size={12} color={prix !== 'Tous' ? colors.lave : colors.muted} strokeWidth={1.75} />}
                  onPress={() => setActiveModal('prix')}
                />
                <Chip
                  variant="filter"
                  label={note === 'Toutes' ? 'Note' : note}
                  active={note !== 'Toutes'}
                  icon={<Star size={12} color={note !== 'Toutes' ? colors.lave : colors.muted} strokeWidth={1.75} />}
                  onPress={() => setActiveModal('note')}
                />
              </>
            );
            return isWide ? (
              <View style={styles.chipWrap}>{chips}</View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {chips}
              </ScrollView>
            );
          })()}

          <Text style={styles.resultCount}>
            {loading ? 'Recherche...' : `${results.length} résultat${results.length !== 1 ? 's' : ''} trouvé${results.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      <FlatList
        key={columns}
        data={results}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        renderItem={({ item, index }) => (
          /* Les résultats d'une recherche arrivent en réponse à un geste :
             la cascade dit qu'ils viennent d'être trouvés. Ailleurs, sur un
             contenu déjà présent, la même animation ne dirait rien. */
          <EntreeListe index={index}>
          <ListingCard
            type={item.type}
            name={item.name}
            location={item.commune ?? item.neighborhood ?? item.city}
            coverPhotoUrl={item.coverPhoto}
            avgRating={item.avgRating}
            reviewCount={item.reviewCount}
            priceLabel={item.price != null
              ? `${item.price} ${item.currency} ${unitLabel(item.priceUnit)}`.trim()
              : 'Tarif sur demande'}
            width={cardWidth}
            onPress={() => router.push(`/listing/${item.id}`)}
          />
          </EntreeListe>
        )}
        contentContainerStyle={[styles.listContent, isWide && wide]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            /* Pendant la recherche, cette liste ne rendait rien : ni contenu,
               ni signe d'attente. Les silhouettes occupent d'avance la place
               des résultats, si bien que leur arrivée ne déplace plus la mise
               en page. Le compteur au-dessus dit déjà « Recherche… », ce qui
               couvre la lecture vocale — les blocs, eux, sont masqués aux
               lecteurs d'écran. */
            <View style={styles.grilleAttente}>
              {Array.from({ length: columns * 3 }).map((_, i) => (
                <View key={i} style={{ width: cardWidth }}>
                  <SkeletonCarte />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={<Search size={36} color={colors.borderStrong} strokeWidth={1.75} />}
              title="Aucun résultat"
              description="Essayez un autre mot-clé ou modifiez les filtres."
            />
          )
        }
      />

      {communeOptions && (
        <BottomSheet
          visible={activeModal === 'commune'}
          title="Choisir une commune"
          options={communeOptions}
          selected={commune}
          onSelect={setCommune}
          onClose={() => setActiveModal(null)}
        />
      )}
      <BottomSheet
        visible={activeModal === 'prix'}
        title="Fourchette de prix"
        options={PRIX.map(p => p.label)}
        selected={prix}
        onSelect={setPrix}
        onClose={() => setActiveModal(null)}
      />
      <BottomSheet
        visible={activeModal === 'note'}
        title="Note minimale"
        options={NOTES.map(n => n.label)}
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
    backgroundColor: colors.cream,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingHorizontal: 18,
    paddingBottom: spacing.v12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: spacing.v12,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink },
  chipRow: { gap: spacing.sm, marginBottom: spacing.v6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.v6 },
  chipGroupGap: { width: 4 },
  resultCount: { ...typography.caption, color: colors.faint },
  listContent: { padding: 18, paddingBottom: 90 },
  gridRow: { gap: spacing.v12, marginBottom: spacing.v12 },
  // Même gouttière que la grille de résultats, pour que les silhouettes
  // occupent exactement la place qu'occuperont les cartes.
  grilleAttente: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.v12 },
});
