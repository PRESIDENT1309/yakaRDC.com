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
import { colors, categoryColors } from '../../lib/theme';
import type { Establishment, EstablishmentType } from '../../lib/types';

type EstablishmentWithPhoto = Establishment & {
  listing_photos?: { url: string; position: number }[];
};

const CATEGORIES: {
  key: EstablishmentType;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}[] = [
  { key: 'hotel', label: 'Hôtels', icon: <Building2 size={22} color="#712B13" />, color: '#712B13', bg: '#FAECE7' },
  { key: 'furnished_house', label: 'Maisons', icon: <Home size={22} color="#085041" />, color: '#085041', bg: '#E1F5EE' },
  { key: 'restaurant', label: 'Restaurants', icon: <UtensilsCrossed size={22} color="#854F0B" />, color: '#854F0B', bg: '#FAEEDA' },
  { key: 'site', label: 'Sites', icon: <Mountain size={22} color="#1F4D3A" />, color: '#1F4D3A', bg: '#DCEEE3' },
];

// Quelques-unes des 24 communes de Kinshasa, mises en avant sur l'accueil
const FEATURED_COMMUNES = [
  { label: 'Gombe', color: '#FAECE7', accent: '#712B13' },
  { label: 'Limete', color: '#E1F5EE', accent: '#085041' },
  { label: 'Bandal', color: '#FAEEDA', accent: '#854F0B' },
  { label: "N'Sele", color: '#DCEEE3', accent: '#1F4D3A' },
  { label: 'Ngaliema', color: '#FAECE7', accent: '#712B13' },
];

const ROTATION_INTERVAL = 1500; // 1,5 seconde entre chaque photo
const FADE_DURATION = 250;

function HeroIllustration() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 390 260" preserveAspectRatio="xMidYMid slice">
      <Circle cx="300" cy="70" r="52" fill="#FAC775" opacity={0.9} />
      <Circle cx="300" cy="70" r="40" fill="#F0A040" />
      <Circle cx="300" cy="70" r="28" fill="#D85A30" />
      <Polygon points="0,260 60,130 120,260" fill="#2A1005" />
      <Polygon points="80,260 135,100 190,260" fill="#1A0A03" />
      <Polygon points="175,260 220,75 232,70 244,75 300,260" fill="#0D0602" />
      <Path
        d="M226,70 C224,55 235,48 229,32"
        stroke="#FAF8F4"
        strokeWidth="2.5"
        fill="none"
        opacity={0.25}
        strokeLinecap="round"
      />
      <Polygon points="290,260 325,155 360,260" fill="#1A0A03" />
    </Svg>
  );
}

// Photos de fond en rotation automatique avec fondu — retombe sur l'illustration si aucune photo
function RotatingHero({ photos }: { photos: string[] }) {
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
    return <HeroIllustration />;
  }

  return (
    <Animated.Image
      source={{ uri: photos[index] }}
      style={{ width: '100%', height: '100%', opacity: fadeAnim }}
      resizeMode="cover"
    />
  );
}

