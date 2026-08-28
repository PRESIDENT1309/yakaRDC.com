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
import { colors, typography, radii, spacing } from '../lib/theme';
import Button from '../components/Button';

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

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // `must_change_password` est effacé dans le même appel : le laisser à true
    // renverrait l'utilisateur sur cet écran à chaque ouverture, alors qu'il
    // vient précisément de faire ce qu'on lui demandait.
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setSaving(false);

    if (updateError) {
      setError(
        updateError.message.includes('should be different')
          ? "Choisissez un mot de passe différent de l'actuel."
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
        <View style={styles.header}>
          {isForced ? (
            <View style={{ width: 34 }} />
          ) : (
            <Pressable onPress={() => goBack('/(tabs)/profile')} hitSlop={8} style={styles.backBtn}>
              <ArrowLeft size={18} color={colors.ink} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Mot de passe</Text>
          <View style={{ width: 34 }} />
        </View>

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
            <Pressable onPress={() => setVisible(v => !v)} hitSlop={8}>
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter, paddingTop: 52, paddingBottom: spacing.md,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: radii.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white,
  },
  headerTitle: { ...typography.cardTitle, color: colors.ink },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: 4 },
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
