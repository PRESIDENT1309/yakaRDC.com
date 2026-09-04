import type { ReactNode } from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { colors, typography, radii, spacing } from '../lib/theme';
import { useAppuiAnime } from '../lib/motion';

const PressableAnime = Animated.createAnimatedComponent(Pressable);

export interface ButtonProps {
  label: string;
  onPress: () => void;
  // 'primary' : action principale, fond plein. 'secondary' : action de
  // second rang, contour + fond doux (ex. « Ajouter à mon planning »).
  variant?: 'primary' | 'secondary';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  // Teinte d'accent — la fiche établissement colore ses actions selon la
  // catégorie (lave, fleuveDark, or, foret). Défaut : lave.
  color?: string;
  // Fond doux du variant secondary. Défaut : laveSoft. À passer quand `color`
  // est surchargé, sinon le contour et le fond ne sont pas de la même famille.
  softColor?: string;
}

// Source officielle pour les boutons d'action. Remplace submitBtn / bookBtn /
// planBtn / createBtn / saveBtn / actionBtn / primaryBtn, redéfinis à
// l'identique dans 9 écrans.
//
// Choix typographique — `buttonStrong` (Manrope 700) est attribué au variant
// primary, `button` (Manrope 600) au secondary. Les deux graisses étaient
// chargées et inutilisées ; cette répartition leur donne un rôle : l'action
// principale d'un écran doit dominer son alternative. Fait jurisprudence.
export default function Button({
  label, onPress, variant = 'primary', icon, loading = false, disabled = false,
  color = colors.lave, softColor = colors.laveSoft,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;
  // Le retour à l'appui vit ici plutôt que dans chaque écran : c'est le
  // composant que traversent toutes les actions principales de l'application.
  // Un bouton désactivé ne reçoit pas les gestes, donc il ne bouge pas — ce
  // qui est le bon comportement, et qu'on obtient sans condition à écrire.
  const appui = useAppuiAnime();

  return (
    <PressableAnime
      style={[
        styles.base,
        isPrimary
          ? { backgroundColor: color }
          : { backgroundColor: softColor, borderWidth: 1.5, borderColor: color },
        inactive && styles.inactive,
        appui.style,
      ]}
      onPress={onPress}
      disabled={inactive}
      {...appui.gestes}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? colors.cream : color} />
      ) : (
        <>
          {icon}
          <Text style={[isPrimary ? styles.labelPrimary : styles.labelSecondary, !isPrimary && { color }]}>
            {label}
          </Text>
        </>
      )}
    </PressableAnime>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderRadius: radii.md, paddingVertical: 14, paddingHorizontal: spacing.lg,
  },
  inactive: { opacity: 0.5 },
  labelPrimary: { ...typography.buttonStrong, color: colors.cream },
  labelSecondary: { ...typography.button },
});
