import { View, Text, Pressable, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { Compass } from 'lucide-react-native';
import LogoYaka from '../components/LogoYaka';
import { colors, typography, spacing, radii, breakpoints, cible } from '../lib/theme';
import { lienVers } from '../lib/liens';
import { useSeo } from '../lib/seo';

/**
 * Adresse inconnue.
 *
 * Sans ce fichier, Expo Router affiche son propre écran — en anglais
 * (« Unmatched Route »), sans la marque, avec un lien vers un plan du site
 * technique. C'est ce que voyait quiconque suivait un lien périmé.
 *
 * Côté serveur, Vercel sert `404.html` (écrit par scripts/postbuild-web.mjs)
 * avec le vrai statut 404 ; c'est cette page qui s'affiche alors, une fois
 * l'application chargée.
 */
export default function NotFoundScreen() {
  const pathname = usePathname();
  // Jamais indexée : une page d'erreur ne doit pas figurer dans un moteur.
  useSeo({ title: 'Page introuvable', path: pathname, index: false });

  return (
    <View style={styles.ecran}>
      <View style={styles.bloc}>
        <LogoYaka size={44} />
        <Compass size={30} color={colors.faint} strokeWidth={1.5} style={{ marginTop: spacing.lg }} />
        <Text style={styles.titre} accessibilityRole="header" aria-level={1}>Cette page n'existe pas</Text>
        <Text style={styles.texte}>
          L'adresse a peut-être changé, ou le lien que vous avez suivi est incomplet.
        </Text>
        {/* Dessiné ici plutôt qu'avec `Button`, qui ne porte pas d'adresse :
            sur le web, ces deux sorties doivent rester de vrais liens. */}
        <Pressable style={styles.bouton} accessibilityRole="link" {...lienVers('/', { remplacer: true })}>
          <Text style={styles.boutonTexte}>Retour à l'accueil</Text>
        </Pressable>
        <Pressable style={styles.lien} accessibilityRole="link" {...lienVers('/search', { remplacer: true })}>
          <Text style={styles.lienTexte}>Rechercher une adresse</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  bloc: { maxWidth: breakpoints.formMax, width: '100%', alignItems: 'center' },
  titre: { ...typography.titleLg, color: colors.ink, textAlign: 'center', marginTop: spacing.v12 },
  texte: { ...typography.body, color: colors.muted, textAlign: 'center', marginTop: spacing.sm, maxWidth: 320 },
  bouton: {
    marginTop: spacing.lg, backgroundColor: colors.lave, borderRadius: radii.md,
    paddingHorizontal: spacing.v20, paddingVertical: spacing.v12,
    minHeight: cible.min, justifyContent: 'center',
  },
  boutonTexte: { ...typography.button, color: colors.cream },
  // Zone tactile de 44 px ; la marge haute est réduite d'autant, pour que le
  // texte ne descende pas.
  lien: {
    marginTop: spacing.sm, paddingHorizontal: spacing.sm,
    minHeight: cible.min, justifyContent: 'center',
  },
  lienTexte: { ...typography.body, color: colors.lave },
});
