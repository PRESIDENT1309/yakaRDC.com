import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Star, MapPin } from 'lucide-react-native';
import { colors, categoryColors, typography, radii } from '../lib/theme';
import CategoryIcon from './CategoryIcon';
import type { EstablishmentType } from '../lib/types';

export interface ListingCardBadge {
  label: string;
  tone: 'success' | 'warning' | 'danger';
}

export interface ListingCardProps {
  type: EstablishmentType;
  name: string;
  location: string;
  coverPhotoUrl?: string | null;
  avgRating?: number | null;
  reviewCount?: number;
  // Chaîne déjà formatée par l'écran appelant (ex. "45 USD / nuit" ou
  // "Tarif sur demande") — la carte reste sans logique de formatage propre.
  // Omis => pas de ligne prix (c'est le cas de la Homepage aujourd'hui).
  priceLabel?: string;
  // Badge de statut (ex. "Confirmée" / "En attente" / "Refusée" pour
  // Réservations) — indépendant de priceLabel : les deux peuvent coexister,
  // chacun peut être omis séparément. Remplace la pastille "Nouveau" en haut
  // à droite de la photo quand fourni (même emplacement, même logique de
  // repli que ratingPill/newPill).
  badge?: ListingCardBadge;
  width?: number;
  onPress: () => void;
}

const badgeTone: Record<ListingCardBadge['tone'], { bg: string; color: string }> = {
  success: { bg: colors.successSoft, color: colors.success },
  warning: { bg: colors.warningSoft, color: colors.warning },
  danger: { bg: colors.dangerSoft, color: colors.danger },
};

// Carte d'établissement — source officielle, utilisée par la Homepage et
// Recherche. Photo dominante, catégorie en légende, nom en Playfair,
// localisation en Manrope. Pas d'icône décorative : l'icône de catégorie
// n'apparaît qu'en repli, quand aucune photo n'est disponible.
export default function ListingCard({
  type, name, location, coverPhotoUrl, avgRating, reviewCount, priceLabel, badge, width, onPress,
}: ListingCardProps) {
  const cat = categoryColors[type];
  const tone = cat?.accent ?? colors.lave;

  return (
    <Pressable style={[styles.card, width ? { width } : null]} onPress={onPress}>
      <View style={[styles.image, { backgroundColor: tone }]}>
        {coverPhotoUrl ? (
          <Image source={{ uri: coverPhotoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <CategoryIcon type={type} size={30} color="rgba(250,248,244,0.85)" />
        )}
        {badge ? (
          <View style={[styles.statusPill, { backgroundColor: badgeTone[badge.tone].bg }]}>
            <Text style={[styles.statusPillText, { color: badgeTone[badge.tone].color }]}>{badge.label}</Text>
          </View>
        ) : avgRating != null ? (
          <View style={styles.ratingPill}>
            <Star size={9} color={colors.or} fill={colors.or} />
            <Text style={styles.ratingPillText}>{avgRating.toFixed(1)}</Text>
          </View>
        ) : (
          <View style={styles.newPill}>
            <Text style={styles.newPillText}>Nouveau</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.category}>{cat?.label ?? 'Établissement'}</Text>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <View style={styles.locationRow}>
          <MapPin size={10} color={colors.faint} />
          <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
        </View>
        {priceLabel ? (
          <View style={styles.bottomRow}>
            <Text style={[styles.price, { color: tone }]}>{priceLabel}</Text>
            {!!reviewCount && <Text style={styles.reviewCount}>{reviewCount} avis</Text>}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  image: { height: 130, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ratingPill: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.white, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
  },
  ratingPillText: { ...typography.captionSm, ...typography.caption, color: colors.or, },
  newPill: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: colors.fleuveSoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  newPillText: { ...typography.badgeSm, color: colors.fleuveDark },
  statusPill: {
    position: 'absolute', top: 8, right: 8,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  statusPillText: { ...typography.badgeSm },
  body: { padding: 12 },
  category: { ...typography.overlineXs, color: colors.faint, textTransform: 'uppercase', marginBottom: 3 },
  name: { ...typography.cardTitle, color: colors.ink, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { ...typography.caption, color: colors.faint, flex: 1 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  price: { ...typography.caption, fontWeight: '600' },
  reviewCount: { ...typography.caption, color: colors.faint },
});
