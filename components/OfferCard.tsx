import { etatBascule } from '../lib/a11y';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Check, Users } from 'lucide-react-native';
import { colors, typography, radii, spacing, fonts } from '../lib/theme';
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
  /**
   * Ce que la carte est pour la lecture vocale quand elle se touche. `radio` :
   * une option parmi d'autres dans un choix unique, annoncée cochée ou non.
   * `button` (défaut) : une action, avec son état sélectionné.
   */
  accessibilityRole?: 'button' | 'radio';
}

// Carte d'une catégorie proposée par l'établissement — utilisée sur la fiche
// et dans l'étape de choix du formulaire. Volontairement pas ListingCard :
// celle-ci décrit un établissement, celle-là une offre à l'intérieur.
export default function OfferCard({
  offer, category, photoUrl, remaining, selected = false, onPress, accent = colors.lave,
  accessibilityRole = 'button',
}: OfferCardProps) {
  const full = remaining !== undefined && remaining <= 0;
  const titre = offerLabel(offer, category);
  const disponibilite = remaining === undefined
    ? null
    : full
      ? 'Complet à ces dates'
      : remaining <= 3
        ? `Plus que ${remaining} disponible${remaining > 1 ? 's' : ''}`
        : 'Disponible';
  const style = [
    styles.card,
    selected && { borderColor: accent, borderWidth: 1.5 },
    full && styles.cardFull,
  ];

  const contenu = (
    <>
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
          accessibilityLabel={titre}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{titre}</Text>
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
        {disponibilite !== null && (
          <Text style={[styles.availability, full ? styles.availabilityFull : null]}>
            {disponibilite}
          </Text>
        )}
      </View>
    </>
  );

  // Sans action, la carte n'est qu'un contenu : ses textes se lisent un à un.
  if (!onPress) return <View style={style}>{contenu}</View>;

  const choix = accessibilityRole === 'radio';
  return (
    <Pressable
      style={style}
      onPress={onPress}
      // Une offre complète reste annoncée, mais comme indisponible : la retirer
      // de la lecture ferait croire qu'elle n'existe pas.
      disabled={full}
      accessibilityRole={accessibilityRole}
      // Un seul libellé pour toute la carte. Laissée à ses enfants, la lecture
      // répétait le nom — celui de la photo, puis le titre — et butait sur
      // l'abréviation « pers. max ».
      accessibilityLabel={[
        titre,
        offer.description,
        `${offer.price} ${offer.currency}`,
        offer.max_guests != null ? `${offer.max_guests} personne${offer.max_guests > 1 ? 's' : ''} maximum` : null,
        disponibilite,
      ].filter(Boolean).join(', ')}
      // Sans état annoncé, le choix en cours n'était porté que par la couleur
      // du contour. « Coché » pour un bouton radio, « enfoncé » pour un bouton.
      aria-disabled={full}
      aria-checked={choix ? selected : undefined}
      {...(choix ? null : etatBascule(selected))}
    >
      {contenu}
    </Pressable>
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
  body: { flex: 1, padding: spacing.sm, gap: spacing.v2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  title: { ...typography.cardTitle, color: colors.ink, flex: 1 },
  description: { ...typography.caption, color: colors.muted, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.v2 },
  meta: { ...typography.caption, color: colors.faint },
  metaSep: { ...typography.caption, color: colors.faint },
  price: { ...typography.caption, fontFamily: fonts.sansSemiBold },
  availability: { ...typography.badgeSm, color: colors.success, marginTop: spacing.v2 },
  availabilityFull: { color: colors.danger },
});
