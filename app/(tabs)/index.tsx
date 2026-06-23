import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import { Search as SearchIcon, MapPin } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, radii } from '../../lib/theme';
import CategoryPill from '../../components/CategoryPill';
import ListingCard from '../../components/ListingCard';
import type { Establishment, EstablishmentType } from '../../lib/types';

const CATEGORIES: { key: EstablishmentType; label: string }[] = [
  { key: 'hotel', label: 'Hôtels' },
  { key: 'furnished_house', label: 'Maisons meublées' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'site', label: 'Sites' },
];

export default function HomeScreen() {
  const [activeCategory, setActiveCategory] = useState<EstablishmentType>('hotel');
  const [listings, setListings] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('establishments')
      .select('*')
      .eq('status', 'approved')
      .eq('type', activeCategory)
      .limit(10)
      .then(({ data }) => {
        setListings((data as Establishment[]) ?? []);
        setLoading(false);
      });
  }, [activeCategory]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.hero}>
        <Svg width="100%" height={210} viewBox="0 0 264 210">
          <Rect x="0" y="0" width="264" height="210" fill="#FAEEDA" />
          <Rect x="0" y="100" width="264" height="110" fill="#F5C4B3" />
          <Circle cx="160" cy="100" r="32" fill="#D85A30" />
          <Path
            d="M0,165 L0,210 L264,210 L264,160 C220,150 200,170 175,150 C150,130 130,155 100,140 C70,125 40,150 0,165 Z"
            fill="#C99C82"
          />
          <Polygon points="50,210 90,135 135,210" fill="#993C1D" />
          <Polygon points="125,210 152,108 160,106 168,108 195,210" fill="#4A1B0C" />
          <Path
            d="M160,106 C158,95 165,90 161,78 C158,68 166,64 162,52"
            stroke="#FAF8F4"
            strokeWidth={2}
            fill="none"
            opacity={0.55}
            strokeLinecap="round"
          />
          <Path
            d="M0,195 L0,180 C20,165 35,178 50,168 C65,158 78,172 95,162 C112,152 128,170 145,160 C162,150 178,168 195,158 C212,148 228,165 245,155 C255,150 260,158 264,160 L264,195 Z"
            fill="#2C2C2A"
          />
          <Rect x="0" y="195" width="264" height="15" fill="#4A1B0C" />
        </Svg>

        <View style={styles.heroOverlayTop}>
          <View style={styles.locationPill}>
            <MapPin color={colors.lave} size={12} />
            <Text style={styles.locationPillText}>Kinshasa</Text>
          </View>
        </View>

        <View style={styles.heroOverlayBottom}>
          <Text style={styles.wordmark}>Yaka</Text>
          <Text style={styles.tagline}>Les merveilles du Congo</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <SearchIcon color={colors.faint} size={16} />
        <Text style={styles.searchPlaceholder}>Hôtel, restaurant, site...</Text>
      </View>

      <View style={styles.content}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.key}
              label={cat.label}
              active={activeCategory === cat.key}
              onPress={() => setActiveCategory(cat.key)}
            />
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Recommandés près de vous</Text>

        <View style={{ gap: 12 }}>
          {listings.map((item) => (
            <ListingCard key={item.id} establishment={item} />
          ))}
          {!loading && listings.length === 0 && (
            <Text style={styles.empty}>Aucun établissement publié pour le moment dans cette catégorie.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  hero: { position: 'relative' },
  heroOverlayTop: { position: 'absolute', top: 14, right: 16 },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  locationPillText: { fontSize: 11, fontWeight: '500', color: colors.lave },
  heroOverlayBottom: { position: 'absolute', bottom: 14, left: 18 },
  wordmark: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 27, color: colors.cream },
  tagline: { fontSize: 11, color: 'rgba(250,248,244,0.85)', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    marginHorizontal: 16,
    marginTop: -18,
    padding: 12,
  },
  searchPlaceholder: { fontSize: 13, color: colors.faint },
  content: { paddingHorizontal: 18, paddingTop: 14 },
  pillsRow: { marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: colors.ink, marginVertical: 10 },
  empty: { fontSize: 12, color: colors.muted, paddingVertical: 12 },
});
