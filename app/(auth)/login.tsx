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
  ImageBackground,
  StatusBar,
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

  async function handleGoogleLogin() {
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/callback`
        : undefined;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }

  return (
    <ImageBackground
      source={{ uri: 'https://liweghymxnzyaoyheznu.supabase.co/storage/v1/object/public/establishment-photos/login-bg.jpg.jpg' }}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" />

      {/* Overlay très léger sur tout l'écran pour lisibilité du logo */}
      <View style={styles.overlayTop} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo + nom en haut dans le ciel */}
          <View style={styles.logoSection}>
            <View style={styles.logoBadge}>
              <Svg width="36" height="36" viewBox="0 0 120 120">
                <Rect width="120" height="120" rx="22" fill="#712B13" />
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
            <Text style={styles.logoText}>YakaRDC</Text>
            <Text style={styles.logoTagline}>Viens. Découvre. Vis le Congo.</Text>
          </View>

          {/* Carte de connexion */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bienvenue</Text>
            <Text style={styles.cardSubtitle}>Connectez-vous pour continuer</Text>

            {/* Email */}
            <View style={[styles.field, !!error && styles.fieldError]}>
              <Mail color="#888780" size={16} />
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

            {/* Mot de passe */}
            <View style={[styles.field, !!error && styles.fieldError]}>
              <Lock color="#888780" size={16} />
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
                  ? <EyeOff color="#B4B2A9" size={15} />
                  : <Eye color="#B4B2A9" size={15} />}
              </Pressable>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Bouton connexion */}
            <Pressable
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Connexion...' : 'Se connecter'}
              </Text>
            </Pressable>

            {/* Séparateur */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <Pressable style={styles.googleBtn} onPress={handleGoogleLogin}>
              <Svg width="18" height="18" viewBox="0 0 24 24">
                <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </Svg>
              <Text style={styles.googleBtnText}>Continuer avec Google</Text>
            </Pressable>

            {/* Inscription */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Pas encore de compte ? </Text>
              <Pressable hitSlop={8} onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.signupLink}>S'inscrire</Text>
              </Pressable>
            </View>
          </View>

          {/* Devenir partenaire */}
          <Pressable
            style={styles.partnerRow}
            onPress={() => router.push('/become-partner')}
          >
            <Text style={styles.partnerText}>
              Vous gérez un établissement ?{' '}
              <Text style={styles.partnerLink}>Devenir partenaire →</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    zIndex: 2,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 32,
    zIndex: 2,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(113,43,19,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(250,199,117,0.3)',
  },
  logoText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontSize: 32,
    color: '#FAF8F4',
    fontWeight: '400',
    marginBottom: 6,
  },
  logoTagline: {
    fontSize: 12,
    color: 'rgba(250,248,244,0.65)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: '#FAF8F4',
    borderRadius: 24,
    padding: 22,
    zIndex: 2,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#2C2C2A',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#888780',
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
    paddingVertical: 12,
    marginBottom: 10,
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
    marginBottom: 8,
    marginLeft: 2,
  },
  primaryBtn: {
    backgroundColor: '#712B13',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
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
    gap: 10,
    marginBottom: 12,
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
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E3DA',
    borderRadius: 10,
    paddingVertical: 13,
    marginBottom: 16,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C2C2A',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  partnerRow: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(113,43,19,0.85)',
    borderRadius: 12,
    zIndex: 2,
  },
  partnerText: {
    fontSize: 12,
    color: 'rgba(250,248,244,0.85)',
    textAlign: 'center',
    lineHeight: 18,
  },
  partnerLink: {
    color: '#FAC775',
    fontWeight: '500',
  },
});