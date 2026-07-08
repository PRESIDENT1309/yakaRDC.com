import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (authError) {
      setError('Email ou mot de passe incorrect.');
      return;
    }
    router.replace('/');
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
            <Rect width="120" height="120" rx="26" fill="#712B13" />
            <Circle cx="60" cy="48" r="22" fill="#FAC775" />
            <Polygon points="34,80 60,38 86,80" fill="#712B13" />
            <Path
              d="M28,96 Q60,88 92,96"
              stroke="#FAC775"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>

        {/* Titre */}
        <Text style={styles.title}>Bienvenue sur YakaRDC</Text>
        <Text style={styles.subtitle}>Connectez-vous pour continuer</Text>

        {/* Champs */}
        <View style={styles.form}>
          <View style={[styles.field, error ? styles.fieldError : null]}>
            <Mail color="#888780" size={17} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Adresse email"
              placeholderTextColor="#B4B2A9"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={[styles.field, error ? styles.fieldError : null]}>
            <Lock color="#888780" size={17} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor="#B4B2A9"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10}>
              {showPassword
                ? <EyeOff color="#B4B2A9" size={16} />
                : <Eye color="#B4B2A9" size={16} />}
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.85 },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? 'Connexion en cours...' : 'Continuer'}
            </Text>
          </Pressable>
        </View>

        {/* Devenir partenaire */}
        <Pressable style={styles.partnerRow} onPress={() => router.push('/become-partner')}>
          <Text style={styles.partnerText}>
            Vous gérez un hôtel, restaurant ou site touristique ?{' '}
            <Text style={styles.partnerLink}>Devenir partenaire →</Text>
          </Text>
        </Pressable>

        {/* Lien inscription */}
        <View style={styles.signupRow}>
          <Text style={styles.signupText}>Pas encore de compte ? </Text>
          <Pressable hitSlop={8} onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.signupLink}>S'inscrire</Text>
          </Pressable>
        </View>

        {/* Mentions légales */}
        <Text style={styles.legal}>
          En continuant, vous acceptez nos{' '}
          <Text style={styles.legalLink}>Conditions d'utilisation</Text>
          {' '}et notre{' '}
          <Text style={styles.legalLink}>Politique de confidentialité</Text>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: '#2C2C2A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#888780',
    textAlign: 'center',
    marginBottom: 28,
  },
  form: {
    gap: 10,
    marginBottom: 20,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E3DA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  fieldError: {
    borderColor: '#C0392B',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#2C2C2A',
  },
  errorText: {
    fontSize: 12,
    color: '#C0392B',
    marginTop: 2,
    marginLeft: 2,
  },
  primaryBtn: {
    backgroundColor: '#712B13',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FAF8F4',
  },
  partnerRow: {
    marginBottom: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FAECE7',
    borderRadius: 10,
  },
  partnerText: {
    fontSize: 12,
    color: '#5F5E5A',
    textAlign: 'center',
    lineHeight: 18,
  },
  partnerLink: {
    color: '#712B13',
    fontWeight: '500',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signupText: {
    fontSize: 13,
    color: '#888780',
  },
  signupLink: {
    fontSize: 13,
    color: '#712B13',
    fontWeight: '500',
  },
  legal: {
    fontSize: 11,
    color: '#B4B2A9',
    textAlign: 'center',
    lineHeight: 17,
  },
  legalLink: {
    color: '#712B13',
  },
});