import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { goBack } from '../lib/navigation';
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Building2, Home, UtensilsCrossed, Mountain,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { colors, categoryColors, typography, radii, spacing } from '../lib/theme';
import type { Booking, Establishment, EstablishmentType } from '../lib/types';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';

type BookingWithEstablishment = Booking & { establishment: Establishment };

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

function statusInfo(status: Booking['status']) {
  switch (status) {
    case 'confirmed': return { icon: CheckCircle, color: colors.success, bg: colors.successSoft, text: 'a été confirmée' };
    case 'rejected': return { icon: XCircle, color: colors.danger, bg: colors.dangerSoft, text: 'a été refusée' };
    case 'checked_in': return { icon: CheckCircle, color: colors.fleuveDark, bg: colors.fleuveSoft, text: 'a été utilisée (check-in)' };
    case 'cancelled': return { icon: XCircle, color: colors.muted, bg: colors.surfaceSunken, text: 'a été annulée' };
    default: return { icon: Clock, color: colors.warning, bg: colors.warningSoft, text: 'est en attente de confirmation' };
  }
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState<BookingWithEstablishment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    // Voir favorites.tsx : sortir avant `setLoading(false)` laissait un
    // visiteur non connecté devant un disque qui ne s'arrête jamais.
    if (!session?.user) { setBookings([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, establishment:establishments(*)')
      .eq('traveler_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setBookings((data as BookingWithEstablishment[]) ?? []);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Notifications" backFallback="/(tabs)" />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.lave} style={{ marginTop: 40 }} />
        ) : !session?.user ? (
          <EmptyState
            icon={<Clock size={44} color={colors.borderStrong} strokeWidth={1.75} />}
            title="Aucune notification"
            description="Connectez-vous pour suivre ici l'évolution de vos réservations."
            actionLabel="Se connecter"
            onAction={() => router.push({
              pathname: '/(auth)/login',
              params: { redirect: '/notifications', reason: 'Connectez-vous pour voir vos notifications.' },
            })}
          />
        ) : bookings.length === 0 ? (
          /* L'action mène aux réservations, et non au catalogue : cet écran
             peut être vide alors que des réservations existent — il l'est dès
             qu'aucune n'a changé de statut. Proposer « explorer » supposerait
             à tort que l'utilisateur n'a rien réservé. */
          <EmptyState
            icon={<Clock size={44} color={colors.borderStrong} strokeWidth={1.75} />}
            title="Aucune notification pour le moment"
            description="Vous serez informé ici dès qu'une de vos réservations change de statut."
            actionLabel="Voir mes réservations"
            onAction={() => router.push('/(tabs)/bookings')}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {bookings.map(b => {
              const info = statusInfo(b.status);
              const Icon = info.icon;
              return (
                <Pressable
                  key={b.id}
                  style={styles.row}
                  onPress={() => router.push('/(tabs)/bookings')}
                >
                  <View style={[styles.iconBox, { backgroundColor: info.bg }]}>
                    <Icon size={16} color={info.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText}>
                      Votre réservation à <Text style={{ fontWeight: '500' }}>{b.establishment?.name}</Text> {info.text}
                    </Text>
                    <Text style={styles.rowDate}>
                      {new Date(b.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </Text>
                  </View>
                  <TypeIcon type={b.establishment?.type} />
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
  content: { padding: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v10,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.v12,
  },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowText: { ...typography.bodyXs, color: colors.ink, },
  rowDate: { ...typography.captionSm, color: colors.faint, marginTop: 3, },
});