import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft, Heart, Building2, Home, UtensilsCrossed, Mountain, MapPin,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { colors, categoryColors } from '../lib/theme';
import type { Favorite, Establishment, EstablishmentType } from '../lib/types';

type FavoriteWithEstablishment = Favorite & { establishment: Establishment };

function TypeIcon({ type, size = 24 }: { type: EstablishmentType; size?: number }) {
  const cat = categoryColors[type];
  const props = { size, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

export default function FavoritesScreen() {
  const { session } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteWithEstablishment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const { data } = await supabase
      .from('favorites')
      .select('*, establishment:establishments(*)')
      .eq('traveler_id', session.user.id)
      .order('created_at', { ascending: false });
    setFavorites((data as FavoriteWithEstablishment[]) ?? []);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  async function handleRemove(favoriteId: string) {
    await supabase.from('favorites').delete().eq('id', favoriteId);
    setFavorites(prev => prev.filter(f => f.id !== favoriteId));
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color="#FAF8F4" />
        </Pressable>
        <Text style={styles.headerTitle}>Mes favoris</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.lave} style={{ marginTop: 40 }} />
        ) : favorites.length === 0 ? (
          <View style={styles.empty}>
            <Heart size={32} color={colors.borderStrong} />
            <Text style={styles.emptyText}>Aucun favori pour le moment.</Text>
            <Text style={styles.emptySubtext}>
              Touchez le cœur sur une fiche d'établissement pour l'ajouter ici.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {favorites.map(f => {
              const e = f.establishment;
              const cat = categoryColors[e?.type];
              return (
                <Pressable
                  key={f.id}
                  style={styles.row}
                  onPress={() => router.push(`/listing/${e.id}`)}
                >
                  <View style={[styles.iconBox, { backgroundColor: cat?.soft ?? '#FAECE7' }]}>
                    <TypeIcon type={e?.type} size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{e?.name}</Text>
                    <View style={styles.locationRow}>
                      <MapPin size={10} color={colors.faint} />
                      <Text style={styles.rowLocation}>{e?.commune ?? e?.neighborhood ?? e?.city}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={(ev) => { ev.stopPropagation(); handleRemove(f.id); }}
                    hitSlop={8}
                  >
                    <Heart size={18} color="#C0392B" fill="#C0392B" />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.lave,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16, paddingHorizontal: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '500', color: '#FAF8F4' },
  content: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '500', color: colors.ink },
  emptySubtext: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18, maxWidth: 260 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12,
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 13, fontWeight: '500', color: colors.ink },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  rowLocation: { fontSize: 11, color: colors.faint },
});