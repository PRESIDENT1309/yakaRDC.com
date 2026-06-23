import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Svg, { Rect, Circle } from 'react-native-svg';
import { ArrowLeft, Heart, MapPin, Wifi } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, categoryColors, radii } from '../../lib/theme';
import type { Establishment, Rate } from '../../lib/types';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [rate, setRate] = useState<Rate | null>(null);

  useEffect(() => {
    supabase
      .from('establishments')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => setEstablishment(data as Establishment));

    supabase
      .from('rates')
      .select('*')
      .eq('establishment_id', id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setRate(data as Rate | null));
  }, [id]);

  if (!establishment) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: colors.muted }}>Chargement...</Text>
      </View>
    );
  }

  const accent = categoryColors[establishment.type]?.accent ?? colors.lave;
  const soft = categoryColors[establishment.type]?.soft ?? colors.laveSoft;

  function handleRequestBooking() {
    // Écran de formulaire de demande à construire à l'étape suivante
    // (app/booking/new.tsx) : dates ou créneau, nombre de personnes, notes.
    router.push(`/booking/new?establishmentId=${establishment!.id}`);
  }

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.hero}>
        <Svg width="100%" height={180} viewBox="0 0 264 180">
          <Rect x="0" y="0" width="264" height="180" fill={soft} />
          <Circle cx="160" cy="90" r="36" fill={accent} opacity={0.25} />
        </Svg>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={colors.ink} size={16} />
        </Pressable>
        <Pressable style={styles.heartButton}>
          <Heart color={colors.ink} size={16} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>{establishment.name}</Text>
        <View style={styles.locationRow}>
          <MapPin color={colors.muted} size={12} />
          <Text style={styles.locationText}>
            {establishment.neighborhood}, {establishment.city}
          </Text>
        </View>

        {establishment.description && <Text style={styles.description}>{establishment.description}</Text>}

        {establishment.amenities?.length > 0 && (
          <View style={styles.amenitiesRow}>
            {establishment.amenities.map((a) => (
              <View key={a} style={styles.amenityChip}>
                <Wifi color={accent} size={14} />
                <Text style={styles.amenityText}>{a}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {rate ? `${rate.price} $` : 'Tarif sur demande'}
            {rate && (
              <Text style={styles.priceUnit}>
                {' '}
                / {rate.unit === 'night' ? 'nuit' : rate.unit === 'person' ? 'personne' : 'visite'}
              </Text>
            )}
          </Text>
        </View>

        <Pressable style={[styles.cta, { backgroundColor: accent }]} onPress={handleRequestBooking}>
          <Text style={styles.ctaText}>Demander une réservation</Text>
        </Pressable>
        <Text style={styles.ctaNote}>Confirmation par téléphone sous 24h</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  hero: { position: 'relative' },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 18 },
  name: { fontSize: 19, fontWeight: '500', color: colors.ink },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  locationText: { fontSize: 12, color: colors.muted },
  description: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 14 },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  amenityText: { fontSize: 11, color: colors.ink },
  priceRow: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  price: { fontSize: 18, fontWeight: '500', color: colors.ink },
  priceUnit: { fontSize: 11, fontWeight: '400', color: colors.faint },
  cta: { marginTop: 12, padding: 14, borderRadius: radii.lg, alignItems: 'center' },
  ctaText: { color: colors.white, fontWeight: '500', fontSize: 14 },
  ctaNote: { textAlign: 'center', fontSize: 11, color: colors.faint, marginTop: 8 },
});
