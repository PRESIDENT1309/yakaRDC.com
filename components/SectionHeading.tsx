import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, typography, spacing, fonts, cible } from '../lib/theme';
import { lienVers } from '../lib/liens';

interface Props {
  kicker?: string;
  title: string;
  onSeeAll?: () => void;
  /**
   * Destination de « Voir tout ». À préférer à `onSeeAll` : sur le web,
   * l'entrée devient un vrai lien (voir lib/liens.ts).
   */
  seeAllHref?: string;
  seeAllLabel?: string;
  // Pour une utilisation sur fond sombre/coloré (hero, bande éditoriale).
  light?: boolean;
  align?: 'left' | 'center';
  /**
   * Niveau du titre dans la page. 2 par défaut : le niveau 1 revient au titre
   * de l'écran — à passer quand ce composant EST le titre de l'écran. Une
   * section imbriquée dans une autre passe 3.
   */
  niveau?: 1 | 2 | 3;
}

// Hauteur de la ligne « Voir tout » (texte + retrait bas), d'où le
// débordement à annuler pour que la zone tactile ne décale pas le titre.
const HAUTEUR_VISIBLE = 21;

// Titre éditorial réutilisable — kicker en Manrope + titre en Playfair Display.
// Remplace les titres de section plats (Manrope seul, 13-15px) par la hiérarchie
// serif/sans définie dans la direction "Terre & Fleuve".
//
// Le titre est déclaré comme tel (`header`) : aucun écran n'exposait de titre
// à la lecture vocale ni aux moteurs, qui voyaient une suite de paragraphes.
export default function SectionHeading({
  kicker,
  title,
  onSeeAll,
  seeAllHref,
  seeAllLabel = 'Voir tout',
  light = false,
  align = 'left',
  niveau = 2,
}: Props) {
  const voirTout = seeAllHref ? lienVers(seeAllHref, { avant: onSeeAll }) : onSeeAll ? { onPress: onSeeAll } : null;

  return (
    <View style={[styles.row, align === 'center' && styles.rowCenter]}>
      <View style={{ flex: 1, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
        {kicker ? (
          <Text style={[styles.kicker, light && styles.kickerLight]}>{kicker}</Text>
        ) : null}
        <Text
          accessibilityRole="header"
          aria-level={niveau}
          style={[styles.title, light && styles.titleLight, align === 'center' && styles.titleCenter]}
        >
          {title}
        </Text>
      </View>
      {voirTout ? (
        <Pressable
          style={styles.seeAllZone}
          accessibilityRole={seeAllHref ? 'link' : 'button'}
          // « Voir tout » seul ne dit pas tout de quoi : le titre le précise.
          accessibilityLabel={`${seeAllLabel} : ${title}`}
          {...voirTout}
        >
          <View style={styles.seeAll}>
            <Text style={[styles.seeAllText, light && styles.seeAllTextLight]}>{seeAllLabel}</Text>
            <ChevronRight size={14} color={light ? colors.cream : colors.lave} />
          </View>
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
    marginBottom: spacing.sm,
  },
  kickerLight: { color: colors.onBrandMuted },
  title: { ...typography.displayLg, color: colors.ink },
  titleLight: { color: colors.cream },
  titleCenter: { textAlign: 'center' },
  // Zone tactile de 44 px, dont le surplus remonte au-dessus de la ligne : le
  // lien reste aligné sur le bas du titre, comme avant.
  seeAllZone: { minHeight: cible.min, justifyContent: 'flex-end', marginTop: -(cible.min - HAUTEUR_VISIBLE) },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: spacing.v2, paddingBottom: spacing.xs },
  seeAllText: { ...typography.caption, color: colors.lave, fontFamily: fonts.sansSemiBold },
  seeAllTextLight: { color: colors.cream },
});
