import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, radii } from '../../lib/theme';

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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, padding: 24, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '500', color: colors.ink, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 24 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.ink,
    marginBottom: 16,
  },
  error: { color: colors.lave, fontSize: 12, marginBottom: 12 },
  button: { backgroundColor: colors.lave, borderRadius: radii.lg, padding: 16, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '500', fontSize: 15 },
});
