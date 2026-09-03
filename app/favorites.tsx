import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { goBack } from '../lib/navigation';
import {
  ArrowLeft, Heart, Building2, Home, UtensilsCrossed, Mountain, MapPin,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { ecrire } from '../lib/db';
import { useAuth } from '../lib/auth-context';
import { colors, categoryColors, typography } from '../lib/theme';
import type { Favorite, Establishment, EstablishmentType } from '../lib/types';
import ScreenHeader from '../components/ScreenHeader';

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
    // La fiche ne quitte la liste que si la base l'a réellement retirée.
    const retire = await ecrire(
      supabase.from('favorites').delete().eq('id', favoriteId),
      'Retrait du favori',
    );
    if (!retire) return;
    setFavorites(prev => prev.filter(f => f.id !== favoriteId));
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Mes favoris" backFallback="/(tabs)/profile" />

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
                  <View style={[styles.iconBox, { backgroundColor: cat?.soft ?? colors.laveSoft }]}>
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
                    <Heart size={18} color={colors.danger} fill={colors.danger} />
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
  content: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { ...typography.labelMd, color: colors.ink, },
  emptySubtext: { ...typography.bodyXs, color: colors.muted, textAlign: 'center', maxWidth: 260, },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12,
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowName: { ...typography.pillLabel, color: colors.ink, },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  rowLocation: { ...typography.captionSm, color: colors.faint, },
});