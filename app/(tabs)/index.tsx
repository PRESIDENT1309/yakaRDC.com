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
  Building2,
  Home,
  UtensilsCrossed,
  Mountain,
  Star,
  MapPin,
  ChevronRight,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, typography, spacing, radii } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import SectionHeading from '../../components/SectionHeading';
import RiverMotif from '../../components/RiverMotif';
import type { Establishment, EstablishmentType } from '../../lib/types';

type EstablishmentWithPhoto = Establishment & {
  listing_photos?: { url: string; position: number }[];
  avgRating?: number | null;
  reviewCount?: number;
};

const CATEGORIES: {
  key: EstablishmentType;
  label: string;
  Icon: typeof Building2;
  tone: string;
}[] = [
  { key: 'hotel', label: 'Hôtels', Icon: Building2, tone: colors.lave },
  { key: 'furnished_house', label: 'Maisons meublées', Icon: Home, tone: colors.fleuveDark },
  { key: 'restaurant', label: 'Restaurants', Icon: UtensilsCrossed, tone: colors.or },
  { key: 'site', label: 'Sites touristiques', Icon: Mountain, tone: colors.foret },
];

// Quelques-unes des 24 communes de Kinshasa, mises en avant sur l'accueil
const FEATURED_COMMUNES = ['Gombe', 'Limete', 'Bandal', "N'Sele", 'Ngaliema'];

const ROTATION_INTERVAL = 1500; // 1,5 seconde entre chaque photo
const FADE_DURATION = 250;

function CategoryIcon({ type, size = 24, color }: { type: EstablishmentType; size?: number; color: string }) {
  const props = { size, color };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

// Logo — petit blason existant, conservé tel quel (repère de marque stable).
function LogoMark() {
  return (
    <Svg width="18" height="18" viewBox="0 0 120 120">
      <Circle cx="60" cy="48" r="22" fill={colors.amber} />
      <Polygon points="34,80 60,38 86,80" fill={colors.lave} />
      <Path d="M28,96 Q60,88 92,96" stroke={colors.amber} strokeWidth="5" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// Photos de fond en rotation automatique avec fondu — retombe sur le motif
// de marque (fleuve au crépuscule) tant qu'aucune photo n'est renseignée.
function RotatingHero({ photos, width, height }: { photos: string[]; width: number; height: number }) {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (photos.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: FADE_DURATION, useNativeDriver: true }).start(() => {
        setIndex(prev => (prev + 1) % photos.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: FADE_DURATION, useNativeDriver: true }).start();
      });
    }, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [photos.length]);

  if (photos.length === 0) {
    return <RiverMotif width={width} height={height} variant="hero" />;
  }

  return (
    <Animated.Image
      source={{ uri: photos[index] }}
      style={{ width: '100%', height: '100%', opacity: fadeAnim }}
      resizeMode="cover"
    />
  );
}

function CategoryTile({
  cat,
  active,
  onPress,
  style,
  iconSize = 26,
}: {
  cat: (typeof CATEGORIES)[number];
  active: boolean;
  onPress: () => void;
  style?: any;
  iconSize?: number;
}) {
  const { Icon } = cat;
  return (
    <Pressable
      style={[styles.tile, { backgroundColor: cat.tone }, active && styles.tileActive, style]}
      onPress={onPress}
    >
      <Icon size={iconSize} color={colors.cream} strokeWidth={1.6} />
      <Text style={styles.tileLabel}>{cat.label}</Text>
    </Pressable>
  );
}

