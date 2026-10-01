import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { ArrowLeft, MailCheck } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { goBack } from '../lib/navigation';
import { colors, typography, radii, spacing, breakpoints } from '../lib/theme';
import Button from '../components/Button';
import ScreenHeader from '../components/ScreenHeader';

/**
 * Demande de réinitialisation.
 *
 * L'écran répond toujours la même chose, que le compte existe ou non. Dire
 * « cette adresse est inconnue » en ferait un moyen commode de savoir qui a
 * un compte — et n'aiderait personne : quelqu'un qui s'est trompé d'adresse
 * ne recevra rien, ce que le message explique.
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    const adresse = email.trim().toLowerCase();
    if (!adresse.includes('@')) {
      setError('Saisissez une adresse email valide.');
      return;
    }

    setSending(true);
    const { data, error: fnError } = await supabase.functions.invoke('request-password-reset', {
      body: { email: adresse },
    });
    setSending(false);

    // Un échec de transport se dit ; un compte inexistant, non.
    //
    // On distingue la panne réseau du service absent : accuser la connexion de
    // l'utilisateur quand c'est le serveur qui manque l'envoie chercher un
    // problème chez lui, et il ne le trouvera jamais.
    if (fnError && !(data as any)?.sent) {
      const introuvable = fnError.name === 'FunctionsFetchError'
        || /not.?found|failed to send a request/i.test(fnError.message ?? '');
      setError(introuvable
        ? "Le service d'envoi est momentanément indisponible. Réessayez dans quelques minutes, ou contactez-nous."
        : "L'envoi n'a pas pu aboutir. Vérifiez votre connexion et réessayez.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={styles.screen}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <MailCheck size={40} color={colors.success} strokeWidth={1.75} />
          </View>
          <Text style={styles.doneTitle}>Vérifiez votre boîte mail</Text>
          <Text style={styles.doneText}>
            Si un compte existe pour <Text style={styles.strong}>{email.trim().toLowerCase()}</Text>,
            un lien de réinitialisation vient d'y être envoyé. Il expire dans une heure.
          </Text>
          <Text style={styles.doneHint}>
            Rien reçu au bout de quelques minutes ? Regardez dans les indésirables,
            et vérifiez l'orthographe de votre adresse.
          </Text>
          <Button label="Retour à la connexion" onPress={() => goBack('/(auth)/login')} color={colors.lave} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.screen}>
        <ScreenHeader title="Mot de passe oublié" variant="plain" backFallback="/(auth)/login" contentMaxWidth={breakpoints.formMax} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.lede}>
            Indiquez l'adresse de votre compte. Nous vous enverrons un lien pour
            choisir un nouveau mot de passe.
          </Text>

          <Text style={styles.label}>Adresse email</Text>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.cd"
              placeholderTextColor={colors.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button
            label="Envoyer le lien"
            onPress={handleSend}
            loading={sending}
            disabled={!email.trim()}
            color={colors.lave}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center', paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  lede: { ...typography.body, color: colors.muted, lineHeight: 21, marginBottom: spacing.lg },
  label: { ...typography.badgeSm, color: colors.faint, marginBottom: spacing.sm },
  field: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.v12,
    marginBottom: spacing.md,
  },
  input: { ...typography.body, color: colors.ink },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },

  doneWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  doneIcon: {
    width: 76, height: 76, borderRadius: radii.pill, backgroundColor: colors.successSoft,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.md,
  },
  doneTitle: { ...typography.displaySm, color: colors.ink, textAlign: 'center' },
  doneText: { ...typography.body, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  strong: { fontWeight: '600', color: colors.ink },
  doneHint: {
    ...typography.caption, color: colors.faint, textAlign: 'center',
    lineHeight: 18, marginBottom: spacing.lg,
  },
});
