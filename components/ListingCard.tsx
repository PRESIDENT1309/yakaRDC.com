import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Star, MapPin } from 'lucide-react-native';
import { colors, categoryColors, typography, radii, ratios, spacing, fonts } from '../lib/theme';
import { useAppuiAnime } from '../lib/motion';
import { lienVers } from '../lib/liens';

const PressableAnime = Animated.createAnimatedComponent(Pressable);
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
  // Destination de la carte. À préférer à `onPress` dès que la carte mène à un
  // écran : sur le web elle devient alors un vrai lien (nouvel onglet, copie
  // d'adresse, moteurs de recherche) — voir lib/liens.ts.
  href?: string;
  // Avec `href` : remplace l'écran courant au lieu d'en empiler un (d'une fiche
  // vers une fiche voisine, pour que « retour » ramène à la liste).
  remplacer?: boolean;
  onPress?: () => void;
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
  type, name, location, coverPhotoUrl, avgRating, reviewCount, priceLabel, badge, width, href, remplacer, onPress,
}: ListingCardProps) {
  const cat = categoryColors[type];
  const tone = cat?.accent ?? colors.lave;
  // La carte est la cible tactile principale du catalogue : c'est par elle
  // qu'on entre dans une fiche. Elle mérite le même retour que les boutons.
  const appui = useAppuiAnime();

  return (
    <PressableAnime
      style={[styles.card, width ? { width } : null, appui.style]}
      {...(href ? lienVers(href, { avant: onPress, remplacer }) : { onPress })}
      // Une annonce courte plutôt que la lecture de chaque texte de la carte,
      // pastille « Nouveau » et pictogrammes compris.
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={[
        name,
        cat?.label,
        location,
        avgRating != null ? `note ${avgRating.toFixed(1)} sur 5` : null,
        badge?.label,
        priceLabel,
      ].filter(Boolean).join(', ')}
      {...appui.gestes}
    >
      <View style={[styles.image, { backgroundColor: tone }]}>
        {coverPhotoUrl ? (
          /* `transition` remplace l'apparition brutale par un fondu de 220 ms,
             posé sur la couleur de catégorie qui remplit déjà la boîte : la
             photo se substitue à un aplat de marque plutôt qu'à du vide.
             `cachePolicy` évite de retélécharger la même vignette à chaque
             retour sur la liste — ce qui compte davantage sur un réseau lent
             que le fondu lui-même. */
          <Image
            source={{ uri: coverPhotoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            recyclingKey={coverPhotoUrl}
            // `accessibilityLabel` et non `alt` : vérifié dans le DOM, seul le
            // premier pose réellement l'attribut `alt` sur le web, malgré une
            // documentation qui les présente comme équivalents.
            accessibilityLabel={`Photo de ${name}`}
          />
        ) : (
          <CategoryIcon type={type} size={30} color={colors.onBrandMuted} />
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
    </PressableAnime>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  // Rapport plutôt que hauteur fixe : à 130 px, une carte large aplatissait sa
  // photo et une carte étroite l'étirait. Le cadrage est désormais le même
  // partout, quelle que soit la largeur que lui donne l'écran appelant.
  image: { aspectRatio: ratios.carte, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ratingPill: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: spacing.v2,
    backgroundColor: colors.white, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.v2,
  },
  ratingPillText: { ...typography.caption, color: colors.or },
  newPill: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: colors.fleuveSoft, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.v2,
  },
  newPillText: { ...typography.badgeSm, color: colors.fleuveDark },
  statusPill: {
    position: 'absolute', top: 8, right: 8,
    borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.v2,
  },
  statusPillText: { ...typography.badgeSm },
  body: { padding: spacing.v12 },
  category: { ...typography.overlineXs, color: colors.faint, textTransform: 'uppercase', marginBottom: spacing.v2 },
  name: { ...typography.cardTitle, color: colors.ink, marginBottom: spacing.xs },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.v2 },
  locationText: { ...typography.caption, color: colors.faint, flex: 1 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  // La graisse passe par la famille : chaque graisse de Manrope est un fichier
  // distinct, et `fontWeight` ne faisait qu'épaissir artificiellement le 500.
  price: { ...typography.caption, fontFamily: fonts.sansSemiBold },
  reviewCount: { ...typography.caption, color: colors.faint },
});