function ListingCard({ item }: { item: EstablishmentWithPhoto }) {
  const cat = categoryColors[item.type];
  const icons: Record<EstablishmentType, React.ReactNode> = {
    hotel: <Building2 size={28} color={cat?.accent ?? colors.lave} />,
    furnished_house: <Home size={28} color={cat?.accent ?? colors.fleuve} />,
    restaurant: <UtensilsCrossed size={28} color={cat?.accent ?? colors.or} />,
    site: <Mountain size={28} color={cat?.accent ?? colors.foret} />,
  };

  const sortedPhotos = [...(item.listing_photos ?? [])].sort((a, b) => a.position - b.position);
  const coverPhoto = sortedPhotos[0];

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/listing/${item.id}`)}
    >
      <View style={[styles.cardThumb, { backgroundColor: cat?.soft ?? '#FAECE7' }]}>
        {coverPhoto ? (
          <Image source={{ uri: coverPhoto.url }} style={styles.cardThumbImage} resizeMode="cover" />
        ) : (
          icons[item.type]
        )}
        <View style={styles.ratingBadge}>
          <Star size={8} color="#854F0B" fill="#854F0B" />
          <Text style={styles.ratingText}>4.8</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.cardLocation}>
          <MapPin size={10} color={colors.faint} />
          <Text style={styles.cardLocationText} numberOfLines={1}>
            {item.neighborhood ?? item.city}
          </Text>
        </View>
        <Text style={[styles.cardPrice, { color: cat?.accent ?? colors.lave }]}>
          Voir détails
        </Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const [listings, setListings] = useState<EstablishmentWithPhoto[]>([]);
  const [activeCategory, setActiveCategory] = useState<EstablishmentType>('hotel');
  const [loading, setLoading] = useState(true);
  const [heroPhotos, setHeroPhotos] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'home_hero_image_url').maybeSingle()
      .then(({ data }) => {
        try { setHeroPhotos(data?.value ? JSON.parse(data.value) : []); }
        catch { setHeroPhotos([]); }
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('establishments')
      .select('*, listing_photos(url, position)')
      .eq('status', 'approved')
      .eq('type', activeCategory)
      .limit(10)
      .then(({ data, error }) => {
        if (error) console.error('SUPABASE ERREUR:', JSON.stringify(error));
        setListings((data as EstablishmentWithPhoto[]) ?? []);
        setLoading(false);
      });
  }, [activeCategory]);

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>

        <View style={styles.hero}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <RotatingHero photos={heroPhotos} />
          </View>
          <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, styles.heroOverlay]} />

          <View style={styles.topBar}>
            <View style={styles.logoRow}>
              <View style={styles.logoBadge}>
                <Svg width="18" height="18" viewBox="0 0 120 120">
                  <Circle cx="60" cy="48" r="22" fill="#FAC775" />
                  <Polygon points="34,80 60,38 86,80" fill="#712B13" />
                  <Path d="M28,96 Q60,88 92,96" stroke="#FAC775" strokeWidth="5" fill="none" strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={styles.logoText}>YakaRDC</Text>
            </View>
            <Pressable style={styles.bellBtn} onPress={() => router.push('/notifications')}>
              <Bell size={18} color="#FAF8F4" />
            </Pressable>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.locationRow}>
              <MapPin size={12} color="rgba(250,248,244,0.7)" />
              <Text style={styles.locationText}>Kinshasa, RDC</Text>
            </View>
            <Text style={styles.heroTitle}>
              Où voulez-vous{'\n'}aller aujourd'hui ?
            </Text>
          </View>
        </View>

        <View style={styles.searchWrapper}>
          <Pressable
            style={styles.searchBar}
            onPress={() => router.push('/(tabs)/search')}
          >
            <Search size={16} color={colors.faint} />
            <Text style={styles.searchPlaceholder}>
              Hôtel, restaurant, site...
            </Text>
            <View style={styles.filterBtn}>
              <SlidersHorizontal size={14} color="#FAF8F4" />
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Catégories</Text>
          </View>
          <View style={styles.categoriesRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                style={styles.categoryItem}
                onPress={() => setActiveCategory(cat.key)}
              >
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: cat.bg },
                    activeCategory === cat.key && styles.categoryIconActive,
                  ]}
                >
                  {cat.icon}
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    activeCategory === cat.key && { color: cat.color, fontWeight: '500' },
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommandés</Text>
            <Pressable style={styles.seeAll} onPress={() => router.push('/(tabs)/search')}>
              <Text style={styles.seeAllText}>Voir tout</Text>
              <ChevronRight size={14} color={colors.lave} />
            </Pressable>
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
          ) : (
            <FlatList
              data={listings}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ListingCard item={item} />}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 18, paddingRight: 8 }}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              scrollEnabled
              nestedScrollEnabled
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Communes populaires</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 18 }}>
            {FEATURED_COMMUNES.map((q) => (
              <Pressable
                key={q.label}
                style={[styles.communePill, { backgroundColor: q.color }]}
                onPress={() => router.push({ pathname: '/(tabs)/search', params: { commune: q.label } })}
              >
                <Text style={[styles.communeLabel, { color: q.accent }]}>{q.label}</Text>
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
  hero: {
    height: 260,
    backgroundColor: '#1A0A03',
    overflow: 'hidden',
    position: 'relative',
  },
  heroOverlay: {
    backgroundColor: 'rgba(10,4,1,0.45)',
  },
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
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#712B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 20,
    color: '#FAF8F4',
  },
  bellBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    position: 'absolute',
    bottom: 24,
    left: 18,
    zIndex: 2,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  locationText: { fontSize: 12, color: 'rgba(250,248,244,0.7)' },
  heroTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#FAF8F4',
    lineHeight: 30,
  },
  searchWrapper: {
    paddingHorizontal: 18,
    marginTop: -20,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E3DA',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: colors.faint },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#712B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 22 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 12, color: colors.lave },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  categoryItem: { alignItems: 'center', gap: 6 },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconActive: {
    shadowColor: '#712B13',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryLabel: { fontSize: 11, color: colors.muted },
  card: {
    width: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E3DA',
    overflow: 'hidden',
  },
  cardThumb: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardThumbImage: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingText: { fontSize: 10, color: '#854F0B', fontWeight: '500' },
  cardBody: { padding: 10 },
  cardName: { fontSize: 12, fontWeight: '500', color: colors.ink, marginBottom: 3 },
  cardLocation: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 5 },
  cardLocationText: { fontSize: 10, color: colors.faint, flex: 1 },
  cardPrice: { fontSize: 12, fontWeight: '500' },
  emptyState: { paddingHorizontal: 18 },
  emptyText: { fontSize: 13, color: colors.muted, paddingHorizontal: 18 },
  emptySubtext: { fontSize: 11, color: colors.faint, marginTop: 4 },
  communePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  communeLabel: { fontSize: 13, fontWeight: '500' },
});