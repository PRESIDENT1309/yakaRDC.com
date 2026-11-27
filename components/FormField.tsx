import type { TextInputProps } from 'react-native';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, cible } from '../lib/theme';

export interface FormFieldProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange' | 'style'> {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Message d'erreur du champ. Présent : contour rouge, et le message est annoncé. */
  error?: string | null;
  /** Aide sous le champ (format attendu, exemple). */
  hint?: string;
  /** Nombre de lignes visibles d'un champ `multiline`. Défaut : 3. */
  lines?: number;
}

/**
 * Champ de formulaire : libellé, saisie, puis aide ou erreur.
 *
 * Source unique. Il existait en trois exemplaires — ici, dans
 * `become-partner.tsx` et dans `pro/establishment.tsx` — identiques à une
 * hauteur de zone de texte près, d'où le réglage `lines`.
 *
 * Toutes les propriétés de `TextInput` passent (`autoComplete`,
 * `secureTextEntry`, `maxLength`…) : un écran n'a plus de raison d'écrire son
 * propre champ pour un attribut qui manquerait.
 *
 * Trois choses que le champ fait pour qui ne voit pas l'écran, ou le voit mal :
 *  - le libellé est relié à la saisie. Posé à côté sans lien, il n'est pas lu
 *    quand le champ reçoit le focus : on entendait « zone de texte », rien de plus ;
 *  - l'erreur est annoncée dès qu'elle apparaît, sans avoir à la chercher ;
 *  - le contour se distingue du fond (`borderField`, 3:1), là où `border`
 *    laissait deviner le champ plus qu'il ne le montrait.
 */
export default function FormField({
  label, value, onChange, error, hint, lines = 3, multiline = false, ...saisie
}: FormFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        numberOfLines={multiline ? lines : 1}
        {...saisie}
        style={[
          styles.input,
          multiline && { minHeight: 22 * lines + 2 * spacing.v12, textAlignVertical: 'top' },
          !!error && styles.inputErreur,
        ]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        accessibilityLabel={saisie.accessibilityLabel ?? label}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <Text style={styles.erreur} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text style={styles.aide}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.v12 },
  label: { ...typography.caption, color: colors.ink, marginBottom: spacing.xs },
  input: {
    ...typography.body, color: colors.ink, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.borderField, borderRadius: radii.md,
    paddingHorizontal: spacing.v12, paddingVertical: spacing.v12, minHeight: cible.min,
  },
  inputErreur: { borderColor: colors.danger },
  erreur: { ...typography.bodyXs, color: colors.danger, marginTop: spacing.xs },
  aide: { ...typography.bodyXs, color: colors.muted, marginTop: spacing.xs },
});
