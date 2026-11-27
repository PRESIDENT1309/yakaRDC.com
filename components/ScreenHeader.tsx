import { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { goBack } from '../lib/navigation';
import { colors, radii, spacing, typography } from '../lib/theme';

/**
 * En-tête d'écran : flèche retour, titre, action facultative à droite.
 *
 * Onze écrans écrivaient ce motif à la main, en six variantes de style. Trois
 * défauts revenaient partout :
 *
 *  1. Le titre n'était pas vraiment centré. Il l'était par un `<View
 *     style={{ width: 18 }} />` vide qui compensait la largeur de la flèche.
 *     Le centrage tenait tant que les deux se correspondaient — il cassait dès
 *     qu'un sous-titre ou une action s'ajoutait (voir pro-reviews). Ici, les
 *     deux colonnes latérales ont la MÊME largeur fixe : le centre est
 *     géométrique, quel que soit le contenu.
 *
 *  2. Aucun `numberOfLines`. Un titre long passait à la ligne et faisait
 *     grandir l'en-tête, décalant tout l'écran.
 *
 *  3. Le retrait haut était codé en dur (`Platform.OS === 'ios' ? 56 : 24`),
 *     ce qui ignore les encoches Android. On lit maintenant la zone sûre réelle.
 *     Le plancher conserve l'aspect actuel sur iOS (≈56) et sur le web (24).
 *
 *  4. La flèche ne faisait que 18 px de côté. Elle occupe désormais toute la
 *     colonne latérale, ce qui porte sa zone tactile à 44 px.
 */

// Largeur des deux colonnes latérales. Égales par construction : c'est ce qui
// garantit que le titre tombe au centre optique de l'écran.
const COTE = 44;

// Cream à 70 % — sous-titre posé sur le bandeau de marque. Repris tel quel des
// écrans d'origine plutôt que promu en jeton : il ne sert qu'ici.
const CREAM_ATTENUE = colors.onBrandMuted;

type Props = {
  /**
   * Titre centré. Facultatif seulement parce que `center` peut le remplacer :
   * un en-tête sans l'un ni l'autre n'a pas de sens.
   */
  title?: string;
  subtitle?: string;
  /**
   * Contenu libre au centre, à la place du titre. Sert au seul écran qui
   * affiche la marque plutôt qu'un intitulé (« Devenir partenaire »).
   *
   * Il occupe la même colonne centrale que le titre, donc il hérite du même
   * centrage géométrique : c'est tout l'intérêt de passer par ici plutôt que
   * de réécrire un en-tête à la main, comme c'était le cas.
   */
  center?: ReactNode;
  /**
   * Filet de séparation sous l'en-tête. Utile quand le contenu qui suit défile
   * sur le même fond et que rien d'autre ne marque la limite.
   */
  bordered?: boolean;
  /**
   * `brand` — bandeau lave, texte cream. Écrans internes au parcours.
   * `plain` — fond transparent, texte encre, flèche en pastille blanche.
   *           Écrans de formulaire posés sur cream.
   */
  variant?: 'brand' | 'plain';
  /** Route de repli si l'historique est vide (voir lib/navigation). */
  backFallback?: string;
  /** Passer `false` pour un écran sans retour possible (mot de passe forcé). */
  showBack?: boolean;
  /** Action facultative à droite : elle occupe la colonne symétrique. */
  right?: ReactNode;
  /**
   * Largeur maximale du contenu de l'en-tête sur grand écran.
   *
   * Le fond, lui, reste en pleine largeur : c'est ce qui distingue un bandeau
   * d'un simple bloc. Sans ce réglage, sur un écran large, la flèche se
   * retrouverait collée au bord pendant que le formulaire, centré, flotterait
   * au milieu — les deux ne se répondraient plus. Passer la même valeur ici et
   * au corps de l'écran les réaligne.
   */
  contentMaxWidth?: number;
};

export default function ScreenHeader({
  title,
  subtitle,
  center,
  bordered = false,
  variant = 'brand',
  backFallback = '/(tabs)',
  showBack = true,
  right,
  contentMaxWidth,
}: Props) {
  const insets = useSafeAreaInsets();
  const marque = variant === 'brand';

  // Sur le web, `insets.top` vaut 0 : le plancher de 16 redonne les 24 px
  // d'origine. Sur iOS, l'encoche mesure ≈47, ce qui redonne ≈55. Sur Android
  // encoché, on obtient enfin la vraie valeur au lieu d'un 24 fixe.
  const hautPlancher = Platform.OS === 'web' ? 16 : 24;
  const paddingTop = Math.max(insets.top, hautPlancher) + spacing.sm;

  return (
    // Le fond occupe toute la largeur ; seule la rangée est contrainte.
    <View
      style={[
        marque ? styles.headerMarque : styles.headerClair,
        { paddingTop, paddingBottom: spacing.md },
        bordered ? styles.filet : null,
      ]}
    >
      <View
        style={[
          styles.rangee,
          contentMaxWidth
            ? { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
            : null,
        ]}
      >
        <View style={styles.cote}>
          {showBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour"
              onPress={() => goBack(backFallback)}
              style={styles.retour}
            >
              {/* La zone tactile fait 44 ; le cercle visible en fait 34. Les
                  deux sont dissociés pour ne pas grossir le dessin en
                  agrandissant la cible. */}
              <View style={marque ? styles.pastilleMarque : styles.pastilleClaire}>
                <ArrowLeft size={18} color={marque ? colors.cream : colors.ink} />
              </View>
            </Pressable>
          )}
        </View>

        <View style={styles.centre}>
          {center ?? (
            <>
              {/* Titre de l'écran : niveau 1, pour que la lecture vocale et les
                  moteurs de recherche trouvent la structure de la page. */}
              <Text
                numberOfLines={1}
                accessibilityRole="header"
                aria-level={1}
                style={[styles.titre, { color: marque ? colors.cream : colors.ink }]}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={styles.sousTitre}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={[styles.cote, styles.coteDroite]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
  },
  headerMarque: { backgroundColor: colors.lave },
  headerClair: { backgroundColor: 'transparent' },
  filet: { borderBottomWidth: 1, borderBottomColor: colors.border },

  // Les deux colonnes partagent la même largeur : le centre est géométrique.
  cote: { width: COTE, alignItems: 'flex-start', justifyContent: 'center' },
  coteDroite: { alignItems: 'flex-end' },

  centre: { flex: 1, alignItems: 'center' },
  titre: { ...typography.titleSm, textAlign: 'center' },
  sousTitre: {
    ...typography.captionSm,
    color: CREAM_ATTENUE,
    marginTop: spacing.v2,
    textAlign: 'center',
  },

  // La flèche remplit sa colonne : 44 px de zone tactile au lieu de 18.
  retour: {
    width: COTE,
    height: COTE,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // Variante marque : pas de pastille, la flèche seule sur le bandeau lave.
  pastilleMarque: { alignItems: 'flex-start', justifyContent: 'center' },
  // Variante claire : pastille blanche de 34, alignée sur la gouttière.
  pastilleClaire: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
