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

// Utilisateur test créé directement dans Supabase :
// Email    : test@yaka.cd
// Password : Yaka2026!

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

        {/* Séparateur */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Boutons sociaux */}
        <View style={styles.socialGroup}>
          <Pressable style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.8 }]}>
            <Svg width="18" height="18" viewBox="0 0 24 24">
              <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </Svg>
            <Text style={styles.socialBtnText}>Continuer avec Google</Text>
          </Pressable>

          {Platform.OS === 'ios' && (
            <Pressable style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.8 }]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="#2C2C2A">
                <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.32 2.99-2.54 3.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </Svg>
              <Text style={styles.socialBtnText}>Continuer avec Apple</Text>
            </Pressable>
          )}
        </View>

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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E3DA',
  },
  dividerText: {
    fontSize: 12,
    color: '#B4B2A9',
  },
  socialGroup: {
    gap: 8,
    marginBottom: 28,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E3DA',
    borderRadius: 10,
    paddingVertical: 13,
  },
  socialBtnText: {
    fontSize: 14,
    color: '#2C2C2A',
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