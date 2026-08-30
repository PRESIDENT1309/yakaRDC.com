import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Platform, ImageBackground, StatusBar, KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, fonts, typography, radii, spacing, breakpoints } from '../../lib/theme';
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
      .then(({ data }) => setBgUrl(data?.value ?? null));
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
    if (authError) { setError('Email ou mot de passe incorrect.'); return; }

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
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  const content = (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <View style={styles.veil} pointerEvents="none" />

      <View style={styles.headerZone}>
        <Text style={styles.headline}>C'est parti,</Text>
        <Text style={styles.subheadline}>découvre le Congo autrement.</Text>
      </View>

      <View style={styles.form}>
        {/* Motif de la redirection, quand l'utilisateur arrive depuis une
            action nécessitant un compte (favori, réservation, avis…). */}
        {!!params.reason && (
          <View style={styles.reasonNote}>
            <Text style={styles.reasonText}>{params.reason}</Text>
          </View>
        )}

        <View style={[styles.pill, !!error && styles.pillError]}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="✉  Adresse email"
            placeholderTextColor={colors.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={[styles.pill, styles.pillRow, !!error && styles.pillError]}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={password}
            onChangeText={setPassword}
            placeholder="🔒  Mot de passe"
            placeholderTextColor={colors.faint}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onPress={() => setShowPassword(v => !v)} hitSlop={10}>
            {showPassword
              ? <EyeOff size={17} color={colors.faint} strokeWidth={1.75} />
              : <Eye size={17} color={colors.faint} strokeWidth={1.75} />}
          </Pressable>
        </View>

        {/* Sous le champ, la ou on se rend compte qu'on l'a oublie. */}
        <Pressable style={styles.forgotRow} onPress={() => router.push('/forgot-password')} hitSlop={6}>
          <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
        </Pressable>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
          <Text style={styles.primaryBtnText}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
        </Pressable>

        <Pressable style={styles.googleBtn} onPress={handleGoogleLogin}>
          <Svg width="15" height="15" viewBox="0 0 24 24">
            <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </Svg>
          <Text style={styles.googleText}>Continuer avec Google</Text>
        </Pressable>

        <View style={styles.linksRow}>
          <Text style={styles.linkText} onPress={() => router.push('/(auth)/register')}>Créer un compte</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.linkText} onPress={() => router.push('/become-partner')}>Devenir partenaire</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  if (bgUrl) {
    return (
      <ImageBackground source={{ uri: bgUrl }} style={styles.screen} resizeMode="cover">
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

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.nuit3 },
  flex: { flex: 1, justifyContent: 'flex-end' },
  veil: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  // Titre, sous-titre et formulaire partagent la même largeur maximale : sur un
  // écran large, ils formaient jusqu'ici une colonne de 740 px, illisible pour
  // un champ de saisie. Contraints et centrés, ils redeviennent une colonne.
  headerZone: {
    maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center',
    paddingHorizontal: 32, paddingBottom: 24,
  },
  // Playfair, comme partout ailleurs. Ces deux titres tombaient sur `serif` :
  // du Times New Roman sur le web. La fonte étant déjà italique, on retire le
  // `fontStyle`, qui superposait une inclinaison simulée à la vraie.
  headline: {
    fontFamily: fonts.display,
    fontSize: 30, color: colors.cream, ...shadow,
  },
  subheadline: {
    fontFamily: fonts.display,
    fontSize: 16, color: 'rgba(255,248,236,0.85)', marginTop: 4, ...shadow,
  },
  form: {
    maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center',
    paddingHorizontal: 32, paddingBottom: Platform.OS === 'ios' ? 44 : 32, gap: 12,
  },
  // Bloc ajouté pour le motif de redirection — en jetons, contrairement au
  // reste de cet écran (non encore repris par le design system).
  reasonNote: {
    backgroundColor: colors.nuit + 'B3', borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  reasonText: { ...typography.caption, color: colors.cream, textAlign: 'center' },
  pill: {
    backgroundColor: colors.white, borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pillError: { borderWidth: 1.5, borderColor: colors.danger },
  input: { ...typography.body, color: colors.ink, },
  forgotRow: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotText: { ...typography.caption, color: colors.amber, ...shadow, },
  errorText: { ...typography.bodyXs, color: '#FFB4A8', textAlign: 'center', ...shadow, },
  primaryBtn: {
    backgroundColor: colors.amber, borderRadius: 999,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { ...typography.titleSm, color: colors.laveDeep, },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingVertical: 13,
  },
  googleText: { ...typography.pillLabel, color: colors.ink, },
  linksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 4 },
  linkText: { ...typography.caption, color: 'rgba(255,255,255,0.9)', ...shadow, },
  dot: { ...typography.bodyXs, color: 'rgba(255,255,255,0.5)', },
});