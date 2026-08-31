import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Image,
  Animated,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Polygon, Path } from 'react-native-svg';
import {
  Search,
  Bell,
  SlidersHorizontal,
  MapPin,
  ChevronDown,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, typography, spacing, radii } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import { useSelectedCity } from '../../lib/city-context';
import { getCitySubdivisions } from '../../lib/geography';
import SectionHeading from '../../components/SectionHeading';
import RiverMotif from '../../components/RiverMotif';
import PhotoScrim from '../../components/PhotoScrim';
import CategoryTexture from '../../components/CategoryTexture';
import ListingCard from '../../components/ListingCard';
import Chip from '../../components/Chip';
import BottomSheet from '../../components/BottomSheet';
import type { Establishment, EstablishmentType } from '../../lib/types';

type EstablishmentWithPhoto = Establishment & {
  listing_photos?: { url: string; position: number; offer_id: string | null }[];
  avgRating?: number | null;
  reviewCount?: number;
};

const CATEGORIES: {
  key: EstablishmentType;
  label: string;
  kicker: string;
  tone: string;
  settingKey: string;
}[] = [
  { key: 'hotel', label: 'Hôtels', kicker: 'Séjourner', tone: colors.lave, settingKey: 'home_category_hotel_url' },
  { key: 'furnished_house', label: 'Maisons meublées', kicker: "S'installer", tone: colors.fleuveDark, settingKey: 'home_category_furnished_house_url' },
  { key: 'restaurant', label: 'Restaurants', kicker: 'Se régaler', tone: colors.or, settingKey: 'home_category_restaurant_url' },
  { key: 'site', label: 'Sites touristiques', kicker: 'Découvrir', tone: colors.foret, settingKey: 'home_category_site_url' },
];

const ROTATION_INTERVAL = 4000; // temps d'affichage de chaque photo
const SLIDE_DURATION = 650; // durée du défilement entre deux photos

// Blason existant (cercle/montagne/vague) + nom en Playfair — la marque telle
// qu'elle existait déjà, sans badge circulaire générique autour du blason.
function LogoLockup() {
  return (
    <View style={styles.logoRow}>
      <Svg width="22" height="22" viewBox="0 0 120 120">
        <Circle cx="60" cy="48" r="22" fill={colors.amber} />
        <Polygon points="34,80 60,38 86,80" fill={colors.lave} />
        <Path d="M28,96 Q60,88 92,96" stroke={colors.amber} strokeWidth="5" fill="none" strokeLinecap="round" />
      </Svg>
      <Text style={styles.logoText}>YakaRDC</Text>
    </View>
  );
}

// Photos de fond en rotation automatique, défilement horizontal droite→gauche
// (la photo suivante entre par la droite) — retombe sur le motif de marque
// (fleuve au crépuscule) tant qu'aucune photo n'est renseignée.
function RotatingHero({ photos, width, height }: { photos: string[]; width: number; height: number }) {
  const [index, setIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (photos.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(translateX, { toValue: -width, duration: SLIDE_DURATION, useNativeDriver: true }).start(() => {
        setIndex(prev => (prev + 1) % photos.length);
        translateX.setValue(0);
      });
    }, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [photos.length, width]);

  if (photos.length === 0) {
    return <RiverMotif width={width} height={height} variant="hero" />;
  }

  const nextIndex = (index + 1) % photos.length;

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Animated.View style={{ flexDirection: 'row', width: width * 2, height, transform: [{ translateX }] }}>
        <Image source={{ uri: photos[index] }} style={{ width, height }} resizeMode="cover" />
        <Image source={{ uri: photos[nextIndex] }} style={{ width, height }} resizeMode="cover" />
      </Animated.View>
    </View>
  );
}

function CategoryTile({
  cat,
  active,
  onPress,
  style,
  photoUrl,
}: {
  cat: (typeof CATEGORIES)[number];
  active: boolean;
  onPress: () => void;
  style?: any;
  photoUrl: string | null;
}) {
  return (
    <Pressable style={[styles.tile, active && styles.tileActive, style]} onPress={onPress}>
      {photoUrl ? (
        <>
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <PhotoScrim from="bottom" intensity={0.68} />
        </>
      ) : (
        <CategoryTexture tone={cat.tone} />
      )}
      <View style={styles.tileTextWrap}>
        <Text style={styles.tileKicker}>{cat.kicker}</Text>
        <Text style={styles.tileLabel}>{cat.label}</Text>
      </View>
    </Pressable>
  );
}

