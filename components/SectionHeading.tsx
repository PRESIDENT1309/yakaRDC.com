import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, typography, spacing } from '../lib/theme';

interface Props {
  kicker?: string;
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  // Pour une utilisation sur fond sombre/coloré (hero, bande éditoriale).
  light?: boolean;
  align?: 'left' | 'center';
}

// Titre éditorial réutilisable — kicker en Manrope + titre en Playfair Display.
// Remplace les titres de section plats (Manrope seul, 13-15px) par la hiérarchie
// serif/sans définie dans la direction "Terre & Fleuve".
export default function SectionHeading({
  kicker,
  title,
  onSeeAll,
  seeAllLabel = 'Voir tout',
  light = false,
  align = 'left',
}: Props) {
  return (
    <View style={[styles.row, align === 'center' && styles.rowCenter]}>
      <View style={{ flex: 1, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
        {kicker ? (
          <Text style={[styles.kicker, light && styles.kickerLight]}>{kicker}</Text>
        ) : null}
        <Text style={[styles.title, light && styles.titleLight, align === 'center' && styles.titleCenter]}>
          {title}
        </Text>
      </View>
      {onSeeAll ? (
        <Pressable style={styles.seeAll} onPress={onSeeAll} hitSlop={8}>
          <Text style={[styles.seeAllText, light && styles.seeAllTextLight]}>{seeAllLabel}</Text>
          <ChevronRight size={14} color={light ? colors.cream : colors.lave} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.v12 },
  rowCenter: { justifyContent: 'center' },
  kicker: {
    ...typography.overline,
    textTransform: 'uppercase',
    color: colors.fleuveDark,
    marginBottom: spacing.v6,
  },
  kickerLight: { color: 'rgba(250,248,244,0.72)' },
  title: { ...typography.displayLg, color: colors.ink },
  titleLight: { color: colors.cream },
  titleCenter: { textAlign: 'center' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: spacing.v2, paddingBottom: 5 },
  seeAllText: { ...typography.caption, color: colors.lave, fontWeight: '600' },
  seeAllTextLight: { color: colors.cream },
});
