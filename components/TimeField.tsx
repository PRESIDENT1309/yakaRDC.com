import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { colors, typography, spacing } from '../lib/theme';
import Sheet from './Sheet';

export interface TimeFieldProps {
  label: string;
  /** Heure au format "HH:MM", ou '' si non renseignée */
  value: string;
  onChange: (time: string) => void;
  accent?: string;
  placeholder?: string;
  /** Pas en minutes entre deux propositions */
  stepMinutes?: number;
  /** Autorise l'effacement — utile quand le champ est facultatif */
  clearable?: boolean;
}

// Créneaux d'une journée complète : une arrivée tardive après un vol de nuit
// est un cas réel, on ne restreint donc pas aux heures « raisonnables ».
function buildSlots(step: number): string[] {
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return slots;
}

// Champ d'heure replié, ouvrant la liste des créneaux dans une feuille.
// Remplace une saisie libre qui n'était ni contrainte ni validée : « 18h »,
// « 6 du soir » ou « vers 20 heures » y étaient acceptés sans que le
// partenaire puisse en tirer quoi que ce soit.
export default function TimeField({
  label, value, onChange, accent = colors.lave,
  placeholder = 'Choisir', stepMinutes = 30, clearable = true,
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const slots = buildSlots(stepMinutes);

  function select(time: string) {
    onChange(time);
    setOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Clock size={15} color={value ? accent : colors.faint} strokeWidth={1.75} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value || placeholder}</Text>
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        subtitle={value || undefined}
        avoidKeyboard={false}
      >
        {clearable && !!value && (
          <Pressable style={styles.clearBtn} onPress={() => { onChange(''); setOpen(false); }}>
            <Text style={styles.clearText}>Ne pas préciser</Text>
          </Pressable>
        )}
        <ScrollView style={styles.list}>
          {slots.map(s => (
            <Pressable key={s} style={styles.option} onPress={() => select(s)}>
              <Text style={[styles.optionText, s === value && { color: accent, fontWeight: '600' }]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { ...typography.caption, color: colors.ink, marginBottom: 5, },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
  },
  value: { ...typography.body, color: colors.ink },
  placeholder: { color: colors.faint },
  clearBtn: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  clearText: { ...typography.sheetOption, color: colors.muted },
  list: { maxHeight: 340 },
  option: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { ...typography.sheetOption, color: colors.ink },
});
