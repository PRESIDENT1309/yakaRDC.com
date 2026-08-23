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
import { colors } from '../lib/theme';

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
        <View style={styles.header}>
          <Pressable onPress={() => goBack('/(tabs)/profile')} hitSlop={8}>
            <ArrowLeft size={18} color="#FAF8F4" />
          </Pressable>
          <Text style={styles.headerTitle}>Modifier le profil</Text>
          <View style={{ width: 18 }} />
        </View>

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
              ? <ActivityIndicator color="#FAF8F4" />
              : saved
              ? <><Check size={16} color="#FAF8F4" /><Text style={styles.saveBtnText}>Enregistré</Text></>
              : <Text style={styles.saveBtnText}>Enregistrer</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.lave,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16, paddingHorizontal: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '500', color: '#FAF8F4' },
  content: { padding: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.ink, marginBottom: 6, marginTop: 14 },
  fieldInput: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.ink,
  },
  fieldInputDisabled: { backgroundColor: '#F5F4F0' },
  disabledText: { fontSize: 14, color: colors.muted },
  hint: { fontSize: 11, color: colors.faint, marginTop: 5 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.lave, borderRadius: 12, paddingVertical: 15, marginTop: 28,
  },
  saveBtnText: { fontSize: 15, fontWeight: '500', color: '#FAF8F4' },
});