import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router, Link } from 'expo-router';
import LogoYaka from '../../components/LogoYaka';
import Button from '../../components/Button';
import BoutonIcone from '../../components/BoutonIcone';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, fonts, typography, breakpoints, radii, spacing, cible } from '../../lib/theme';
import { useZonesSures } from '../../lib/zones';
import { lienVers } from '../../lib/liens';
import { messageErreur, detailTechnique } from '../../lib/erreurs';

export default function RegisterScreen() {
  const { haut } = useZonesSures();
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
      setError(messageErreur(authError, "Le compte n'a pas pu être créé. Réessayez dans un instant."));
      return;
    }

    // 2. Sans session, deux situations très différentes se ressemblent.
    //
    //    Quand la confirmation par email est active, Supabase renvoie la MÊME
    //    réponse — pas d'erreur, pas de session — que le compte vienne d'être
    //    créé ou que l'adresse soit déjà inscrite. C'est délibéré : distinguer
    //    les deux permettrait d'énumérer les comptes en testant des adresses.
    //
    //    Le seul signe est `identities` : vide quand rien n'a été créé.
    //
    //    Ce code annonçait « Compte créé » dans les deux cas. Il affirmait donc
    //    une création qu'il n'avait pas vérifiée — et l'utilisateur cherchait
    //    ensuite un compte qui n'existait pas.
    if (!data.session) {
      setLoading(false);
      const rienDeCree = !data.user || (data.user.identities?.length ?? 0) === 0;
      setError(rienDeCree
        ? 'Un compte existe déjà avec cet email. Connectez-vous, ou utilisez '
          + '« Mot de passe oublié » si vous ne vous en souvenez plus.'
        : "Compte créé. Ouvrez l'email de confirmation que nous venons de vous "
          + 'envoyer, puis connectez-vous.');
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
          + `enregistré (${detailTechnique(profileError)}). Signalez-le au `
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
        // Le plancher de 32 garde le retrait d'origine là où il n'y a pas
        // d'encoche (web, Android sans barre d'état translucide).
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(haut, spacing.xl) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <LogoYaka size={48} />
        </View>

        <Text style={styles.title} accessibilityRole="header" aria-level={1}>Créer un compte</Text>
        <Text style={styles.subtitle}>Rejoignez YakaRDC et découvrez le Congo</Text>

        {/* Les champs restent dessinés ici : `FormField` ne sait pas loger une
            icône en tête ni l'œil du mot de passe. Chacun reprend donc son
            libellé visible en `accessibilityLabel`, sans quoi la lecture vocale
            n'annonce que « zone de texte ». */}

        {/* Prénom + Nom */}
        <View style={styles.row}>
          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={styles.label}>Prénom</Text>
            <View style={styles.field}>
              <User size={16} color={colors.faint} />
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
                placeholder="Jean" placeholderTextColor={colors.faint} autoCapitalize="words"
                accessibilityLabel="Prénom" autoComplete="given-name" />
            </View>
          </View>
          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={styles.label}>Nom</Text>
            <View style={styles.field}>
              <User size={16} color={colors.faint} />
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName}
                placeholder="Mbeki" placeholderTextColor={colors.faint} autoCapitalize="words"
                accessibilityLabel="Nom" autoComplete="family-name" />
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
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              accessibilityLabel="Adresse email" autoComplete="email" />
          </View>
        </View>

        {/* Téléphone */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Téléphone <Text style={styles.optional}>(optionnel)</Text></Text>
          <View style={styles.field}>
            <Phone size={16} color={colors.faint} />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="+243 8xx xxx xxx" placeholderTextColor={colors.faint}
              keyboardType="phone-pad"
              accessibilityLabel="Téléphone (optionnel)" autoComplete="tel" />
          </View>
        </View>

        {/* Mot de passe */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.field}>
            <Lock size={16} color={colors.faint} />
            <TextInput style={styles.input} value={password} onChangeText={setPassword}
              placeholder="Au moins 6 caractères" placeholderTextColor={colors.faint}
              secureTextEntry={!showPwd}
              accessibilityLabel="Mot de passe" autoComplete="new-password" />
            <BoutonIcone
              icon={showPwd ? <EyeOff size={16} color={colors.faint} /> : <Eye size={16} color={colors.faint} />}
              label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              onPress={() => setShowPwd(v => !v)}
              taille={16}
            />
          </View>
        </View>

        {/* Confirmation */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <View style={[styles.field, confirm && password !== confirm && styles.fieldError]}>
            <Lock size={16} color={colors.faint} />
            <TextInput style={styles.input} value={confirm} onChangeText={setConfirm}
              placeholder="Même mot de passe" placeholderTextColor={colors.faint}
              secureTextEntry={!showCfm}
              accessibilityLabel="Confirmer le mot de passe" autoComplete="new-password"
              aria-invalid={confirm.length > 0 && password !== confirm ? true : undefined} />
            <BoutonIcone
              icon={showCfm ? <EyeOff size={16} color={colors.faint} /> : <Eye size={16} color={colors.faint} />}
              label={showCfm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
              onPress={() => setShowCfm(v => !v)}
              taille={16}
            />
          </View>
          {confirm.length > 0 && password !== confirm && (
            <Text style={styles.fieldHint} accessibilityRole="alert" accessibilityLiveRegion="polite">
              Les mots de passe ne correspondent pas
            </Text>
          )}
        </View>

        {error && (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>
        )}

        {/* Bouton */}
        <View style={styles.btnWrap}>
          <Button label="Créer mon compte" onPress={handleRegister} loading={loading} />
        </View>

        {/* Séparateur */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Lien login */}
        <Pressable
          style={styles.loginRow}
          accessibilityRole="link"
          {...lienVers('/login', { remplacer: true })}
        >
          <ArrowLeft size={14} color={colors.lave} />
          <Text style={styles.loginText}>Déjà un compte ? <Text style={styles.loginLink}>Se connecter</Text></Text>
        </Pressable>

        {/* Mentions légales */}
        <Text style={styles.legal}>
          En créant un compte, vous acceptez nos{' '}
          <Link href="/conditions" style={styles.legalLink}>Conditions d'utilisation</Link>
          {' '}et notre{' '}
          <Link href="/confidentialite" style={styles.legalLink}>Politique de confidentialité</Link>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const DEBORD_LIEN = (cible.min - typography.bodySm.lineHeight) / 2;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scroll: {
    flexGrow: 1,
    // Sur grand écran, le formulaire s'étirait sur toute la largeur. Contraint
    // et centré, il retrouve une colonne parcourable ; sous 480 px, sans effet.
    maxWidth: breakpoints.formMax,
    width: '100%',
    alignSelf: 'center',
    // Le retrait haut vient de la zone sûre : il est posé à l'appel.
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  logoRow: { alignItems: 'center', marginBottom: spacing.v20 },
  title: { ...typography.titleLg, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm, },
  subtitle: { ...typography.body, color: colors.muted, textAlign: 'center', marginBottom: 28, },
  row: { flexDirection: 'row', gap: spacing.v12 },
  fieldWrap: { marginBottom: spacing.v12 },
  label: { ...typography.caption, color: colors.ink, marginBottom: spacing.xs, },
  optional: { fontFamily: fonts.sans, color: colors.faint },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderField,
    borderRadius: radii.md, paddingHorizontal: spacing.v12, paddingVertical: spacing.v12,
    minHeight: cible.min,
  },
  fieldError: { borderColor: colors.danger },
  fieldHint: { ...typography.captionSm, color: colors.danger, marginTop: spacing.xs, },
  // `minWidth: 0` : sur le web, une saisie a une largeur plancher d'une
  // vingtaine de caractères. Dans les champs demi-largeur (Prénom, Nom), elle
  // ne rétrécissait pas et c'est l'icône voisine qui s'écrasait.
  input: { ...typography.body, flex: 1, minWidth: 0, color: colors.ink, },
  error: { ...typography.bodyXs, color: colors.danger,
    backgroundColor: colors.dangerSoft, borderRadius: radii.sm,
    padding: spacing.v12, marginBottom: spacing.v12, textAlign: 'center', },
  btnWrap: { marginBottom: spacing.v20 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12, marginBottom: spacing.v20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.bodyXs, color: colors.faint, },
  // Zone tactile de 44 px autour d'une ligne de 19 : la marge négative annule
  // le surplus, le lien reste à sa place.
  loginRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    minHeight: cible.min, marginTop: -DEBORD_LIEN, marginBottom: spacing.v20 - DEBORD_LIEN,
  },
  loginText: { ...typography.bodySm, color: colors.muted, },
  loginLink: { color: colors.lave, fontFamily: fonts.sansMedium },
  legal: { ...typography.captionSm, color: colors.faint, textAlign: 'center', },
  legalLink: { color: colors.lave },
});