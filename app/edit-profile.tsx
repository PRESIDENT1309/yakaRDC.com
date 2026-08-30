import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { goBack } from '../lib/navigation';
import { ArrowLeft, Check } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { colors, typography, breakpoints } from '../lib/theme';
import ScreenHeader from '../components/ScreenHeader';

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!profile?.id) return;
    setSaving(true);
    await supabase.from('profiles')
      .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
      .eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => goBack('/(tabs)/profile'), 700);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.screen}>
        <ScreenHeader title="Modifier le profil" backFallback="/(tabs)/profile" contentMaxWidth={breakpoints.formMax} />

        <View style={styles.content}>
          <Text style={styles.fieldLabel}>Nom complet</Text>
          <TextInput
            style={styles.fieldInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Votre nom complet"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Téléphone</Text>
          <TextInput
            style={styles.fieldInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="+243 8xx xxx xxx"
            placeholderTextColor={colors.faint}
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>Email</Text>
          <View style={[styles.fieldInput, styles.fieldInputDisabled]}>
            <Text style={styles.disabledText}>{profile?.email ?? '—'}</Text>
          </View>
          <Text style={styles.hint}>L'adresse email ne peut pas être modifiée ici.</Text>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.cream} />
              : saved
              ? <><Check size={16} color={colors.cream} /><Text style={styles.saveBtnText}>Enregistré</Text></>
              : <Text style={styles.saveBtnText}>Enregistrer</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center', padding: 20 },
  fieldLabel: { ...typography.caption, color: colors.ink, marginBottom: 6, marginTop: 14, },
  fieldInput: { ...typography.body, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, },
  fieldInputDisabled: { backgroundColor: colors.surfaceSunken },
  disabledText: { ...typography.body, color: colors.muted, },
  hint: { ...typography.captionSm, color: colors.faint, marginTop: 5, },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.lave, borderRadius: 12, paddingVertical: 15, marginTop: 28,
  },
  saveBtnText: { ...typography.sheetOption, color: colors.cream, },
});