function ListingCard({ item, width }: { item: EstablishmentWithPhoto; width?: number }) {
  const cat = categoryColors[item.type];
  const tone = cat?.accent ?? colors.lave;
  const sortedPhotos = [...(item.listing_photos ?? [])].sort((a, b) => a.position - b.position);
  const coverPhoto = sortedPhotos[0];

  return (
    <Pressable
      style={[styles.card, width ? { width } : null]}
      onPress={() => router.push(`/listing/${item.id}`)}
    >
      <View style={[styles.cardImage, { backgroundColor: tone }]}>
        {coverPhoto ? (
          <Image source={{ uri: coverPhoto.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <CategoryIcon type={item.type} size={30} color="rgba(250,248,244,0.85)" />
        )}
        {item.avgRating != null ? (
          <View style={styles.ratingPill}>
            <Star size={9} color={colors.or} fill={colors.or} />
            <Text style={styles.ratingPillText}>{item.avgRating.toFixed(1)}</Text>
          </View>
        ) : (
          <View style={styles.newPill}>
            <Text style={styles.newPillText}>Nouveau</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardCategory}>{cat?.label ?? 'Établissement'}</Text>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.cardLocationRow}>
          <MapPin size={10} color={colors.faint} />
          <Text style={styles.cardLocationText} numberOfLines={1}>
            {item.neighborhood ?? item.city}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const { width, isDesktop, isWide, contentWidth } = useResponsive();

  const [listings, setListings] = useState<EstablishmentWithPhoto[]>([]);
  const [activeCategory, setActiveCategory] = useState<EstablishmentType>('hotel');
  const [loading, setLoading] = useState(true);
  const [heroPhotos, setHeroPhotos] = useState<string[]>([]);
  const [storyPhoto, setStoryPhoto] = useState<string | null>(null);

  const firstName = profile?.full_name?.split(' ')[0];

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'home_hero_image_url').maybeSingle()
      .then(({ data }) => {
        try { setHeroPhotos(data?.value ? JSON.parse(data.value) : []); }
        catch { setHeroPhotos([]); }
      });
    // Nouvelle clé (facultative) pour la bande "Le Fleuve Congo" — même
    // mécanisme que le hero, sans changement de schéma : si elle n'est pas
    // encore renseignée, le motif de marque prend le relais.
    supabase.from('app_settings').select('value').eq('key', 'home_story_image_url').maybeSingle()
      .then(({ data }) => setStoryPhoto(data?.value ?? null));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase
        .from('establishments')
        .select('*, listing_photos(url, position)')
        .eq('status', 'approved')
        .eq('type', activeCategory)
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
  }, [activeCategory]);

  const heroHeight = isDesktop ? 560 : isWide ? 460 : 400;
  const storyHeight = isDesktop ? 420 : isWide ? 380 : 320;
  const desktopColumns = 4;
  const desktopGap = 16;
  const desktopCardWidth = isDesktop
    ? (contentWidth - desktopGap * (desktopColumns - 1)) / desktopColumns
    : undefined;

  const wide = { maxWidth: contentWidth, width: '100%' as const, alignSelf: 'center' as const };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>

        {/* ── Hero immersif ── */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <View style={StyleSheet.absoluteFill}>
            <RotatingHero photos={heroPhotos} width={width} height={heroHeight} />
          </View>
          <View style={[StyleSheet.absoluteFill, styles.heroScrim]} />

          <View style={styles.topBar}>
            <View style={styles.logoRow}>
              <View style={styles.logoBadge}><LogoMark /></View>
              <Text style={styles.logoText}>YakaRDC</Text>
            </View>
            <Pressable style={styles.bellBtn} onPress={() => router.push('/notifications')}>
              <Bell size={18} color={colors.cream} />
            </Pressable>
          </View>

          <View style={[styles.heroContent, isDesktop && { maxWidth: 640 }]}>
            <View style={styles.locationRow}>
              <MapPin size={12} color="rgba(250,248,244,0.7)" />
              <Text style={styles.locationText}>
                {firstName ? `Bonjour, ${firstName} · Kinshasa, RDC` : 'Kinshasa, RDC'}
              </Text>
            </View>
            <Text style={[styles.heroTitle, { fontSize: isDesktop ? 56 : isWide ? 48 : 34, lineHeight: isDesktop ? 60 : isWide ? 52 : 40 }]}>
              Où voulez-vous{'\n'}aller aujourd'hui ?
            </Text>
          </View>
        </View>

        {/* ── Bande de recherche ── */}
        <View style={styles.searchBand}>
          <View style={[wide, !isWide && { paddingHorizontal: spacing.md }]}>
            <Pressable style={styles.searchBar} onPress={() => router.push('/(tabs)/search')}>
              <Search size={16} color={colors.faint} />
              <Text style={styles.searchPlaceholder}>Hôtel, restaurant, site...</Text>
              <View style={styles.filterBtn}>
                <SlidersHorizontal size={14} color={colors.cream} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Bande éditoriale ── */}
        <View style={styles.introBand}>
          <Text style={[styles.introText, isWide && { fontSize: 20, lineHeight: 30, maxWidth: 620 }]}>
            YakaRDC réunit les adresses qui font la fierté de Kinshasa — hôtels, tables,
            maisons meublées et lieux à découvrir, choisis avec exigence.
          </Text>
        </View>

        {/* ── Catégories ── */}
        <View style={styles.section}>
          <View style={[wide, { paddingHorizontal: isWide ? 0 : spacing.md + 2 }]}>
            <SectionHeading kicker="Explorez" title="Quatre façons de découvrir Kinshasa" />
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
                    iconSize={30}
                    style={{ flex: i === 0 ? 1.7 : 1, height: 240 }}
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
                    style={{ width: i === 0 ? 176 : 138, height: 200 }}
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
              title="Recommandés à Kinshasa"
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
                <ListingCard key={item.id} item={item} width={desktopCardWidth} />
              ))}
            </View>
          ) : (
            <FlatList
              data={listings}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ListingCard item={item} width={190} />}
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
          <View style={[StyleSheet.absoluteFill, styles.storyScrim]} />
          <View style={[styles.storyContent, isWide && { maxWidth: 560, alignItems: 'flex-start' }]}>
            <Text style={styles.storyKicker}>Le fleuve Congo</Text>
            <Text style={[styles.storyTitle, isWide && { fontSize: 34, lineHeight: 40, textAlign: 'left' }]}>
              Il façonne Kinshasa depuis toujours.
            </Text>
            <Text style={[styles.storySub, isWide && { textAlign: 'left' }]}>
              Chaque adresse YakaRDC porte une part de cette histoire — entre les rives,
              les collines et les avenues de la capitale.
            </Text>
          </View>
        </View>

        {/* ── Communes populaires ── */}
        <View style={styles.section}>
          <View style={[wide, { paddingHorizontal: isWide ? 0 : spacing.md + 2 }]}>
            <SectionHeading kicker="À proximité" title="Communes populaires" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18, gap: 10, marginTop: 12 }}
          >
            {FEATURED_COMMUNES.map((c) => (
              <Pressable
                key={c}
                style={styles.communePill}
                onPress={() => router.push({ pathname: '/(tabs)/search', params: { commune: c } })}
              >
                <MapPin size={12} color={colors.lave} />
                <Text style={styles.communeLabel}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },

  // Hero
  hero: { backgroundColor: colors.nuit, overflow: 'hidden', position: 'relative' },
  heroScrim: { backgroundColor: 'rgba(26,10,3,0.4)' },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 20,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: colors.lave, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: colors.cream },
  bellBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  heroContent: { position: 'absolute', bottom: 32, left: 18, right: 18, zIndex: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  locationText: { ...typography.overline, color: 'rgba(250,248,244,0.75)', letterSpacing: 0.6 },
  heroTitle: { fontFamily: 'PlayfairDisplay_500Medium', color: colors.cream },

  // Search band
  searchBand: { backgroundColor: colors.cream, paddingTop: 18, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
    paddingLeft: 14, paddingRight: 6, paddingVertical: 10,
  },
  searchPlaceholder: { flex: 1, ...typography.body, color: colors.faint },
  filterBtn: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: colors.lave, alignItems: 'center', justifyContent: 'center',
  },

  // Intro band
  introBand: {
    backgroundColor: colors.surfaceSunken, marginTop: 22,
    paddingVertical: 26, paddingHorizontal: 32, alignItems: 'center',
  },
  introText: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 17, lineHeight: 25,
    color: colors.laveDeep, textAlign: 'center', maxWidth: 520,
  },

  // Sections
  section: { marginTop: 26 },

  // Category tiles
  tilesRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 0 },
  tile: {
    borderRadius: radii.lg, alignItems: 'flex-start', justifyContent: 'flex-end',
    padding: 16, overflow: 'hidden',
  },
  tileActive: { borderWidth: 2, borderColor: colors.cream },
  tileLabel: {
    fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: colors.cream, marginTop: 10,
  },

  // Listing cards
  card: { backgroundColor: colors.white, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  cardImage: { height: 130, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ratingPill: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.white, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
  },
  ratingPillText: { ...typography.caption, fontSize: 10.5, color: colors.or },
  newPill: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: colors.fleuveSoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  newPillText: { fontFamily: 'Manrope_600SemiBold', fontSize: 9.5, color: colors.fleuveDark },
  cardBody: { padding: 12 },
  cardCategory: { fontFamily: 'Manrope_600SemiBold', fontSize: 10, letterSpacing: 0.5, color: colors.faint, textTransform: 'uppercase', marginBottom: 3 },
  cardName: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 15.5, color: colors.ink, marginBottom: 4 },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardLocationText: { ...typography.caption, color: colors.faint, flex: 1 },

  desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },

  emptyState: { paddingHorizontal: 18 },
  emptyText: { ...typography.body, color: colors.muted, paddingHorizontal: 18 },
  emptySubtext: { ...typography.caption, color: colors.faint, marginTop: 4, paddingHorizontal: 18 },

  // Story band
  storyBand: { marginTop: 30, position: 'relative', overflow: 'hidden' },
  storyScrim: { backgroundColor: 'rgba(26,10,3,0.32)' },
  storyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  storyKicker: { ...typography.overline, color: colors.amber, textTransform: 'uppercase', marginBottom: 10 },
  storyTitle: {
    fontFamily: 'PlayfairDisplay_700Bold_Italic', fontSize: 27, lineHeight: 33,
    color: colors.cream, textAlign: 'center', marginBottom: 10,
  },
  storySub: {
    ...typography.body, color: 'rgba(250,248,244,0.85)', textAlign: 'center', maxWidth: 420,
  },

  // Communes
  communePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
  },
  communeLabel: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.ink },
});
