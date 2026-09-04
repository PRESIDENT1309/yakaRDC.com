import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { goBack } from '../../lib/navigation';
import { ArrowLeft, Star, MessageCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, typography, breakpoints, radii, spacing } from '../../lib/theme';
import type { Establishment, Review } from '../../lib/types';
import ScreenHeader from '../../components/ScreenHeader';
import EmptyState from '../../components/EmptyState';

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
      <ScreenHeader
        title="Avis clients"
        subtitle={`${reviews.length} avis · ${avgRating} ★ en moyenne`}
        backFallback="/pro"
        contentMaxWidth={breakpoints.panelMax}
      />

      <ScrollView contentContainerStyle={{ maxWidth: breakpoints.panelMax, width: '100%', alignSelf: 'center', padding: spacing.md }}>
        {loading ? (
          <ActivityIndicator color={colors.lave} style={{ marginTop: 40 }} />
        ) : reviews.length === 0 ? (
          /* Sans action, volontairement : un partenaire ne peut rien faire
             pour provoquer un avis, et lui proposer un bouton reviendrait à
             lui suggérer le contraire. La description dit d'où viendront
             les avis — c'est la seule chose utile ici. */
          <EmptyState
            icon={<MessageCircle size={44} color={colors.borderStrong} strokeWidth={1.75} />}
            title="Aucun avis pour le moment"
            description="Les avis de vos clients apparaîtront ici après leur visite."
          />
        ) : (
          <View style={{ gap: spacing.v10 }}>
            {reviews.map(r => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={{ flexDirection: 'row', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={12} color={colors.warning} fill={i <= r.rating ? colors.warning : 'transparent'} />
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
  screen: { flex: 1, backgroundColor: colors.cream },
  reviewCard: {
    backgroundColor: colors.white, borderRadius: radii.v14, padding: spacing.v14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  reviewDate: { ...typography.captionSm, color: colors.faint, },
  reviewComment: { ...typography.bodyXs, color: colors.ink, marginBottom: spacing.v10, },
  replyBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: colors.laveSoft, borderRadius: radii.sm, padding: 9 },
  replyLabel: { ...typography.badgeSm, color: colors.lave, marginBottom: spacing.v2, },
  replyText: { ...typography.captionSm, color: colors.ink, },
  replyForm: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceSunken, paddingTop: 9 },
  replyInput: { ...typography.bodyXs, flex: 1, color: colors.ink, paddingVertical: spacing.xs, },
  replyBtnText: { ...typography.caption, color: colors.lave, },
});