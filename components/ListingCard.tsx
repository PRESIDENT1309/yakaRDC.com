import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Building2, MapPin } from 'lucide-react-native';
import { colors, categoryColors, radii } from '../lib/theme';
import type { Establishment, Rate } from '../lib/types';

interface Props {
  establishment: Establishment;
  rate?: Rate;
  rating?: number;
}

export default function ListingCard({ establishment, rate, rating }: Props) {
  const accent = categoryColors[establishment.type]?.accent ?? colors.lave;
  const soft = categoryColors[establishment.type]?.soft ?? colors.laveSoft;

  const priceLabel = rate
    ? `${rate.price} ${rate.currency} / ${rate.unit === 'night' ? 'nuit' : rate.unit === 'person' ? 'pers.' : 'visite'}`
    : 'Tarif sur demande';

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/listing/${establishment.id}`)}>
      <View style={[styles.thumb, { backgroundColor: soft }]}>
        <Building2 color={accent} size={24} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {establishment.name}
        </Text>
        <View style={styles.locationRow}>
          <MapPin color={colors.muted} size={11} />
          <Text style={styles.location}>{establishment.neighborhood ?? establishment.city}</Text>
        </View>
        <Text style={styles.price}>
          {priceLabel}
          {rating ? <Text style={styles.rating}> · {rating.toFixed(1)} ★</Text> : null}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 8,
  },
  thumb: { width: 56, height: 56, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '500', color: colors.ink },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  location: { fontSize: 11, color: colors.muted },
  price: { fontSize: 12, color: colors.ink, marginTop: 2 },
  rating: { color: colors.muted },
});
