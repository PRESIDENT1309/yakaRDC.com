import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing } from '../lib/theme';

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
  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
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
          const Cmp: any = done && onGoBack ? Pressable : View;
          return (
            <Cmp key={label} style={styles.labelSlot} onPress={done && onGoBack ? () => onGoBack(i) : undefined}>
              <Text
                style={[
                  styles.label,
                  i === current && { color: accent, fontWeight: '600' },
                  done && styles.labelDone,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Cmp>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  bars: { flexDirection: 'row', gap: spacing.xs },
  bar: { flex: 1, height: 3, borderRadius: radii.pill },
  labels: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  labelSlot: { flex: 1 },
  label: { ...typography.badgeSm, color: colors.faint },
  labelDone: { color: colors.muted, textDecorationLine: 'underline' },
});
