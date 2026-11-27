import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { colors, typography, spacing, radii, cible } from '../lib/theme';
import Button from './Button';
import { formatFrench } from '../lib/dates';
import SelecteurDate from './SelecteurDate';
import Sheet from './Sheet';

export interface DateFieldProps {
  label: string;
  /** Date au format ISO (AAAA-MM-JJ), ou '' si non renseignée */
  value: string;
  onChange: (iso: string) => void;
  /** Titre de la feuille — par défaut, reprend le libellé du champ */
  sheetTitle?: string;
  /** Jours complets : affichés barrés et non sélectionnables */
  fullDays?: Set<string>;
  /** Jours de fermeture de l'établissement — distincts des jours complets */
  closedDays?: Set<string>;
  /** Bloque toute date antérieure à celle-ci (ex. la date d'arrivée) */
  minDate?: string;
  accent?: string;
  placeholder?: string;
}

// Champ de date replié : affiche la date choisie ou « Choisir », et ouvre le
// calendrier dans une feuille par-dessus le formulaire.
//
// Le calendrier était jusqu'ici affiché en permanence, ce qui allongeait
// considérablement le formulaire — et, pour un séjour, obligeait à basculer
// entre deux onglets arrivée/départ partageant un même calendrier. Ici chaque
// champ ouvre le sien, dans son propre contexte.
//
// L'imbrication de feuilles (celle-ci s'ouvre dans le Sheet de réservation)
// est un motif supporté : react-native-web gère une pile de modales, avec
// portail et piège de focus par niveau. Même approche que PhoneField.
export default function DateField({
  label, value, onChange, sheetTitle, fullDays, closedDays, minDate,
  accent = colors.lave, placeholder = 'Choisir',
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  function select(iso: string) {
    // Une date antérieure au minimum est ignorée plutôt que refusée par une
    // alerte : le sélecteur la présente déjà comme non sélectionnable.
    if (minDate && iso <= minDate) return;
    onChange(iso);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value ? formatFrench(value) : 'non renseigné'}`}
      >
        <CalendarDays size={15} color={value ? accent : colors.faint} strokeWidth={1.75} />
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? formatFrench(value) : placeholder}
        </Text>
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={sheetTitle ?? label}
        subtitle={value ? formatFrench(value) : undefined}
        avoidKeyboard={false}
      >
        <SelecteurDate
          value={value}
          onChange={select}
          fullDays={fullDays}
          closedDays={closedDays}
          accent={accent}
          minDate={minDate}
        />

        {/* Un calendrier se refermait au clic sur une case : le choix et la
            validation étaient le même geste. Avec trois colonnes, changer de
            mois n'est pas encore choisir une date — il faut donc un bouton
            pour dire quand on a fini. */}
        <View style={styles.valider}>
          <Button
            label={value ? `Choisir le ${formatFrench(value)}` : 'Choisissez une date'}
            onPress={() => setOpen(false)}
            disabled={!value}
            color={accent}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.v12 },
  label: { ...typography.caption, color: colors.ink, marginBottom: spacing.xs, },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderField,
    borderRadius: radii.md, paddingHorizontal: spacing.v12, paddingVertical: spacing.v12,
    minHeight: cible.min,
  },
  value: { ...typography.body, color: colors.ink },
  placeholder: { color: colors.faint },
  valider: { marginTop: spacing.md },
});
