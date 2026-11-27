import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useConfirm } from '../../lib/confirm-context';
import { Star, Trash2, Building2, Home, UtensilsCrossed, Mountain } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { ecrire } from '../../lib/db';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, typography, radii, spacing, breakpoints } from '../../lib/theme';
import type { Review, Establishment, EstablishmentType } from '../../lib/types';
import BoutonIcone from '../../components/BoutonIcone';

type ReviewWithEstablishment = Review & { establishment: Establishment };

function TypeIcon({ type }: { type: EstablishmentType }) {
  const cat = categoryColors[type];
  const props = { size: 16, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

export default function ReviewsScreen() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<ReviewWithEstablishment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reviews')
      .select('*, establishment:establishments(*)')
      .order('created_at', { ascending: false })
      .limit(100);
    setReviews((data as ReviewWithEstablishment[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function confirmDelete(review: ReviewWithEstablishment) {
    // Le dialogue de l'application plutôt que `Alert.alert` : sur le web, ce
    // dernier ouvre la fenêtre grise du navigateur, où rien ne distingue une
    // suppression définitive d'une simple question.
    const ok = await confirm({
      title: 'Supprimer cet avis ?',
      message: `L'avis laissé sur ${review.establishment?.name ?? 'cet établissement'} sera supprimé. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;

    // La liste se corrigerait d'elle-même au rechargement, mais le
    // journal d'audit, lui, garderait la trace d'une suppression qui
    // n'a pas eu lieu.
    const supprime = await ecrire(
      supabase.from('reviews').delete().eq('id', review.id),
      "Suppression de l'avis",
    );
    if (!supprime) return;
    if (profile?.id) {
      await supabase.from('admin_activity_log').insert({
        actor_id: profile.id,
        action: 'review_deleted',
        target_type: 'review',
        target_id: review.id,
        details: { establishment_name: review.establishment?.name, rating: review.rating },
      });
    }
    fetchReviews();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header" aria-level={1}>Avis clients</Text>
        <Text style={styles.headerSub}>{reviews.length} avis sur la plateforme</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.lave} style={{ marginTop: 30 }} /> : reviews.length === 0 ? (
          <View style={styles.empty}>
            <Star size={32} color={colors.borderStrong} />
            <Text style={styles.emptyText}>Aucun avis pour le moment.</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {reviews.map(r => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <TypeIcon type={r.establishment?.type} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.estabName} numberOfLines={1}>{r.establishment?.name ?? 'Établissement inconnu'}</Text>
                    {/* Cinq étoiles dessinées ne disent rien à la lecture vocale : la note est donnée en clair. */}
                    <View
                      style={{ flexDirection: 'row', gap: spacing.v2, marginTop: spacing.v2 }}
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={`Note : ${r.rating} sur 5`}
                    >
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={11} color={colors.warning} fill={i <= r.rating ? colors.warning : 'transparent'} />
                      ))}
                    </View>
                  </View>
                  {/* Le bouton mesurait 28 px, élargi par `hitSlop` — que le web ignore. */}
                  <BoutonIcone
                    label={`Supprimer l'avis sur ${r.establishment?.name ?? 'cet établissement'}`}
                    taille={28}
                    fond={colors.dangerSoft}
                    onPress={() => confirmDelete(r)}
                    icon={<Trash2 size={15} color={colors.danger} />}
                  />
                </View>
                {r.comment && <Text style={styles.comment}>{r.comment}</Text>}
                <Text style={styles.date}>{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  // Meme largeur que le contenu : sans cela, le filet du bas et les actions
  // de droite depassaient la colonne de plusieurs centaines de pixels.
  // La colonne est centrée : calée à gauche, elle laissait sur grand écran tout
  // le vide du même côté. La zone sûre, elle, est dégagée par le layout de l'admin.
  header: { maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center', paddingTop: spacing.md, paddingHorizontal: spacing.v20, paddingBottom: spacing.v12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.titleSm, color: colors.ink, },
  headerSub: { ...typography.captionSm, color: colors.muted, marginTop: spacing.v2, },
  content: { padding: spacing.v20, width: '100%', maxWidth: breakpoints.panelMax, alignSelf: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.v12 },
  emptyText: { ...typography.bodyXs, color: colors.muted, },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.v12 },
  estabName: { ...typography.pillLabel, color: colors.ink, },
  comment: { ...typography.bodyXs, color: colors.muted, marginTop: spacing.sm, },
  date: { ...typography.captionSm, color: colors.faint, marginTop: spacing.sm, },
});