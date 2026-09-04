import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Check, Users } from 'lucide-react-native';
import { colors, typography, radii, spacing } from '../lib/theme';
import type { EstablishmentOffer, OfferCategory } from '../lib/types';
import { offerLabel } from '../lib/types';

export interface OfferCardProps {
  offer: EstablishmentOffer;
  category?: OfferCategory;
  photoUrl?: string | null;
  /** Unités encore libres aux dates choisies. undefined = non calculé */
  remaining?: number;
  selected?: boolean;
  onPress?: () => void;
  accent?: string;
}

// Carte d'une catégorie proposée par l'établissement — utilisée sur la fiche
// et dans l'étape de choix du formulaire. Volontairement pas ListingCard :
// celle-ci décrit un établissement, celle-là une offre à l'intérieur.
export default function OfferCard({
  offer, category, photoUrl, remaining, selected = false, onPress, accent = colors.lave,
}: OfferCardProps) {
  const full = remaining !== undefined && remaining <= 0;
  const Wrapper: any = onPress && !full ? Pressable : View;

  return (
    <Wrapper
      style={[
        styles.card,
        selected && { borderColor: accent, borderWidth: 1.5 },
        full && styles.cardFull,
      ]}
      onPress={onPress && !full ? onPress : undefined}
    >
      {photoUrl ? (
        /* La bande photo garde sa largeur fixe de 92 : c'est une vignette
           latérale dans une carte en ligne, pas une photo de contenu — le
           rapport y est imposé par la hauteur de la carte, pas l'inverse. */
        <Image
          source={{ uri: photoUrl }}
          style={styles.photo}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
          recyclingKey={photoUrl}
          accessibilityLabel={offerLabel(offer, category)}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{offerLabel(offer, category)}</Text>
          {selected && <Check size={15} color={accent} strokeWidth={2} />}
        </View>

        {!!offer.description && (
          <Text style={styles.description} numberOfLines={2}>{offer.description}</Text>
        )}

        <View style={styles.metaRow}>
          {offer.max_guests != null && (
            <>
              <Users size={11} color={colors.faint} strokeWidth={1.75} />
              <Text style={styles.meta}>{offer.max_guests} pers. max</Text>
              <Text style={styles.metaSep}>·</Text>
            </>
          )}
          <Text style={[styles.price, { color: accent }]}>
            {offer.price} {offer.currency}
          </Text>
        </View>

        {/* La disponibilité n'est annoncée que lorsqu'elle est réellement
            calculée — afficher « disponible » sans l'avoir vérifié serait pire
            que de ne rien dire. */}
        {remaining !== undefined && (
          <Text style={[styles.availability, full ? styles.availabilityFull : null]}>
            {full
              ? 'Complet à ces dates'
              : remaining <= 3
                ? `Plus que ${remaining} disponible${remaining > 1 ? 's' : ''}`
                : 'Disponible'}
          </Text>
        )}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, overflow: 'hidden',
  },
  cardFull: { opacity: 0.55 },
  photo: { width: 92, height: '100%', minHeight: 92, backgroundColor: colors.surfaceSunken },
  body: { flex: 1, padding: spacing.sm, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  title: { ...typography.cardTitle, color: colors.ink, flex: 1 },
  description: { ...typography.caption, color: colors.muted, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { ...typography.caption, color: colors.faint },
  metaSep: { ...typography.caption, color: colors.faint },
  price: { ...typography.caption, fontWeight: '600' },
  availability: { ...typography.badgeSm, color: colors.success, marginTop: 2 },
  availabilityFull: { color: colors.danger },
});
