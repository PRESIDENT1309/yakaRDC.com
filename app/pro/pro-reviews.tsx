import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Star, MessageCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';
import type { Establishment, Review } from '../../lib/types';

export default function PartnerReviewsScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data: est } = await supabase.from('establishments').select('id')
      .eq('owner_id', profile.id).limit(1).maybeSingle();
    const e = est as Establishment | null;
    if (!e) { setLoading(false); return; }

    const { data } = await supabase.from('reviews').select('*')
      .eq('establishment_id', e.id).order('created_at', { ascending: false });
    setReviews((data as Review[]) ?? []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function handleReply(reviewId: string) {
    const text = replyDraft[reviewId]?.trim();
    if (!text) return;
    setReplying(reviewId);
    await supabase.from('reviews').update({
      partner_reply: text,
      partner_replied_at: new Date().toISOString(),
    }).eq('id', reviewId);
    setReplying(null);
    fetchReviews();
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color="#FAF8F4" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Avis clients</Text>
          <Text style={styles.headerSub}>{reviews.length} avis · {avgRating} ★ en moyenne</Text>
        </View>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <ActivityIndicator color={colors.lave} style={{ marginTop: 40 }} />
        ) : reviews.length === 0 ? (
          <Text style={styles.emptyText}>Aucun avis pour le moment.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {reviews.map(r => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={{ flexDirection: 'row', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={12} color="#854F0B" fill={i <= r.rating ? '#854F0B' : 'transparent'} />
                    ))}
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </Text>
                </View>

                {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}

                {r.partner_reply ? (
                  <View style={styles.replyBox}>
                    <MessageCircle size={12} color={colors.lave} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.replyLabel}>Votre réponse</Text>
                      <Text style={styles.replyText}>{r.partner_reply}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.replyForm}>
                    <TextInput
                      style={styles.replyInput}
                      value={replyDraft[r.id] ?? ''}
                      onChangeText={t => setReplyDraft(prev => ({ ...prev, [r.id]: t }))}
                      placeholder="Répondre à cet avis..."
                      placeholderTextColor={colors.faint}
                    />
                    <Pressable
                      onPress={() => handleReply(r.id)}
                      disabled={!replyDraft[r.id]?.trim() || replying === r.id}
                    >
                      <Text style={[styles.replyBtnText, !replyDraft[r.id]?.trim() && { opacity: 0.4 }]}>
                        {replying === r.id ? '...' : 'Envoyer'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F4EF' },
  header: {
    backgroundColor: colors.lave,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16, paddingHorizontal: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '500', color: '#FAF8F4', textAlign: 'center' },
  headerSub: { fontSize: 10.5, color: 'rgba(250,248,244,0.7)', marginTop: 2, textAlign: 'center' },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 40 },
  reviewCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewDate: { fontSize: 10, color: colors.faint },
  reviewComment: { fontSize: 12.5, color: colors.ink, lineHeight: 18, marginBottom: 10 },
  replyBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: colors.laveSoft, borderRadius: 8, padding: 9 },
  replyLabel: { fontSize: 9.5, color: colors.lave, fontWeight: '600', marginBottom: 2 },
  replyText: { fontSize: 11.5, color: colors.ink },
  replyForm: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#F0EEE4', paddingTop: 9 },
  replyInput: { flex: 1, fontSize: 12, color: colors.ink, paddingVertical: 4 },
  replyBtnText: { fontSize: 11.5, color: colors.lave, fontWeight: '600' },
});