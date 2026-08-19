import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Alert } from '../../lib/alert';
import { Star, Trash2, Building2, Home, UtensilsCrossed, Mountain } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors } from '../../lib/theme';
import type { Review, Establishment, EstablishmentType } from '../../lib/types';

type ReviewWithEstablishment = Review & { establishment: Establishment };

function TypeIcon({ type }: { type: EstablishmentType }) {
  const cat = categoryColors[type];
  const props = { size: 14, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

export default function ReviewsScreen() {
  const { profile } = useAuth();
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

  function confirmDelete(review: ReviewWithEstablishment) {
    Alert.alert(
      'Supprimer cet avis',
      `Supprimer l'avis de ${review.establishment?.name ?? 'cet établissement'} ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          await supabase.from('reviews').delete().eq('id', review.id);
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
        }},
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Avis clients</Text>
        <Text style={styles.headerSub}>{reviews.length} avis sur la plateforme</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.lave} style={{ marginTop: 30 }} /> : reviews.length === 0 ? (
          <View style={styles.empty}>
            <Star size={32} color={colors.borderStrong} />
            <Text style={styles.emptyText}>Aucun avis pour le moment.</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {reviews.map(r => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.estabIcon, { backgroundColor: categoryColors[r.establishment?.type]?.soft ?? '#FAECE7' }]}>
                    <TypeIcon type={r.establishment?.type} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.estabName} numberOfLines={1}>{r.establishment?.name ?? 'Établissement inconnu'}</Text>
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={11} color="#854F0B" fill={i <= r.rating ? '#854F0B' : 'transparent'} />
                      ))}
                    </View>
                  </View>
                  <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(r)} hitSlop={8}>
                    <Trash2 size={15} color="#C0392B" />
                  </Pressable>
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
  header: { paddingTop: Platform.OS === 'web' ? 16 : 50, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 16, fontWeight: '500', color: colors.ink },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  content: { padding: 20, maxWidth: 700 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 12, color: colors.muted },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  estabIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  estabName: { fontSize: 13, fontWeight: '500', color: colors.ink },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  comment: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 9 },
  date: { fontSize: 10.5, color: colors.faint, marginTop: 7 },
});