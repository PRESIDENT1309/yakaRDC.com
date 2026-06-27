import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [showCfm, setShowCfm]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleRegister() {
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez entrer votre prénom et votre nom.'); return;
    }
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email.'); return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.'); return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.'); return;
    }

    setLoading(true);

    // 1. Crée le compte dans Supabase Auth
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setLoading(false);
      setError(
        authError.message === 'User already registered'
          ? 'Un compte existe déjà avec cet email.'
          : authError.message
      );
      return;
    }

    // 2. Crée le profil dans la table profiles
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        role: 'traveler',
      });
    }

    setLoading(false);
    router.replace('/(tabs)');
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
            <Path d="M28,96 Q60,88 92,96" stroke="#FAC775" strokeWidth="5" fill="none" strokeLinecap="round" />
          </Svg>
        </View>

        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>Rejoignez YakaRDC et découvrez le Congo</Text>

        {/* Prénom + Nom */}
        <View style={styles.row}>
          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={styles.label}>Prénom</Text>
            <View style={styles.field}>
              <User size={16} color={colors.faint} />
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
                placeholder="Jean" placeholderTextColor={colors.faint} autoCapitalize="words" />
            </View>
          </View>
          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={styles.label}>Nom</Text>
            <View style={styles.field}>
              <User size={16} color={colors.faint} />
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName}
                placeholder="Mbeki" placeholderTextColor={colors.faint} autoCapitalize="words" />
            </View>
          </View>
        </View>

        {/* Email */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Adresse email</Text>
          <View style={styles.field}>
            <Mail size={16} color={colors.faint} />
            <TextInput style={styles.input} value={email} onChangeText={setEmail}
              placeholder="vous@exemple.com" placeholderTextColor={colors.faint}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </View>
        </View>

        {/* Téléphone */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Téléphone <Text style={styles.optional}>(optionnel)</Text></Text>
          <View style={styles.field}>
            <Phone size={16} color={colors.faint} />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="+243 8xx xxx xxx" placeholderTextColor={colors.faint}
              keyboardType="phone-pad" />
          </View>
        </View>

        {/* Mot de passe */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.field}>
            <Lock size={16} color={colors.faint} />
            <TextInput style={styles.input} value={password} onChangeText={setPassword}
              placeholder="Au moins 6 caractères" placeholderTextColor={colors.faint}
              secureTextEntry={!showPwd} />
            <Pressable onPress={() => setShowPwd(v => !v)} hitSlop={8}>
              {showPwd ? <EyeOff size={16} color={colors.faint} /> : <Eye size={16} color={colors.faint} />}
            </Pressable>
          </View>
        </View>

        {/* Confirmation */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <View style={[styles.field, confirm && password !== confirm && styles.fieldError]}>
            <Lock size={16} color={colors.faint} />
            <TextInput style={styles.input} value={confirm} onChangeText={setConfirm}
              placeholder="Même mot de passe" placeholderTextColor={colors.faint}
              secureTextEntry={!showCfm} />
            <Pressable onPress={() => setShowCfm(v => !v)} hitSlop={8}>
              {showCfm ? <EyeOff size={16} color={colors.faint} /> : <Eye size={16} color={colors.faint} />}
            </Pressable>
          </View>
          {confirm.length > 0 && password !== confirm && (
            <Text style={styles.fieldHint}>Les mots de passe ne correspondent pas</Text>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Bouton */}
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FAF8F4" />
            : <Text style={styles.btnText}>Créer mon compte</Text>}
        </Pressable>

        {/* Séparateur */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Lien login */}
        <Pressable style={styles.loginRow} onPress={() => router.replace('/(auth)/login')}>
          <ArrowLeft size={14} color={colors.lave} />
          <Text style={styles.loginText}>Déjà un compte ? <Text style={styles.loginLink}>Se connecter</Text></Text>
        </Pressable>

        {/* Mentions légales */}
        <Text style={styles.legal}>
          En créant un compte, vous acceptez nos{' '}
          <Text style={styles.legalLink}>Conditions d'utilisation</Text>
          {' '}et notre{' '}
          <Text style={styles.legalLink}>Politique de confidentialité</Text>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAF9' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 60 : 32,
    paddingBottom: 40,
  },
  logoRow: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '500', color: colors.ink, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 28 },
  row: { flexDirection: 'row', gap: 10 },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '500', color: colors.ink, marginBottom: 5 },
  optional: { fontWeight: '400', color: colors.faint },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
  },
  fieldError: { borderColor: '#C0392B' },
  fieldHint: { fontSize: 11, color: '#C0392B', marginTop: 4 },
  input: { flex: 1, fontSize: 14, color: colors.ink },
  error: {
    fontSize: 12, color: '#C0392B',
    backgroundColor: '#FFF0F0', borderRadius: 8,
    padding: 10, marginBottom: 14, textAlign: 'center',
  },
  btn: {
    backgroundColor: colors.lave, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 18,
  },
  btnText: { fontSize: 15, fontWeight: '500', color: '#FAF8F4' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.faint },
  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 },
  loginText: { fontSize: 13, color: colors.muted },
  loginLink: { color: colors.lave, fontWeight: '500' },
  legal: { fontSize: 11, color: colors.faint, textAlign: 'center', lineHeight: 17 },
  legalLink: { color: colors.lave },
});