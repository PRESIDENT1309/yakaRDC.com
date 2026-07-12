import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Platform, ImageBackground, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

      {/* Voile très léger — juste assez pour la lisibilité, l'image reste vive */}
      <View style={styles.veil} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Logo — icône + nom, avec ombre portée pour ressortir sur l'image claire */}
        <View style={styles.logoArea}>
          <View style={styles.logoBadge}>
            <Svg width="30" height="30" viewBox="0 0 120 120">
              <Rect width="120" height="120" rx="24" fill="#712B13" />
              <Circle cx="60" cy="48" r="22" fill="#FAC775" />
              <Polygon points="34,80 60,38 86,80" fill="#712B13" />
              <Path d="M28,96 Q60,88 92,96" stroke="#FAC775" strokeWidth="5" fill="none" strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.logoName}>YakaRDC</Text>
          <Text style={styles.logoTagline}>VIENS · DÉCOUVRE · VIS LE CONGO</Text>
        </View>

        {/* Espace central — laisse voir le paysage */}
        <View style={styles.spacer} />

        {/* Formulaire minimaliste, sans carte, directement sur l'image */}
        <View style={styles.form}>
          <Text style={styles.welcome}>Bienvenue</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Adresse email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.cd"
              placeholderTextColor="rgba(255,255,255,0.45)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <View style={styles.underline} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.45)"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <View style={styles.underline} />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Text>
          </Pressable>

          <Pressable style={styles.googleBtn} onPress={handleGoogleLogin}>
            <Svg width="15" height="15" viewBox="0 0 24 24">
              <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </Svg>
            <Text style={styles.googleText}>Continuer avec Google</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Pas de compte ?{' '}
              <Text style={styles.footerLink} onPress={() => router.push('/(auth)/register')}>
                S'inscrire
              </Text>
            </Text>
            <Text style={styles.footerDot}>·</Text>
            <Text
              style={styles.footerLink}
              onPress={() => router.push('/become-partner')}
            >
              Devenir partenaire
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  veil: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,4,1,0.18)',
  },
  logoArea: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 64 : 44,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(113,43,19,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(250,199,117,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  logoName: {
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '400',
    marginBottom: 5,
    ...shadow,
  },
  logoTagline: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 2,
    ...shadow,
  },
  spacer: { flex: 1 },
  form: {
    paddingHorizontal: 34,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 18,
    ...shadow,
  },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 6,
    letterSpacing: 0.5,
    ...shadow,
  },
  input: {
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 4,
    ...shadow,
  },
  underline: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginTop: 6,
  },
  error: {
    fontSize: 12,
    color: '#FFB4A8',
    marginBottom: 10,
    ...shadow,
  },
  primaryBtn: {
    backgroundColor: '#FAC775',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5A2210',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingVertical: 13,
    marginBottom: 20,
  },
  googleText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#2C2C2A',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    ...shadow,
  },
  footerLink: {
    fontSize: 12,
    color: '#FAC775',
    fontWeight: '600',
    ...shadow,
  },
  footerDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
});