import type { KeyboardTypeOptions } from 'react-native';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing } from '../lib/theme';

export interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}

// Champ label + saisie — extrait de app/listing/[id].tsx, où il était
// dupliqué dans son intention (label + TextInput) avec app/pro/establishment.tsx.
// Tailles de police (12/14) et rayon (10) laissés en valeurs littérales :
// aucun jeton typography.*/radii.* exact ne leur correspond (voir audit
// Fiche établissement) — les changer aurait été une normalisation
// mécanique, pas une correspondance sûre.
export default function FormField({ label, value, onChange, placeholder, keyboardType = 'default', multiline = false }: FormFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.faint} keyboardType={keyboardType}
        multiline={multiline} numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.v12 },
  label: { ...typography.caption, color: colors.ink, marginBottom: spacing.xs, },
  input: { ...typography.body, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.v12, paddingVertical: spacing.v12, color: colors.ink, },
  inputMulti: { height: 70, textAlignVertical: 'top' },
});
