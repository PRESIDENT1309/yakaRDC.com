import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, fonts, cible } from '../lib/theme';

export interface StepProgressProps {
  labels: string[];
  /** Index de l'étape courante, à partir de 0 */
  current: number;
  /** Permet de revenir en arrière en touchant une étape déjà franchie */
  onGoBack?: (index: number) => void;
  accent?: string;
}

// Indicateur de progression d'un formulaire à étapes. Un simple filet segmenté
// plutôt que des pastilles numérotées : le design system proscrit les pastilles
// décoratives, et la numérotation n'apporte rien quand il y a deux ou trois
// étapes nommées.
export default function StepProgress({ labels, current, onGoBack, accent = colors.lave }: StepProgressProps) {
  // Borné : un index hors plage donnerait « Étape 0 sur 3 » à la lecture vocale.
  const etape = Math.min(Math.max(current, 0), labels.length - 1) + 1;
  const avancement = `Étape ${etape} sur ${labels.length} : ${labels[etape - 1] ?? ''}`;

  return (
    <View style={styles.wrap}>
      {/* L'avancement n'était porté que par la couleur des segments. */}
      <View
        style={styles.bars}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Avancement"
        aria-valuemin={1}
        aria-valuemax={labels.length}
        aria-valuenow={etape}
        aria-valuetext={avancement}
      >
        {labels.map((_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: i <= current ? accent : colors.border },
            ]}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {labels.map((label, i) => {
          const done = i < current;
          const texte = (
            <Text
              style={[
                styles.label,
                i === current && { color: accent, fontFamily: fonts.sansBold },
                done && styles.labelDone,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          );
          return done && onGoBack ? (
            <Pressable
              key={label}
              style={styles.labelSlot}
              onPress={() => onGoBack(i)}
              accessibilityRole="button"
              accessibilityLabel={`Revenir à l'étape ${i + 1} : ${label}`}
            >
              {texte}
            </Pressable>
          ) : (
            <View key={label} style={styles.labelSlot}>{texte}</View>
          );
        })}
      </View>
    </View>
  );
}

const HAUTEUR_BARRE = 3;
const HAUTEUR_LIBELLE = 15;
// Zone tactile de 44 px d'une étape franchie, sans rien décaler : elle part du
// haut des segments (inertes) et finit dans la marge sous le bloc, les marges
// négatives rendant la place prise en trop. Elle ne dépasse pas le haut du
// composant : placé en tête d'une zone défilante, ce qui en sortirait ne
// recevrait pas l'appui.
const DEBORD_HAUT = spacing.sm + HAUTEUR_BARRE;
const DEBORD_BAS = cible.min - HAUTEUR_LIBELLE - DEBORD_HAUT;

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  bars: { flexDirection: 'row', gap: spacing.xs },
  bar: { flex: 1, height: HAUTEUR_BARRE, borderRadius: radii.pill },
  labels: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  // Même boîte que l'étape soit touchable ou non, pour que la rangée garde une
  // hauteur unique quand une étape franchie devient un bouton.
  labelSlot: {
    flex: 1, minHeight: cible.min,
    paddingTop: DEBORD_HAUT, marginTop: -DEBORD_HAUT, marginBottom: -DEBORD_BAS,
  },
  label: { ...typography.badgeSm, lineHeight: HAUTEUR_LIBELLE, color: colors.faint },
  labelDone: { color: colors.muted, textDecorationLine: 'underline' },
});
