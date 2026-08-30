import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, typography, breakpoints } from '../../lib/theme';

/**
 * Rend une erreur Supabase lisible.
 *
 * `error.message` n'est pas toujours une phrase : selon la réponse du serveur,
 * il peut arriver vide, ou contenir le corps JSON brut — d'où le « {} » affiché
 * tel quel à l'écran, qui ne dit rien à personne. On assemble donc ce qui est
 * réellement présent (message, statut HTTP, code) et, à défaut, on l'annonce
 * franchement plutôt que d'afficher une coquille vide.
 */
function messageLisible(e: any): string {
  if (!e) return 'erreur inconnue';
  const bouts: string[] = [];

  const m = typeof e.message === 'string' ? e.message.trim() : '';
  if (m && m !== '{}' && m !== '[object Object]') bouts.push(m);
  if (e.status) bouts.push(`HTTP ${e.status}`);
  if (e.code) bouts.push(`code ${e.code}`);
  if (!bouts.length && e.name) bouts.push(String(e.name));

  if (!bouts.length) {
    try {
      const brut = JSON.stringify(e);
      if (brut && brut !== '{}') bouts.push(brut.slice(0, 200));
    } catch { /* objet non sérialisable : on laisse le repli ci-dessous */ }
  }

  return bouts.length ? bouts.join(' · ') : 'le serveur a répondu sans expliquer pourquoi';
}

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [showCfm, setShowCfm]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleRegister() {
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez entrer votre prénom et votre nom.'); return;
    }
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email.'); return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.'); return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.'); return;
    }

    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    // 1. Crée le compte dans Supabase Auth.
    //    Le nom et le téléphone partent en métadonnées : c'est la seule façon
    //    de les transmettre à un déclencheur côté serveur, qui peut créer le
    //    profil sans dépendre d'une session (voir la note ci-dessous).
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName, phone: phone.trim() || null },
      },
    });

    if (authError) {
      // Trace complète, en `log` et non en `error` : en développement, Expo
      // affiche un bandeau rouge plein écran pour tout `console.error`, qui
      // recouvrait précisément le message que cet écran vient de composer.
      console.log('[inscription] échec de signUp', authError);
      setLoading(false);
      setError(
        authError.message === 'User already registered'
          ? 'Un compte existe déjà avec cet email.'
          : messageLisible(authError),
      );
      return;
    }

    // 2. Sans session, l'inscription attend une confirmation par email. Entrer
    //    dans l'application maintenant mènerait à un écran vide : on le dit.
    if (!data.session) {
      setLoading(false);
      setError(
        "Compte créé. Ouvrez l'email de confirmation que nous venons de vous "
        + 'envoyer, puis connectez-vous.',
      );
      return;
    }

    // 3. Profil applicatif.
    //
    //    Cet appel était jusqu'ici lancé sans regarder son résultat. Il échoue
    //    pourtant systématiquement : `profiles` a RLS activée avec des
    //    politiques `select` et `update`, mais AUCUNE politique `insert`. Le
    //    compte d'authentification existait donc sans profil, et l'application,
    //    qui se fie à `profile`, traitait l'utilisateur comme déconnecté — sans
    //    jamais rien afficher.
    //
    //    Tant que la base n'a pas de quoi créer ce profil (déclencheur
    //    `handle_new_user` ou politique d'insertion), on refuse d'entrer dans
    //    l'application en faisant croire que tout s'est bien passé.
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user!.id,
      full_name: fullName,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      role: 'traveler',
    });

    if (profileError) {
      // Un refus ici ne signifie pas forcément qu'il n'y a pas de profil : si la
      // base en crée un elle-même à l'inscription, l'écriture cliente reste
      // refusée (l'absence de politique `insert` vaut aussi pour un upsert qui
      // finirait en update) alors que le profil existe bel et bien. On va donc
      // vérifier, plutôt que d'alarmer à tort.
      const { data: profil } = await supabase
        .from('profiles').select('id').eq('id', data.user!.id).maybeSingle();

      if (!profil) {
        console.log('[inscription] profil non créé', profileError);
        setLoading(false);
        setError(
          "Votre compte d'accès a été créé, mais son profil n'a pas pu être "
          + `enregistré (${messageLisible(profileError)}). Signalez-le au `
          + 'support : sans profil, la connexion restera sans effet.',
        );
        return;
      }
    }

    setLoading(false);
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <Svg width="48" height="48" viewBox="0 0 120 120">
            <Rect width="120" height="120" rx="26" fill={colors.lave} />
            <Circle cx="60" cy="48" r="22" fill={colors.amber} />
            <Polygon points="34,80 60,38 86,80" fill={colors.lave} />
            <Path d="M28,96 Q60,88 92,96" stroke={colors.amber} strokeWidth="5" fill="none" strokeLinecap="round" />
          </Svg>
        </View>

        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>Rejoignez YakaRDC et découvrez le Congo</Text>

        {/* Prénom + Nom */}
        <View style={styles.row}>
          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={styles.label}>Prénom</Text>
            <View style={styles.field}>
              <User size={16} color={colors.faint} />
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
                placeholder="Jean" placeholderTextColor={colors.faint} autoCapitalize="words" />
            </View>
          </View>
          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={styles.label}>Nom</Text>
            <View style={styles.field}>
              <User size={16} color={colors.faint} />
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName}
                placeholder="Mbeki" placeholderTextColor={colors.faint} autoCapitalize="words" />
            </View>
          </View>
        </View>

        {/* Email */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Adresse email</Text>
          <View style={styles.field}>
            <Mail size={16} color={colors.faint} />
            <TextInput style={styles.input} value={email} onChangeText={setEmail}
              placeholder="vous@exemple.com" placeholderTextColor={colors.faint}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </View>
        </View>

        {/* Téléphone */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Téléphone <Text style={styles.optional}>(optionnel)</Text></Text>
          <View style={styles.field}>
            <Phone size={16} color={colors.faint} />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="+243 8xx xxx xxx" placeholderTextColor={colors.faint}
              keyboardType="phone-pad" />
          </View>
        </View>

        {/* Mot de passe */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.field}>
            <Lock size={16} color={colors.faint} />
            <TextInput style={styles.input} value={password} onChangeText={setPassword}
              placeholder="Au moins 6 caractères" placeholderTextColor={colors.faint}
              secureTextEntry={!showPwd} />
            <Pressable accessibilityRole="button" accessibilityLabel={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onPress={() => setShowPwd(v => !v)} hitSlop={8}>
              {showPwd ? <EyeOff size={16} color={colors.faint} /> : <Eye size={16} color={colors.faint} />}
            </Pressable>
          </View>
        </View>

        {/* Confirmation */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <View style={[styles.field, confirm && password !== confirm && styles.fieldError]}>
            <Lock size={16} color={colors.faint} />
            <TextInput style={styles.input} value={confirm} onChangeText={setConfirm}
              placeholder="Même mot de passe" placeholderTextColor={colors.faint}
              secureTextEntry={!showCfm} />
            <Pressable accessibilityRole="button" accessibilityLabel={showCfm ? 'Masquer la confirmation' : 'Afficher la confirmation'} onPress={() => setShowCfm(v => !v)} hitSlop={8}>
              {showCfm ? <EyeOff size={16} color={colors.faint} /> : <Eye size={16} color={colors.faint} />}
            </Pressable>
          </View>
          {confirm.length > 0 && password !== confirm && (
            <Text style={styles.fieldHint}>Les mots de passe ne correspondent pas</Text>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Bouton */}
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.cream} />
            : <Text style={styles.btnText}>Créer mon compte</Text>}
        </Pressable>

        {/* Séparateur */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Lien login */}
        <Pressable style={styles.loginRow} onPress={() => router.replace('/(auth)/login')}>
          <ArrowLeft size={14} color={colors.lave} />
          <Text style={styles.loginText}>Déjà un compte ? <Text style={styles.loginLink}>Se connecter</Text></Text>
        </Pressable>

        {/* Mentions légales */}
        <Text style={styles.legal}>
          En créant un compte, vous acceptez nos{' '}
          <Text style={styles.legalLink}>Conditions d'utilisation</Text>
          {' '}et notre{' '}
          <Text style={styles.legalLink}>Politique de confidentialité</Text>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scroll: {
    flexGrow: 1,
    // Sur grand écran, le formulaire s'étirait sur toute la largeur. Contraint
    // et centré, il retrouve une colonne parcourable ; sous 480 px, sans effet.
    maxWidth: breakpoints.formMax,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 60 : 32,
    paddingBottom: 40,
  },
  logoRow: { alignItems: 'center', marginBottom: 20 },
  title: { ...typography.titleLg, color: colors.ink, textAlign: 'center', marginBottom: 6, },
  subtitle: { ...typography.body, color: colors.muted, textAlign: 'center', marginBottom: 28, },
  row: { flexDirection: 'row', gap: 10 },
  fieldWrap: { marginBottom: 14 },
  label: { ...typography.caption, color: colors.ink, marginBottom: 5, },
  optional: { fontWeight: '400', color: colors.faint },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
  },
  fieldError: { borderColor: colors.danger },
  fieldHint: { ...typography.captionSm, color: colors.danger, marginTop: 4, },
  input: { ...typography.body, flex: 1, color: colors.ink, },
  error: { ...typography.bodyXs, color: colors.danger,
    backgroundColor: colors.dangerSoft, borderRadius: 8,
    padding: 10, marginBottom: 14, textAlign: 'center', },
  btn: {
    backgroundColor: colors.lave, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 18,
  },
  btnText: { ...typography.sheetOption, color: colors.cream, },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.bodyXs, color: colors.faint, },
  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 },
  loginText: { ...typography.bodySm, color: colors.muted, },
  loginLink: { color: colors.lave, fontWeight: '500' },
  legal: { ...typography.captionSm, color: colors.faint, textAlign: 'center', },
  legalLink: { color: colors.lave },
});