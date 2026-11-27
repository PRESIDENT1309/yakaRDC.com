import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Alert } from '../lib/alert';
import { colors, typography, radii, spacing, breakpoints, cible } from '../lib/theme';
import Button from '../components/Button';
import BoutonIcone from '../components/BoutonIcone';
import ScreenHeader from '../components/ScreenHeader';

const MIN_LENGTH = 8;

/**
 * Arrivée depuis le lien reçu par email.
 *
 * Le lien porte un jeton de récupération que Supabase échange contre une
 * session à l'ouverture de la page (`detectSessionInUrl`). Cette session
 * suffit à changer le mot de passe : contrairement à l'écran ordinaire, on ne
 * demande PAS l'actuel — celui qui l'a oublié ne peut évidemment pas le
 * fournir, et le lien reçu sur sa propre boîte fait office de preuve.
 *
 * Trois états, parce qu'ils appellent trois réponses différentes : on attend
 * la session, on a la session, ou le lien est périmé — ce dernier cas devant
 * proposer d'en redemander un plutôt que de laisser l'utilisateur bloqué.
 */
export default function ResetPasswordScreen() {
  const [etat, setEtat] = useState<'attente' | 'pret' | 'invalide'>('attente');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;

    // L'échange du jeton n'est pas instantané : on écoute l'événement plutôt
    // que de conclure trop tôt à un lien invalide.
    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!annule && session?.user) setEtat('pret');
    });

    supabase.auth.getSession().then(({ data }) => {
      if (annule) return;
      if (data.session?.user) setEtat('pret');
    });

    // Au-delà de ce délai, le lien est périmé ou déjà utilisé.
    const minuteur = setTimeout(() => {
      if (!annule) setEtat(e => (e === 'attente' ? 'invalide' : e));
    }, 6000);

    return () => { annule = true; clearTimeout(minuteur); listener.subscription.unsubscribe(); };
  }, []);

  async function handleSave() {
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les deux saisies ne correspondent pas.');
      return;
    }

    setSaving(true);
    // Pas de `current_password` : la session de récupération en tient lieu.
    // `must_change_password` est effacé au passage — quelqu'un qui vient de
    // choisir son mot de passe n'a pas à en changer une seconde fois.
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setSaving(false);

    if (updateError) {
      const m = updateError.message.toLowerCase();
      setError(
        m.includes('should be different')
          ? "Choisissez un mot de passe différent de l'ancien."
        : m.includes('weak') || m.includes('pwned')
          ? 'Ce mot de passe est trop courant. Choisissez-en un moins prévisible.'
        : m.includes('expired') || m.includes('invalid')
          ? 'Ce lien a expiré. Demandez-en un nouveau depuis la page de connexion.'
        : updateError.message,
      );
      return;
    }

    Alert.alert('Mot de passe modifié', 'Vous pouvez maintenant utiliser votre nouveau mot de passe.');
    router.replace('/(tabs)');
  }

  if (etat === 'attente') {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color={colors.lave} />
        <Text style={styles.attente}>Vérification du lien…</Text>
      </View>
    );
  }

  if (etat === 'invalide') {
    return (
      <View style={[styles.screen, styles.centre]}>
        <View style={styles.icone}>
          <AlertCircle size={36} color={colors.danger} strokeWidth={1.75} />
        </View>
        {/* Titre et explication sont annoncés ensemble : l'écran arrive après
            six secondes d'attente, sans que l'utilisateur ait rien fait. */}
        <View style={styles.message} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.titre} accessibilityRole="header" aria-level={1}>Ce lien n'est plus valable</Text>
          <Text style={styles.texte}>
            Un lien de réinitialisation expire au bout d'une heure et ne
            fonctionne qu'une seule fois.
          </Text>
        </View>
        <View style={{ height: spacing.lg }} />
        <Button
          label="Demander un nouveau lien"
          onPress={() => router.replace('/forgot-password')}
          color={colors.lave}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.screen}>
        {/* Sans retour : on arrive ici depuis un email, il n'y a pas d'écran
            précédent. L'en-tête commun apporte la zone sûre réelle — le retrait
            était fixé à 52 px, encoche ou non — et le titre de niveau 1. */}
        <ScreenHeader
          title="Nouveau mot de passe"
          variant="plain"
          showBack={false}
          contentMaxWidth={breakpoints.formMax}
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.notice}>
            <ShieldCheck size={16} color={colors.success} strokeWidth={2} />
            <Text style={styles.noticeText}>
              Lien vérifié. Choisissez votre nouveau mot de passe — il remplacera
              immédiatement l'ancien.
            </Text>
          </View>

          <Text style={styles.label}>Nouveau mot de passe</Text>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={`Au moins ${MIN_LENGTH} caractères`}
              placeholderTextColor={colors.faint}
              accessibilityLabel="Nouveau mot de passe"
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoComplete="new-password"
            />
            <BoutonIcone
              icon={visible
                ? <EyeOff size={16} color={colors.faint} strokeWidth={1.75} />
                : <Eye size={16} color={colors.faint} strokeWidth={1.75} />}
              label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              onPress={() => setVisible(v => !v)}
              taille={16}
            />
          </View>

          <Text style={styles.label}>Confirmer</Text>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Saisissez-le à nouveau"
              placeholderTextColor={colors.faint}
              accessibilityLabel="Confirmer le nouveau mot de passe"
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </View>

          {!!error && (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>
          )}

          <Button
            label="Enregistrer"
            onPress={handleSave}
            loading={saving}
            disabled={!password || !confirm}
            color={colors.lave}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  centre: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  attente: { ...typography.caption, color: colors.muted, marginTop: spacing.md },
  // Icône nue : pas de pastille colorée autour (règle du design system).
  icone: { marginBottom: spacing.md },
  message: { alignItems: 'center', maxWidth: breakpoints.formMax },
  titre: { ...typography.displaySm, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm },
  texte: { ...typography.body, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  content: { maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center', paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.successSoft, borderRadius: radii.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  noticeText: { flex: 1, ...typography.caption, color: colors.success, lineHeight: 18 },
  label: { ...typography.badgeSm, color: colors.faint, marginTop: spacing.sm, marginBottom: spacing.sm },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderField,
    borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.v12,
    minHeight: cible.min,
  },
  input: { flex: 1, ...typography.body, color: colors.ink },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
});
