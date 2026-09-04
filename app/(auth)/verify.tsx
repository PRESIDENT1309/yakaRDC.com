import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radii, typography, breakpoints, spacing } from '../../lib/theme';

export default function VerifyScreen() {
  const { method, identifier } = useLocalSearchParams<{ method: 'phone' | 'email'; identifier: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setError(null);
    setLoading(true);

    const { error } =
      method === 'phone'
        ? await supabase.auth.verifyOtp({ phone: identifier, token: code, type: 'sms' })
        : await supabase.auth.verifyOtp({ email: identifier, token: code, type: 'email' });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Entre le code reçu</Text>
        <Text style={styles.subtitle}>Envoyé à {identifier}</Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleVerify} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Vérification...' : 'Confirmer'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, padding: spacing.lg, justifyContent: 'center' },
  // Le champ de code et son bouton n'ont rien à gagner à s'étirer : on les
  // ramène à la largeur des autres formulaires. Sans effet sous 480 px.
  inner: { maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center' },
  title: { ...typography.titleLg, color: colors.ink, marginBottom: spacing.v6, },
  subtitle: { ...typography.bodySm, color: colors.muted, marginBottom: spacing.lg, },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    padding: spacing.v14,
    // Saisie de code : l'espacement de 6 separe visuellement les chiffres.
    // Aucune entree de l'echelle ne porte cet ecart, propre a ce seul champ.
    fontFamily: fonts.sansMedium,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  error: { ...typography.bodyXs, color: colors.lave, marginBottom: spacing.v12, },
  button: { backgroundColor: colors.lave, borderRadius: radii.lg, padding: spacing.md, alignItems: 'center' },
  buttonText: { ...typography.sheetOption, color: colors.white, },
});
