import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Platform, ImageBackground, StatusBar, KeyboardAvoidingView,
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
    if (authError) { setError('Email ou mot de passe incorrect.'); return; }
    router.replace('/');
  }

  async function handleGoogleLogin() {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/callback` : undefined;
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  return (
    <ImageBackground
      source={{ uri: 'https://liweghymxnzyaoyheznu.supabase.co/storage/v1/object/public/establishment-photos/pkk_LE_upscale_prime.jpg' }}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" />

      {/* Dégradé bas de l'image pour lisibilité */}
      <View style={styles.gradient} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Logo flottant dans le paysage */}
        <View style={styles.logoArea}>
          <View style={styles.logoBadge}>
            <Svg width="28" height="28" viewBox="0 0 120 120">
              <Rect width="120" height="120" rx="22" fill="#712B13" />
              <Circle cx="60" cy="48" r="22" fill="#FAC775" />
              <Polygon points="34,80 60,38 86,80" fill="#712B13" />
              <Path d="M28,96 Q60,88 92,96" stroke="#FAC775" strokeWidth="5" fill="none" strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.logoName}>YakaRDC</Text>
          <Text style={styles.logoTagline}>VIENS · DÉCOUVRE · VIS LE CONGO</Text>
        </View>

        {/* Carte compacte fixée en bas */}
        <View style={styles.card}>
          <Text style={styles.title}>Bienvenue</Text>

          {/* Email */}
          <View style={[styles.field, !!error && styles.fieldError]}>
            <Mail color="#9A9892" size={15} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Adresse email"
              placeholderTextColor="#C4C2BA"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Mot de passe */}
          <View style={[styles.field, !!error && styles.fieldError]}>
            <Lock color="#9A9892" size={15} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor="#C4C2BA"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10}>
              {showPassword
                ? <EyeOff color="#C4C2BA" size={14} />
                : <Eye color="#C4C2BA" size={14} />}
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {/* Bouton connexion */}
          <Pressable
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
          </Pressable>

          {/* Séparateur + Google */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.googleBtn} onPress={handleGoogleLogin}>
            <Svg width="16" height="16" viewBox="0 0 24 24">
              <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </Svg>
            <Text style={styles.googleText}>Continuer avec Google</Text>
          </Pressable>

          {/* Inscription + Partenaire */}
          <View style={styles.bottom}>
            <Text style={styles.signupText}>
              Pas de compte ?{' '}
              <Text style={styles.signupLink} onPress={() => router.push('/(auth)/register')}>
                S'inscrire
              </Text>
            </Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.signupText}>
              <Text style={styles.signupLink} onPress={() => router.push('/become-partner')}>
                Devenir partenaire
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1, justifyContent: 'flex-end' },
  gradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '55%',
    backgroundColor: 'rgba(5,2,1,0.55)',
  },
  logoArea: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(113,43,19,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(250,199,117,0.25)',
  },
  logoName: {
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 26,
    color: '#FAF8F4',
    fontWeight: '400',
    marginBottom: 4,
  },
  logoTagline: {
    fontSize: 9,
    color: 'rgba(250,248,244,0.55)',
    letterSpacing: 2,
  },
  card: {
    backgroundColor: '#FAF8F4',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: '#2C2C2A',
    marginBottom: 12,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E6DC',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  fieldError: { borderColor: '#C0392B' },
  input: { flex: 1, fontSize: 14, color: '#2C2C2A' },
  error: { fontSize: 11, color: '#C0392B', marginBottom: 6, marginLeft: 2 },
  btn: {
    backgroundColor: '#712B13',
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnText: { fontSize: 14, fontWeight: '500', color: '#FAF8F4' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E8E6DC' },
  dividerText: { fontSize: 11, color: '#C4C2BA' },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E6DC',
    borderRadius: 9,
    paddingVertical: 10,
    marginBottom: 14,
  },
  googleText: { fontSize: 13, fontWeight: '500', color: '#2C2C2A' },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  signupText: { fontSize: 12, color: '#888780' },
  signupLink: { color: '#712B13', fontWeight: '500' },
  dot: { fontSize: 12, color: '#C4C2BA' },
});