// Le composant partagé reçoit une URL déjà résolue — cet écran garde ses
// photos non triées (listing_photos brut), donc le tri/choix de la couverture
// reste ici plutôt que dans le composant.
function coverPhotoOf(item: EstablishmentWithPhoto): string | null {
  // Une photo rattachée à une offre décrit une chambre précise, pas le lieu :
  // elle ne peut pas servir de couverture à l'établissement.
  const sorted = [...(item.listing_photos ?? [])]
    .filter(p => !p.offer_id)
    .sort((a, b) => a.position - b.position);
  return sorted[0]?.url ?? null;
}

export default function HomeScreen() {
  const { width, isDesktop, isWide, contentWidth } = useResponsive();
  const { selectedCity, cities, setSelectedCity, hasMultipleCities } = useSelectedCity();

  const [listings, setListings] = useState<EstablishmentWithPhoto[]>([]);
  const [activeCategory, setActiveCategory] = useState<EstablishmentType>('hotel');
  const [loading, setLoading] = useState(true);
  const [heroPhotos, setHeroPhotos] = useState<string[]>([]);
  const [storyPhoto, setStoryPhoto] = useState<string | null>(null);
  const [categoryPhotos, setCategoryPhotos] = useState<Record<string, string | null>>({});
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const subdivisions = getCitySubdivisions(selectedCity?.name);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'home_hero_image_url').maybeSingle()
      .then(({ data }) => {
        try { setHeroPhotos(data?.value ? JSON.parse(data.value) : []); }
        catch { setHeroPhotos([]); }
      });
    supabase.from('app_settings').select('value').eq('key', 'home_story_image_url').maybeSingle()
      .then(({ data }) => setStoryPhoto(data?.value ?? null));
    // Photos de catégories — choisies à la main depuis l'admin (Apparence),
    // jamais dérivées automatiquement des établissements. Même mécanisme
    // (app_settings, clé/valeur) que le hero et la bande Fleuve Congo.
    supabase.from('app_settings').select('key, value')
      .in('key', CATEGORIES.map(c => c.settingKey))
      .then(({ data }) => {
        const map: Record<string, string | null> = {};
        (data ?? []).forEach((row: any) => { map[row.key] = row.value; });
        setCategoryPhotos(map);
      });
  }, []);

  useEffect(() => {
    if (!selectedCity) return;
    setLoading(true);
    Promise.all([
      supabase
        .from('establishments')
        .select('*, listing_photos(*)')
        .eq('status', 'approved')
        .eq('type', activeCategory)
        .eq('city', selectedCity.name)
        .limit(10),
      supabase.from('establishment_ratings').select('*'),
    ]).then(([{ data, error }, { data: ratings }]) => {
      if (error) console.error('SUPABASE ERREUR:', JSON.stringify(error));
      const ratingMap = new Map<string, { avg_rating: number | null; review_count: number }>();
      (ratings ?? []).forEach((r: any) => {
        ratingMap.set(r.establishment_id, { avg_rating: r.avg_rating, review_count: r.review_count });
      });
      const enriched: EstablishmentWithPhoto[] = ((data as EstablishmentWithPhoto[]) ?? []).map(e => {
        const rating = ratingMap.get(e.id);
        return {
          ...e,
          avgRating: rating?.avg_rating != null ? Number(rating.avg_rating) : null,
          reviewCount: rating?.review_count ?? 0,
        };
      });
      setListings(enriched);
      setLoading(false);
    });
  }, [activeCategory, selectedCity]);

  const storyHeight = isDesktop ? 420 : isWide ? 380 : 320;
  const desktopColumns = 4;
  const desktopGap = 16;
  const desktopCardWidth = isDesktop
    ? (contentWidth - desktopGap * (desktopColumns - 1)) / desktopColumns
    : undefined;

  const wide = { maxWidth: contentWidth, width: '100%' as const, alignSelf: 'center' as const };

  function AvailabilityMarker() {
    return (
      <Pressable
        style={styles.availabilityRow}
        disabled={!hasMultipleCities}
        onPress={() => setCityPickerOpen(true)}
        hitSlop={6}
      >
        <Text style={styles.locationText}>
          Disponible actuellement à {selectedCity?.name ?? '…'}
        </Text>
        {hasMultipleCities && <ChevronDown size={12} color="rgba(250,248,244,0.8)" />}
      </Pressable>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>

        {/* ── Hero ── */}
        {isDesktop ? (
          // Desktop : composition en deux panneaux — la photo est cadrée,
          // pas étirée bord à bord, et le texte vit sur un fond uni séparé.
          <View style={styles.heroDesktopOuter}>
            <View style={[wide, styles.heroDesktopRow]}>
              <View style={styles.heroPhotoPanel}>
                <RotatingHero photos={heroPhotos} width={contentWidth * 0.62} height={560} />
              </View>
              <View style={styles.heroContentPanel}>
                <View style={styles.heroPanelTop}>
                  <LogoLockup />
                  <Pressable hitSlop={5} accessibilityRole="button" accessibilityLabel="Notifications" style={styles.bellBtn} onPress={() => router.push('/notifications')}>
                    <Bell size={17} color={colors.cream} strokeWidth={1.75} />
                  </Pressable>
                </View>
                <View>
                  <AvailabilityMarker />
                  <Text style={[styles.heroTitle, { fontSize: 44, lineHeight: 48, marginTop: 12 }]}>
                    Découvrez la RDC{'\n'}autrement.
                  </Text>
                </View>
                <Pressable style={styles.searchBar} onPress={() => router.push('/(tabs)/search')}>
                  <Search size={16} color={colors.faint} />
                  <Text style={styles.searchPlaceholder}>Hôtel, restaurant, site...</Text>
                  <View style={styles.filterBtn}>
                    <SlidersHorizontal size={14} color={colors.cream} />
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          // Mobile / tablette : la photo remonte jusqu'au niveau du titre —
          // le repère de lieu et le titre vivent dans l'image, pas sur un
          // fond de couleur séparé. La recherche reprend juste après, sur le
          // canevas crème normal de la page.
          <View style={[styles.heroPhotoZone, { height: isWide ? 460 : 400 }]}>
            <RotatingHero photos={heroPhotos} width={width} height={isWide ? 460 : 400} />
            <PhotoScrim from="top" intensity={0.4} />
            <PhotoScrim from="bottom" intensity={0.65} />
            <View style={styles.topBarFloating}>
              <LogoLockup />
              <Pressable hitSlop={5} accessibilityRole="button" accessibilityLabel="Notifications" style={styles.bellBtn} onPress={() => router.push('/notifications')}>
                <Bell size={17} color={colors.cream} strokeWidth={1.75} />
              </Pressable>
            </View>
            <View style={styles.heroContentOverlay}>
              <AvailabilityMarker />
              <Text style={[styles.heroTitle, { fontSize: isWide ? 38 : 30, lineHeight: isWide ? 44 : 36, marginTop: 10 }]}>
                Découvrez la RDC{'\n'}autrement.
              </Text>
            </View>
          </View>
        )}

        {!isDesktop && (
          <View style={styles.searchZone}>
            <Pressable style={styles.searchBar} onPress={() => router.push('/(tabs)/search')}>
              <Search size={16} color={colors.faint} />
              <Text style={styles.searchPlaceholder}>Hôtel, restaurant, site...</Text>
              <View style={styles.filterBtn}>
                <SlidersHorizontal size={14} color={colors.cream} />
              </View>
            </Pressable>
          </View>
        )}

        {/* ── Catégories ── */}
        <View style={styles.section}>
          <View style={[wide, { paddingHorizontal: isWide ? 0 : spacing.md + 2 }]}>
            <SectionHeading kicker="Explorez" title="Quatre façons de découvrir la RDC" />
          </View>
          <View style={{ marginTop: 14 }}>
            {isDesktop ? (
              <View style={[wide, styles.tilesRow]}>
                {CATEGORIES.map((cat, i) => (
                  <CategoryTile
                    key={cat.key}
                    cat={cat}
                    active={activeCategory === cat.key}
                    onPress={() => setActiveCategory(cat.key)}
                    photoUrl={categoryPhotos[cat.settingKey] ?? null}
                    style={{ flex: i === 0 ? 1.7 : 1, height: 260 }}
                  />
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 18, gap: 10 }}
              >
                {CATEGORIES.map((cat, i) => (
                  <CategoryTile
                    key={cat.key}
                    cat={cat}
                    active={activeCategory === cat.key}
                    onPress={() => setActiveCategory(cat.key)}
                    photoUrl={categoryPhotos[cat.settingKey] ?? null}
                    style={{ width: i === 0 ? 188 : 148, height: 220 }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* ── Recommandés ── */}
        <View style={styles.section}>
          <View style={[wide, { paddingHorizontal: isWide ? 0 : spacing.md + 2 }]}>
            <SectionHeading
              kicker="Sélection"
              title={`Recommandés à ${selectedCity?.name ?? '…'}`}
              onSeeAll={() => router.push('/(tabs)/search')}
            />
          </View>

          {loading ? (
            <Text style={styles.emptyText}>Chargement...</Text>
          ) : listings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Aucun établissement disponible dans cette catégorie pour le moment.
              </Text>
              <Text style={styles.emptySubtext}>
                Les établissements apparaîtront ici une fois approuvés.
              </Text>
            </View>
          ) : isDesktop ? (
            <View style={[wide, styles.desktopGrid]}>
              {listings.map(item => (
                <ListingCard
                  key={item.id}
                  type={item.type}
                  name={item.name}
                  location={item.neighborhood ?? item.city}
                  coverPhotoUrl={coverPhotoOf(item)}
                  avgRating={item.avgRating}
                  reviewCount={item.reviewCount}
                  width={desktopCardWidth}
                  onPress={() => router.push(`/listing/${item.id}`)}
                />
              ))}
            </View>
          ) : (
            <FlatList
              data={listings}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ListingCard
                  type={item.type}
                  name={item.name}
                  location={item.neighborhood ?? item.city}
                  coverPhotoUrl={coverPhotoOf(item)}
                  avgRating={item.avgRating}
                  reviewCount={item.reviewCount}
                  width={190}
                  onPress={() => router.push(`/listing/${item.id}`)}
                />
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 18, paddingRight: 8 }}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              scrollEnabled
              nestedScrollEnabled
            />
          )}
        </View>

        {/* ── Bande "Le Fleuve Congo" ── */}
        <View style={[styles.storyBand, { height: storyHeight }]}>
          <View style={StyleSheet.absoluteFill}>
            {storyPhoto ? (
              <Image source={{ uri: storyPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <RiverMotif width={width} height={storyHeight} variant="band" />
            )}
          </View>
          {storyPhoto && <PhotoScrim from="bottom" intensity={0.5} />}
          <View style={[styles.storyContent, isWide && { maxWidth: 560, alignItems: 'flex-start' }]}>
            <Text style={styles.storyKicker}>Le fleuve Congo</Text>
            <View style={[styles.storyRule, isWide && { alignSelf: 'flex-start' }]} />
            <Text style={[styles.storyTitle, isWide && { fontSize: 34, lineHeight: 40, textAlign: 'left' }]}>
              Il traverse la RDC de part en part.
            </Text>
            <Text style={[styles.storySub, isWide && { textAlign: 'left' }]}>
              Chaque adresse YakaRDC porte une part de cette histoire — des rives du
              fleuve aux collines et avenues qui font le pays.
            </Text>
          </View>
        </View>

        {/* ── Communes — seulement si la ville sélectionnée en a de configurées ── */}
        {subdivisions && (
          <View style={styles.section}>
            <View style={[wide, { paddingHorizontal: isWide ? 0 : spacing.md + 2 }]}>
              <SectionHeading kicker="À proximité" title={`Communes de ${selectedCity?.name}`} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, gap: 10, marginTop: 12 }}
            >
              {subdivisions.featured.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  icon={<MapPin size={12} color={colors.lave} />}
                  onPress={() => router.push({ pathname: '/(tabs)/search', params: { commune: c } })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Bande éditoriale ──
            Placée en fin de parcours plutôt qu'en tête : elle dit ce qu'est
            YakaRDC, ce qui intéresse le visiteur une fois qu'il a vu les
            adresses — pas avant d'avoir rien vu. Elle ferme la page au lieu
            de retarder son contenu. */}
        <View style={styles.introBand}>
          <Text style={[styles.introText, isWide && { fontSize: 20, lineHeight: 30, maxWidth: 620 }]}>
            YakaRDC réunit les adresses qui font la richesse de la RDC — hôtels, tables,
            maisons meublées et lieux à découvrir, sélectionnés avec exigence.
          </Text>
        </View>

        {hasMultipleCities && (
          <BottomSheet
            visible={cityPickerOpen}
            title="Choisir une ville"
            options={cities.map(c => c.name)}
            selected={selectedCity?.name ?? ''}
            onSelect={(name) => {
              const city = cities.find(c => c.name === name);
              if (city) setSelectedCity(city);
            }}
            onClose={() => setCityPickerOpen(false)}
          />
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },

  // Logo & top bar
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: {
    ...typography.brand, color: colors.cream,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  bellBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  // Hero — mobile/tablette : la photo remonte jusqu'au titre, le texte vit dedans
  heroPhotoZone: { backgroundColor: colors.nuit, overflow: 'hidden', position: 'relative' },
  topBarFloating: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 20,
    left: 18, right: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    zIndex: 2,
  },
  heroContentOverlay: {
    position: 'absolute', left: 20, right: 20, bottom: 26, zIndex: 2,
  },
  searchZone: { backgroundColor: colors.cream, paddingHorizontal: 20, paddingTop: 18 },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  locationText: {
    ...typography.overline, color: 'rgba(250,248,244,0.8)', letterSpacing: 0.6, textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  heroTitle: {
    ...typography.heroTitle, color: colors.cream,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },

  // Hero — desktop (deux panneaux)
  heroDesktopOuter: { paddingTop: 20, paddingHorizontal: 20 },
  heroDesktopRow: { flexDirection: 'row', gap: 4, height: 560 },
  heroPhotoPanel: { flex: 1.6, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.nuit },
  heroContentPanel: {
    flex: 1, backgroundColor: colors.nuit, borderRadius: radii.lg,
    padding: 32, justifyContent: 'space-between',
  },
  heroPanelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, borderRadius: radii.md,
    paddingLeft: 14, paddingRight: 6, paddingVertical: 10,
  },
  searchPlaceholder: { flex: 1, ...typography.body, color: colors.faint },
  filterBtn: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: colors.lave, alignItems: 'center', justifyContent: 'center',
  },

  // Intro band
  introBand: {
    backgroundColor: colors.surfaceSunken,
    paddingVertical: 26, paddingHorizontal: 32, alignItems: 'center',
  },
  introText: {
    ...typography.displaySm,
    color: colors.laveDeep, textAlign: 'center', maxWidth: 520,
  },

  // Sections
  section: { marginTop: 26 },

  // Category tiles
  tilesRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 0 },
  tile: {
    borderRadius: radii.lg, justifyContent: 'flex-end', overflow: 'hidden', position: 'relative',
  },
  tileActive: { borderWidth: 2, borderColor: colors.cream },
  tileTextWrap: { padding: 16 },
  tileKicker: {
    ...typography.overlineSm,
    textTransform: 'uppercase', color: 'rgba(250,248,244,0.75)', marginBottom: 4,
  },
  tileLabel: { ...typography.tileTitle, color: colors.cream },

  desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },

  emptyState: { paddingHorizontal: 18 },
  emptyText: { ...typography.body, color: colors.muted, paddingHorizontal: 18 },
  emptySubtext: { ...typography.caption, color: colors.faint, marginTop: 4, paddingHorizontal: 18 },

  // Story band
  storyBand: { marginTop: 30, position: 'relative', overflow: 'hidden' },
  storyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  storyKicker: { ...typography.overline, color: colors.amber, textTransform: 'uppercase' },
  storyRule: { width: 40, height: 1.5, backgroundColor: colors.amber, opacity: 0.6, marginTop: 10, marginBottom: 16 },
  storyTitle: {
    ...typography.editorialTitle,
    color: colors.cream, textAlign: 'center', marginBottom: 10,
  },
  storySub: {
    ...typography.body, color: 'rgba(250,248,244,0.85)', textAlign: 'center', maxWidth: 420,
  },

});
