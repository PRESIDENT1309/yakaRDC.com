import { useState } from 'react';
import { View, Text, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { goBack } from '../lib/navigation';
import { Check } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { colors, typography, breakpoints, radii, spacing, cible } from '../lib/theme';
import ScreenHeader from '../components/ScreenHeader';
import FormField from '../components/FormField';
import Button from '../components/Button';

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
          <FormField
            label="Nom complet"
            value={fullName}
            onChange={setFullName}
            placeholder="Votre nom complet"
            autoCapitalize="words"
            autoComplete="name"
          />

          <FormField
            label="Téléphone"
            value={phone}
            onChange={setPhone}
            placeholder="+243 8xx xxx xxx"
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          {/* Pas un champ : une valeur affichée, que rien ne permet de saisir.
              Elle garde le filet discret des séparateurs. */}
          <Text style={styles.fieldLabel}>Email</Text>
          <View style={[styles.fieldInput, styles.fieldInputDisabled]}>
            <Text style={styles.disabledText}>{profile?.email ?? '—'}</Text>
          </View>
          <Text style={styles.hint}>L'adresse email ne peut pas être modifiée ici.</Text>

          {/* Le libellé passe à « Enregistré » sept dixièmes de seconde avant
              le retour : la région annoncée le dit à qui ne le voit pas. */}
          <View style={styles.saveWrap} accessibilityLiveRegion="polite">
            <Button
              label={saved ? 'Enregistré' : 'Enregistrer'}
              icon={saved ? <Check size={16} color={colors.cream} /> : undefined}
              onPress={handleSave}
              loading={saving}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: {
    maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center',
    padding: spacing.v20, paddingTop: spacing.xl,
  },
  // Libellé et boîte de l'email reprennent les mesures de `FormField`, pour
  // que les trois lignes du formulaire s'alignent.
  fieldLabel: { ...typography.caption, color: colors.ink, marginBottom: spacing.xs, },
  fieldInput: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.v12, paddingVertical: spacing.v12,
    minHeight: cible.min, justifyContent: 'center',
  },
  fieldInputDisabled: { backgroundColor: colors.surfaceSunken },
  disabledText: { ...typography.body, color: colors.muted, },
  hint: { ...typography.captionSm, color: colors.faint, marginTop: spacing.xs, },
  saveWrap: { marginTop: 28 },
});