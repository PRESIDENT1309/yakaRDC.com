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
import { colors, categoryColors, typography } from '../lib/theme';
import type { Booking, Establishment, EstablishmentType } from '../lib/types';
import ScreenHeader from '../components/ScreenHeader';

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
    if (!session?.user) return;
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
        ) : bookings.length === 0 ? (
          <View style={styles.empty}>
            <Clock size={32} color={colors.borderStrong} />
            <Text style={styles.emptyText}>Aucune notification pour le moment.</Text>
            <Text style={styles.emptySubtext}>
              Vous serez informé ici dès qu'une de vos réservations change de statut.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
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
  content: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { ...typography.labelMd, color: colors.ink, },
  emptySubtext: { ...typography.bodyXs, color: colors.muted, textAlign: 'center', maxWidth: 260, },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12,
  },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowText: { ...typography.bodyXs, color: colors.ink, },
  rowDate: { ...typography.captionSm, color: colors.faint, marginTop: 3, },
});