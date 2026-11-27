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
import { colors, categoryColors, typography, radii, spacing, fonts, breakpoints } from '../lib/theme';
import { lienVers } from '../lib/liens';
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
    case 'confirmed': return { icon: CheckCircle, color: colors.success, text: 'a été confirmée' };
    case 'rejected': return { icon: XCircle, color: colors.danger, text: 'a été refusée' };
    case 'checked_in': return { icon: CheckCircle, color: colors.fleuveDark, text: 'a été utilisée (check-in)' };
    case 'cancelled': return { icon: XCircle, color: colors.muted, text: 'a été annulée' };
    default: return { icon: Clock, color: colors.warning, text: 'est en attente de confirmation' };
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
      <ScreenHeader title="Notifications" backFallback="/(tabs)" contentMaxWidth={breakpoints.panelMax} />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.lave} style={{ marginTop: 40 }} accessibilityLabel="Chargement de vos notifications" />
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
                // Chaque ligne mène aux réservations : c'est un lien, et sur le
                // web un vrai `<a>`, qu'on peut ouvrir dans un nouvel onglet.
                <Pressable
                  key={b.id}
                  style={styles.row}
                  accessibilityRole="link"
                  {...lienVers('/bookings')}
                >
                  <Icon size={20} color={info.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText}>
                      Votre réservation à <Text style={styles.rowName}>{b.establishment?.name}</Text> {info.text}
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
  // Une liste à une colonne ne s'étire pas sur toute la largeur d'un grand
  // écran : elle se centre sur la largeur d'un panneau, comme son en-tête.
  content: { padding: spacing.md, width: '100%', maxWidth: breakpoints.panelMax, alignSelf: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.v12,
  },
  rowText: { ...typography.bodyXs, color: colors.ink, },
  // La graisse passe par la famille : avec expo-font, `fontWeight` ne donne
  // qu'un faux gras sur le web.
  rowName: { fontFamily: fonts.sansMedium },
  rowDate: { ...typography.captionSm, color: colors.faint, marginTop: spacing.v2, },
});