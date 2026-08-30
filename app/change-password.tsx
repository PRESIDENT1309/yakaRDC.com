import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Alert } from '../lib/alert';
import { goBack } from '../lib/navigation';
import { colors, typography, radii, spacing, breakpoints } from '../lib/theme';
import Button from '../components/Button';
import ScreenHeader from '../components/ScreenHeader';

/** Longueur minimale — alignée sur le réglage par défaut de Supabase Auth. */
const MIN_LENGTH = 8;

/**
 * Changement de mot de passe.
 *
 * Écran obligatoire du parcours partenaire : le mot de passe reçu par email
 * est provisoire et reste lisible dans la boîte de réception. Tant qu'il n'a
 * pas été remplacé, quiconque accède à cet email accède à l'établissement.
 *
 * `forced=1` retire le retour arrière et le dit franchement, plutôt que de
 * laisser croire que l'étape est facultative.
 */
export default function ChangePasswordScreen() {
  const { forced } = useLocalSearchParams<{ forced?: string }>();
  const isForced = forced === '1';

  // Supabase exige le mot de passe actuel sur ce projet — réglage
  // GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD. Sans ce champ,
  // l'appel échoue avec « Current password required when setting new
  // password », un message que l'utilisateur ne peut pas résoudre : il n'a
  // nulle part où le saisir.
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);

    if (!current) {
      setError(isForced
        ? 'Saisissez le mot de passe provisoire reçu par email.'
        : 'Saisissez votre mot de passe actuel.');
      return;
    }
    if (password.length < MIN_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les deux saisies ne correspondent pas.');
      return;
    }

    setSaving(true);
    // `must_change_password` est effacé dans le même appel : le laisser à true
    // renverrait l'utilisateur sur cet écran à chaque ouverture, alors qu'il
    // vient précisément de faire ce qu'on lui demandait.
    const { error: updateError } = await supabase.auth.updateUser({
      current_password: current,
      password,
      data: { must_change_password: false },
    });
    setSaving(false);

    if (updateError) {
      // Les messages de Supabase sont en anglais et parfois obscurs. On
      // traduit ceux qu'un utilisateur peut effectivement corriger, et on
      // laisse les autres tels quels plutôt que d'inventer une explication.
      const m = updateError.message.toLowerCase();
      setError(
        m.includes('should be different')
          ? "Choisissez un mot de passe différent de l'actuel."
        : m.includes('current password')
          ? isForced
            ? "Le mot de passe provisoire est incorrect. Recopiez-le depuis l'email, tirets compris."
            : 'Le mot de passe actuel est incorrect.'
        : m.includes('weak') || m.includes('pwned')
          ? 'Ce mot de passe est trop courant. Choisissez-en un moins prévisible.'
        : updateError.message,
      );
      return;
    }

    Alert.alert('Mot de passe modifié', 'Votre nouveau mot de passe est actif.');
    if (isForced) router.replace('/pro');
    else goBack('/(tabs)/profile');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.screen}>
        <ScreenHeader
            title="Mot de passe"
            variant="plain"
            showBack={!isForced}
            backFallback="/(tabs)/profile"
            contentMaxWidth={breakpoints.formMax}
          />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isForced && (
            <View style={styles.notice}>
              <ShieldCheck size={16} color={colors.warning} strokeWidth={2} />
              <Text style={styles.noticeText}>
                Votre mot de passe actuel vous a été envoyé par email : il est provisoire et
                reste lisible dans votre boîte de réception. Choisissez-en un nouveau pour
                accéder à votre espace, puis supprimez cet email.
              </Text>
            </View>
          )}

          <Text style={styles.label}>
            {isForced ? 'Mot de passe provisoire reçu par email' : 'Mot de passe actuel'}
          </Text>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={current}
              onChangeText={setCurrent}
              placeholder={isForced ? 'Celui de l\'email' : 'Votre mot de passe actuel'}
              placeholderTextColor={colors.faint}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
            />
          </View>

          <Text style={styles.label}>Nouveau mot de passe</Text>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={`Au moins ${MIN_LENGTH} caractères`}
              placeholderTextColor={colors.faint}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoComplete="new-password"
            />
            <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onPress={() => setVisible(v => !v)} hitSlop={8}>
              {visible
                ? <EyeOff size={16} color={colors.faint} strokeWidth={1.75} />
                : <Eye size={16} color={colors.faint} strokeWidth={1.75} />}
            </Pressable>
          </View>

          <Text style={styles.label}>Confirmer</Text>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Saisissez-le à nouveau"
              placeholderTextColor={colors.faint}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button
            label="Enregistrer"
            onPress={handleSave}
            loading={saving}
            disabled={!current || !password || !confirm}
            color={colors.lave}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center', paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: 4 },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.warningSoft, borderRadius: radii.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  noticeText: { flex: 1, ...typography.caption, color: colors.warning, lineHeight: 18 },
  label: { ...typography.badgeSm, color: colors.faint, marginTop: spacing.md, marginBottom: 6 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  input: { flex: 1, ...typography.body, color: colors.ink },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
});
