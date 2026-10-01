import type { ReactNode } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { colors, typography, radii, spacing } from '../lib/theme';

export interface ChipProps {
  label: string;
  onPress: () => void;
  active?: boolean;
  icon?: ReactNode;
  // 'selectable' : choix simple (catégorie, commune sur l'accueil) — actif
  // plein (fond lave, texte crème). 'filter' : déclencheur de bottom-sheet
  // (commune/prix/note en recherche) — actif doux (fond laveSoft, texte
  // lave) + chevron, parce que ce n'est pas un choix final mais un état
  // "une valeur est réglée ici".
  variant?: 'selectable' | 'filter';
}

// Source officielle pour toute pastille sélectionnable de l'app — remplace
// les variantes locales (catPill/filterPill de Recherche, cityChip de
// l'accueil et du formulaire partenaire, communeChip de l'édition
// d'établissement, dayChip/tabPill du Planner). Cette dernière liste n'est
// pas migrée dans cette passe — seules Recherche et l'accueil le sont ici.
export default function Chip({ label, onPress, active = false, icon, variant = 'selectable' }: ChipProps) {
  const isFilter = variant === 'filter';
  return (
    <Pressable
      style={[
        styles.base,
        isFilter ? styles.filterPad : styles.selectablePad,
        active && (isFilter ? styles.filterActive : styles.selectableActive),
      ]}
      onPress={onPress}
    >
      {icon}
      <Text
        style={[
          styles.label,
          isFilter && styles.labelFilter,
          active && (isFilter ? styles.labelFilterActive : styles.labelSelectableActive),
        ]}
      >
        {label}
      </Text>
      {isFilter && <ChevronDown size={12} color={active ? colors.lave : colors.faint} strokeWidth={1.75} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radii.pill, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border,
  },
  selectablePad: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  filterPad: { paddingHorizontal: spacing.v12, paddingVertical: spacing.sm, gap: spacing.xs },
  label: { ...typography.pillLabel, color: colors.ink },
  labelFilter: { ...typography.bodyXs, },
  selectableActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  labelSelectableActive: { color: colors.cream },
  filterActive: { backgroundColor: colors.laveSoft, borderColor: colors.lave },
  labelFilterActive: { color: colors.lave },
});
