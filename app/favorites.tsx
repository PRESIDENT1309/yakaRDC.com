import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  Heart, Building2, Home, UtensilsCrossed, Mountain, MapPin, WifiOff,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { ecrire } from '../lib/db';
import { lienVers } from '../lib/liens';
import { useAuth } from '../lib/auth-context';
import { colors, categoryColors, typography, radii, spacing, breakpoints, cible } from '../lib/theme';
import type { Favorite, Establishment, EstablishmentType } from '../lib/types';
import ScreenHeader from '../components/ScreenHeader';
import BoutonIcone from '../components/BoutonIcone';
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
  const [erreur, setErreur] = useState(false);

  const fetchFavorites = useCallback(async () => {
    // Sans session, cette fonction sortait avant tout `setLoading(false)`,
    // alors que `loading` démarre à `true` : un visiteur non connecté restait
    // devant un disque qui tournait indéfiniment. C'est le pire état d'attente
    // possible — il ne finit jamais et n'explique rien. On rend la main à
    // l'écran, qui sait dire qu'il faut un compte.
    if (!session?.user) { setFavorites([]); setErreur(false); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('favorites')
      .select('*, establishment:establishments(*)')
      .eq('traveler_id', session.user.id)
      .order('created_at', { ascending: false });
    // Une panne n'est pas « aucun favori » : on le dit, et on propose de
    // réessayer, plutôt que d'inviter à refaire une liste qui existe déjà.
    setErreur(!!error);
    // Un favori peut pointer vers un établissement que l'utilisateur ne peut
    // plus lire (retiré, ou dépublié) : la jointure revient alors vide. Ces
    // lignes faisaient planter l'écran à l'appui (`e.id` sur `null`).
    setFavorites(((data as FavoriteWithEstablishment[]) ?? []).filter(f => f.establishment));
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
      <ScreenHeader title="Mes favoris" backFallback="/(tabs)/profile" contentMaxWidth={breakpoints.panelMax} />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.lave} style={{ marginTop: 40 }} accessibilityLabel="Chargement de vos favoris" />
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
        ) : erreur ? (
          <EmptyState
            icon={<WifiOff size={44} color={colors.borderStrong} strokeWidth={1.75} />}
            title="Chargement impossible"
            description="Vos favoris n'ont pas pu être chargés. Vérifiez votre connexion, puis réessayez."
            actionLabel="Réessayer"
            onAction={fetchFavorites}
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
          <View style={{ gap: spacing.sm }}>
            {favorites.map(f => {
              const e = f.establishment;
              return (
                /* Deux cibles côte à côte, et non l'une dans l'autre : le cœur
                   vivait à l'intérieur de la ligne pressable, ce qui donne sur
                   le web un bouton dans un lien — invalide, et imprévisible au
                   clavier comme au lecteur d'écran. */
                <View key={f.id} style={styles.row}>
                  <Pressable style={styles.rowLink} accessibilityRole="link" {...lienVers(`/listing/${e.id}`)}>
                    <TypeIcon type={e.type} size={22} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{e.name}</Text>
                      <View style={styles.locationRow}>
                        <MapPin size={10} color={colors.faint} />
                        <Text style={styles.rowLocation}>{e.commune ?? e.neighborhood ?? e.city}</Text>
                      </View>
                    </View>
                  </Pressable>
                  {/* Le cœur ne mesurait que 18 px, élargi par un `hitSlop`
                      que le web ignore. Sa zone passe à 44 px sans que la
                      carte ne bouge : le dessin, lui, garde sa taille. */}
                  <BoutonIcone
                    label={`Retirer ${e.name} des favoris`}
                    taille={18}
                    onPress={() => handleRemove(f.id)}
                    icon={<Heart size={18} color={colors.danger} fill={colors.danger} />}
                  />
                </View>
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
  // Une liste à une colonne étirée sur 1200 px éloignait le cœur du nom qu'il
  // concerne : elle se centre sur la largeur d'un panneau, comme son en-tête.
  content: { padding: spacing.md, width: '100%', maxWidth: breakpoints.panelMax, alignSelf: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.v12,
  },
  rowLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.v12, minHeight: cible.min },
  rowName: { ...typography.pillLabel, color: colors.ink, },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v2, marginTop: spacing.v2 },
  rowLocation: { ...typography.captionSm, color: colors.faint, },
});