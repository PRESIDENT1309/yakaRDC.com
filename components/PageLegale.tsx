import { View, Text, ScrollView, Linking, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import ScreenHeader from './ScreenHeader';
import { colors, typography, spacing, radii, breakpoints } from '../lib/theme';
import { formatFrench } from '../lib/dates';
import { EDITEUR, DERNIERE_MISE_A_JOUR, type SectionLegale } from '../lib/legal';

/**
 * Largeur d'une colonne de lecture : au-delà, l'œil perd le début de ligne.
 * Elle valait 720, à 20 px de la largeur de panneau que l'échelle nomme déjà.
 */
const LARGEUR_LECTURE = breakpoints.panelMax;

/**
 * Gabarit des pages de texte légal (confidentialité, conditions).
 *
 * Les deux pages ne diffèrent que par leur contenu : un seul gabarit garantit
 * qu'elles se présentent de la même façon, et que les coordonnées de l'éditeur
 * — renseignées une fois dans `lib/legal.ts` — y figurent à l'identique.
 */
export default function PageLegale({
  titre, chapeau, sections, autre,
}: {
  titre: string;
  chapeau: string;
  sections: SectionLegale[];
  /** Renvoi vers l'autre page légale, en pied de page. */
  autre: { libelle: string; href: '/confidentialite' | '/conditions' };
}) {
  const coordonnees = [EDITEUR.raisonSociale, EDITEUR.formeEtNumero, EDITEUR.adresse].filter(Boolean);

  return (
    <View style={styles.ecran}>
      <ScreenHeader title={titre} backFallback="/(tabs)/profile" contentMaxWidth={LARGEUR_LECTURE} />
      <ScrollView contentContainerStyle={styles.contenu}>
        {/* Simple texte, à dessein : le titre de niveau 1 de la page est celui
            de l'en-tête (ScreenHeader). Déclaré ici aussi, il donnait deux
            titres principaux identiques aux moteurs et aux lecteurs d'écran. */}
        <Text style={styles.titre}>{titre}</Text>
        <Text style={styles.date}>Dernière mise à jour : {formatFrench(DERNIERE_MISE_A_JOUR)}</Text>
        <Text style={styles.chapeau}>{chapeau}</Text>

        {sections.map((section, i) => (
          <View key={section.titre} style={styles.section}>
            <Text style={styles.sectionTitre} accessibilityRole="header" aria-level={2}>
              {i + 1}. {section.titre}
            </Text>
            {section.contenu.map((ligne, j) => (
              ligne.startsWith('• ') ? (
                <View key={j} style={styles.puce}>
                  <Text style={styles.puceSigne}>•</Text>
                  <Text style={[styles.paragraphe, { flex: 1 }]}>{ligne.slice(2)}</Text>
                </View>
              ) : (
                <Text key={j} style={styles.paragraphe}>{ligne}</Text>
              )
            ))}
          </View>
        ))}

        <View style={styles.contact}>
          <Text style={styles.sectionTitre} accessibilityRole="header" aria-level={2}>Nous contacter</Text>
          {coordonnees.map((ligne) => (
            <Text key={ligne} style={styles.paragraphe}>{ligne}</Text>
          ))}
          {EDITEUR.email && (
            <Text
              style={[styles.lien, styles.lienCarte]}
              accessibilityRole="link"
              onPress={() => Linking.openURL(`mailto:${EDITEUR.email}`)}
            >
              {EDITEUR.email}
            </Text>
          )}
          {EDITEUR.whatsapp && (
            <Text
              style={[styles.lien, styles.lienCarte]}
              accessibilityRole="link"
              onPress={() => Linking.openURL(`https://wa.me/${EDITEUR.whatsapp}`)}
            >
              Écrire au support sur WhatsApp
            </Text>
          )}
        </View>

        <Link href={autre.href} style={[styles.lien, styles.lienPied]}>{autre.libelle}</Link>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.cream },
  contenu: {
    maxWidth: LARGEUR_LECTURE, width: '100%', alignSelf: 'center',
    padding: spacing.v20, paddingBottom: 60, gap: spacing.md,
  },
  titre: { ...typography.titleLg, color: colors.ink },
  date: { ...typography.captionSm, color: colors.faint, marginTop: -spacing.sm },
  chapeau: { ...typography.body, color: colors.muted },
  section: { gap: spacing.sm },
  sectionTitre: { ...typography.titleSm, color: colors.ink, marginTop: spacing.sm },
  paragraphe: { ...typography.body, color: colors.ink },
  puce: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.xs },
  puceSigne: { ...typography.body, color: colors.lave },
  contact: {
    gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
  },
  lien: { ...typography.body, color: colors.lave, textDecorationLine: 'underline' },
  // Zones tactiles élargies sans déplacer le texte : le retrait est rendu par
  // une marge négative égale. Dans la carte, deux liens se suivent à 29 px
  // d'intervalle — leur zone s'arrête là pour ne pas mordre sur la voisine.
  lienCarte: { paddingVertical: spacing.xs, marginVertical: -spacing.xs },
  // Le renvoi de pied de page est seul : il prend les 44 px entiers (21 + 2 × 12).
  lienPied: { paddingVertical: spacing.v12, marginVertical: -spacing.v12 },
});
