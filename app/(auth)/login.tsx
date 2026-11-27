import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Platform, ImageBackground, StatusBar, KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, fonts, typography, radii, spacing, breakpoints, cible } from '../../lib/theme';
import { useZonesSures } from '../../lib/zones';
import { lienVers } from '../../lib/liens';
import LogoYaka from '../../components/LogoYaka';
import BoutonIcone from '../../components/BoutonIcone';
import PhotoScrim from '../../components/PhotoScrim';
import { messageErreur } from '../../lib/erreurs';
import LandscapeIllustration from '../../components/LandscapeIllustration';

// Destination d'après connexion. N'accepte qu'un chemin interne : doit commencer
// par un seul '/' — ce qui écarte les URL absolues ('https://…') et les URL
// protocol-relative ('//evil.tld'), qui sortiraient de l'app. Tout le reste
// retombe sur l'accueil, comportement historique de cet écran.
function safeRedirect(target?: string): string {
  if (typeof target !== 'string') return '/';
  if (!target.startsWith('/') || target.startsWith('//')) return '/';
  return target;
}

export default function LoginScreen() {
  // Zone sûre réelle : la marque monte en haut de l'écran, donc sous l'encoche,
  // et le formulaire descend jusqu'à la barre de geste.
  const { bas, insets } = useZonesSures();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ redirect?: string; reason?: string }>();
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Un partenaire saisit ici un mot de passe provisoire de 14 caractères reçu
  // par email : à l'aveugle, la faute de frappe est quasi certaine.
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'auth_background_url').maybeSingle()
      .then(({ data }) => setBgUrl(data?.value?.trim() ? data.value : null));
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setError(null);
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    // Toute erreur était jusqu'ici annoncée comme « mot de passe incorrect »,
    // y compris une coupure réseau : l'utilisateur retapait alors un mot de
    // passe juste, voire le réinitialisait, pour rien.
    if (authError) { setError(messageErreur(authError, 'La connexion a échoué. Réessayez dans un instant.')); return; }

    // Un partenaire approuvé se connecte avec un mot de passe reçu par email,
    // qui reste lisible dans sa boîte de réception. Tant qu'il ne l'a pas
    // remplacé, cet email vaut les clés de son établissement : on impose le
    // changement avant tout accès, plutôt que de compter sur sa bonne volonté.
    if (data.user?.user_metadata?.must_change_password) {
      router.replace({ pathname: '/change-password', params: { forced: '1' } });
      return;
    }

    router.replace(safeRedirect(params.redirect) as never);
  }

  async function handleGoogleLogin() {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/callback` : undefined;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (oauthError) setError(messageErreur(oauthError, 'La connexion avec Google a échoué. Réessayez dans un instant.'));
  }

  const content = (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <View style={styles.veil} pointerEvents="none" />

      {/* La marque tient le haut de l'écran, pas le bas. Empilée juste au-dessus
          de « C'est parti, », elle s'ajoutait à un bloc déjà dense — titre,
          sous-titre, deux champs, deux boutons, deux liens — et se lisait comme
          une quatrième ligne de texte plutôt que comme une signature.
          En absolu, elle ne touche pas à la composition du bas ; sa rangée
          reprend la largeur et la gouttière du formulaire, donc les bords
          gauches restent alignés sur grand écran. */}
      <View style={[styles.marque, { paddingTop: Math.max(insets.top, 20) }]} pointerEvents="none">
        <View style={styles.marqueRangee}>
          <LogoYaka size={34} />
          <Text style={styles.logoText}>YakaRDC</Text>
        </View>
      </View>

      <View style={styles.headerZone}>
        <Text style={styles.headline} accessibilityRole="header" aria-level={1}>C'est parti,</Text>
        <Text style={styles.subheadline}>découvrez le Congo autrement.</Text>
      </View>

      {/* Le plancher de 32 garde le retrait d'origine là où il n'y a pas de
          barre de geste (web, Android à boutons). */}
      <View style={[styles.form, { paddingBottom: Math.max(bas, spacing.xl) }]}>
        {/* Motif de la redirection, quand l'utilisateur arrive depuis une
            action nécessitant un compte (favori, réservation, avis…). */}
        {!!params.reason && (
          <View style={styles.reasonNote}>
            <Text style={styles.reasonText}>{params.reason}</Text>
          </View>
        )}

        {/* Le pictogramme tenait dans le texte d'exemple, sous forme d'emoji : la
            lecture vocale le prononçait, et il disparaissait à la première
            lettre saisie. Il est maintenant une icône à part, et le champ porte
            son propre libellé — l'exemple seul s'efface dès qu'on écrit. */}
        <View style={[styles.pill, !!error && styles.pillError]}>
          <Mail size={16} color={colors.faint} strokeWidth={1.75} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Adresse email"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Adresse email"
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={[styles.pill, !!error && styles.pillError]}>
          <Lock size={16} color={colors.faint} strokeWidth={1.75} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Mot de passe"
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <BoutonIcone
            icon={showPassword
              ? <EyeOff size={17} color={colors.faint} strokeWidth={1.75} />
              : <Eye size={17} color={colors.faint} strokeWidth={1.75} />}
            label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            onPress={() => setShowPassword(v => !v)}
            taille={17}
          />
        </View>

        {/* Sous le champ, la ou on se rend compte qu'on l'a oublie. */}
        <Pressable style={styles.forgotRow} accessibilityRole="link" {...lienVers('/forgot-password')}>
          <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
        </Pressable>

        {error && (
          <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>
        )}

        {/* Dessiné ici et non par `Button` : ambre à libellé lave, en pastille.
            `Button` écrit son libellé en crème, illisible sur ambre. */}
        <Pressable
          style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          aria-disabled={loading} aria-busy={loading}
        >
          <Text style={styles.primaryBtnText}>{loading ? 'Connexion…' : 'Se connecter'}</Text>
        </Pressable>

        <Pressable style={styles.googleBtn} onPress={handleGoogleLogin} accessibilityRole="button">
          <Svg width="15" height="15" viewBox="0 0 24 24">
            <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </Svg>
          <Text style={styles.googleText}>Continuer avec Google</Text>
        </Pressable>

        <View style={styles.linksRow}>
          <Pressable style={styles.linkZone} accessibilityRole="link" {...lienVers('/register')}>
            <Text style={styles.linkText}>Créer un compte</Text>
          </Pressable>
          <Text style={styles.dot} aria-hidden>·</Text>
          <Pressable style={styles.linkZone} accessibilityRole="link" {...lienVers('/become-partner')}>
            <Text style={styles.linkText}>Devenir partenaire</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  // Le fond choisi par l'admin dans l'écran Apparence l'emporte ; sans image
  // (ou si elle est introuvable), c'est l'illustration dessinée qui s'affiche,
  // comme sur l'écran Welcome. Jamais de photo de secours.
  if (bgUrl) {
    return (
      <ImageBackground
        source={{ uri: bgUrl }}
        style={styles.screen}
        resizeMode="cover"
        onError={() => setBgUrl(null)}
      >
        {/* La photo est choisie par l'administrateur : rien ne dit qu'elle est
            sombre là où tombe le texte. Le voile de 10 % ne suffisait pas sur
            un ciel clair. Le dégradé s'épaissit vers le bas, où se trouvent
            titre, liens et message d'erreur, et laisse le haut de la photo
            respirer. Plus dense que sur l'accueil (0,65) : ici le texte
            remonte jusqu'à mi-écran, où le dégradé n'a fait que la moitié du
            chemin. L'illustration de repli garde son seul voile : ses teintes,
            elles, sont connues d'avance. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <PhotoScrim from="bottom" intensity={0.8} />
        </View>
        {content}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <LandscapeIllustration width={width} height={height} />
      </View>
      {content}
    </View>
  );
}

// Ombre et voile reprennent `nuit` plutôt qu'un noir pur, à opacité inchangée
// (50 % et 10 %) : aucun jeton ne porte ces deux valeurs.
const shadow = {
  textShadowColor: colors.nuit + '80',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};

// Les liens gardent leur hauteur de ligne à l'écran, mais reçoivent le doigt
// sur 44 px : la marge négative annule le surplus, rien ne se décale.
const DEBORD_LIEN = (cible.min - typography.caption.lineHeight) / 2;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.nuit3 },
  flex: { flex: 1, justifyContent: 'flex-end' },
  veil: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.nuit + '1A',
  },
  // Titre, sous-titre et formulaire partagent la même largeur maximale : sur un
  // écran large, ils formaient jusqu'ici une colonne de 740 px, illisible pour
  // un champ de saisie. Contraints et centrés, ils redeviennent une colonne.
  headerZone: {
    maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
  },
  marque: { position: 'absolute', top: 0, left: 0, right: 0 },
  marqueRangee: {
    maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  // Cream et même ombre portée que le titre : le nom est posé sur une photo,
  // dont la luminosité varie d'un fond à l'autre.
  logoText: { fontFamily: fonts.display, fontSize: 24, color: colors.cream, ...shadow },
  // Playfair, comme partout ailleurs. Ces deux titres tombaient sur `serif` :
  // du Times New Roman sur le web. La fonte étant déjà italique, on retire le
  // `fontStyle`, qui superposait une inclinaison simulée à la vraie.
  headline: {
    fontFamily: fonts.display,
    fontSize: 30, color: colors.cream, ...shadow,
  },
  subheadline: {
    fontFamily: fonts.display,
    fontSize: 16, color: colors.onBrandMuted, marginTop: spacing.xs, ...shadow,
  },
  // Le retrait bas vient de la zone sûre : il est posé à l'appel.
  form: {
    maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.v12,
  },
  // Bloc ajouté pour le motif de redirection.
  reasonNote: {
    backgroundColor: colors.nuit + 'B3', borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.v12,
  },
  reasonText: { ...typography.caption, color: colors.cream, textAlign: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    backgroundColor: colors.white, borderRadius: radii.pill,
    paddingHorizontal: spacing.v20,
  },
  pillError: { borderWidth: 1.5, borderColor: colors.danger },
  // Le retrait vertical est porté par la saisie, non par la pastille : un appui
  // n'importe où dans sa hauteur place le curseur (la saisie ne mesurait que
  // sa ligne de texte).
  input: { ...typography.body, flex: 1, alignSelf: 'stretch', paddingVertical: spacing.v12, color: colors.ink },
  forgotRow: {
    alignSelf: 'flex-end', minHeight: cible.min, justifyContent: 'center',
    marginVertical: spacing.v2 - DEBORD_LIEN,
  },
  forgotText: { ...typography.caption, color: colors.amber, ...shadow, },
  errorText: { ...typography.bodyXs, color: colors.dangerOnDark, textAlign: 'center', ...shadow, },
  primaryBtn: {
    backgroundColor: colors.amber, borderRadius: radii.pill, minHeight: cible.min,
    paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs,
  },
  primaryBtnText: { ...typography.titleSm, color: colors.laveDeep, },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.white + 'F2', borderRadius: radii.pill, paddingVertical: spacing.v12,
    minHeight: cible.min,
  },
  googleText: { ...typography.pillLabel, color: colors.ink, },
  linksRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.xs - DEBORD_LIEN, marginBottom: -DEBORD_LIEN,
  },
  linkZone: { minHeight: cible.min, justifyContent: 'center' },
  linkText: { ...typography.caption, color: colors.cream, ...shadow, },
  dot: { ...typography.bodyXs, color: colors.white + '80', },
});