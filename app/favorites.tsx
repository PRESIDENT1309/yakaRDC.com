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
import EmptyState from '../components/EmptyState';

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
    // Sans session, cette fonction sortait avant tout `setLoading(false)`,
    // alors que `loading` démarre à `true` : un visiteur non connecté restait
    // devant un disque qui tournait indéfiniment. C'est le pire état d'attente
    // possible — il ne finit jamais et n'explique rien. On rend la main à
    // l'écran, qui sait dire qu'il faut un compte.
    if (!session?.user) { setFavorites([]); setLoading(false); return; }
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
        ) : !session?.user ? (
          /* Deux vides distincts, longtemps confondus derrière le même disque :
             « pas encore de favori » et « pas de compte ». Le second n'appelle
             pas le catalogue mais la connexion, avec un retour ici une fois
             connecté. */
          <EmptyState
            icon={<Heart size={44} color={colors.borderStrong} strokeWidth={1.75} />}
            title="Vos favoris vous attendent"
            description="Connectez-vous pour retrouver ici les adresses que vous enregistrez."
            actionLabel="Se connecter"
            onAction={() => router.push({
              pathname: '/(auth)/login',
              params: { redirect: '/favorites', reason: 'Connectez-vous pour retrouver vos favoris.' },
            })}
          />
        ) : favorites.length === 0 ? (
          /* Un écran vide qui explique sans proposer laisse l'utilisateur au
             même endroit. Celui-ci est le premier que voit un compte neuf :
             il porte donc une sortie vers le catalogue, pas seulement un
             constat. */
          <EmptyState
            icon={<Heart size={44} color={colors.borderStrong} strokeWidth={1.75} />}
            title="Aucun favori pour le moment"
            description="Touchez le cœur sur une fiche d'établissement pour la retrouver ici."
            actionLabel="Explorer les établissements"
            onAction={() => router.push('/(tabs)/search')}
          />
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