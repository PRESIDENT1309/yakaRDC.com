import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ChevronDown, Search } from 'lucide-react-native';
import { colors, typography, radii, spacing } from '../lib/theme';
import { searchCountries, findByDial, PINNED_COUNT, DEFAULT_DIAL } from '../lib/countries';
import Sheet from './Sheet';

export interface PhoneFieldProps {
  label: string;
  /** Indicatif au format international, ex. "+243" */
  dial: string;
  onDialChange: (dial: string) => void;
  /** Numéro sans l'indicatif */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

// Téléphone avec sélecteur d'indicatif. Beaucoup de réservations pour Kinshasa
// sont faites depuis la Belgique, la France ou l'Afrique du Sud par des
// proches : un champ qui suppose le +243 les exclut.
//
// Pas de drapeaux (illisibles en petit, et interdits par le design system) :
// le nom du pays et l'indicatif portent l'information.
export default function PhoneField({
  label, dial, onDialChange, value, onChange, placeholder,
}: PhoneFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = searchCountries(query);
  const current = findByDial(dial);

  function choose(nextDial: string) {
    onDialChange(nextDial);
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={styles.dialBtn} onPress={() => setOpen(true)}>
          <Text style={styles.dialText}>{dial || DEFAULT_DIAL}</Text>
          <ChevronDown size={13} color={colors.faint} strokeWidth={1.75} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? '8xx xxx xxx'}
          placeholderTextColor={colors.faint}
          keyboardType="phone-pad"
        />
      </View>

      <Sheet
        visible={open}
        onClose={() => { setOpen(false); setQuery(''); }}
        title="Indicatif du pays"
        subtitle={current ? current.name : undefined}
      >
        <View style={styles.searchRow}>
          <Search size={15} color={colors.faint} strokeWidth={1.75} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un pays ou un indicatif"
            placeholderTextColor={colors.faint}
            autoCorrect={false}
          />
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {results.length === 0 ? (
            <Text style={styles.noResult}>Aucun pays ne correspond à « {query} ».</Text>
          ) : (
            results.map((c, i) => (
              <View key={c.code}>
                {/* Séparateur après les pays épinglés, seulement hors recherche */}
                {!query && i === PINNED_COUNT && <View style={styles.groupSep} />}
                <Pressable style={styles.option} onPress={() => choose(c.dial)}>
                  <Text style={[styles.optionName, c.dial === dial && styles.optionActive]}>{c.name}</Text>
                  <Text style={[styles.optionDial, c.dial === dial && styles.optionActive]}>{c.dial}</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.v12 },
  label: { ...typography.caption, color: colors.ink, marginBottom: 5, },
  row: { flexDirection: 'row', gap: spacing.sm },
  dialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.v10, paddingHorizontal: spacing.v12, paddingVertical: spacing.v10,
  },
  dialText: { ...typography.body, color: colors.ink },
  input: { ...typography.body, flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.v10, paddingHorizontal: spacing.v12, paddingVertical: spacing.v10, color: colors.ink, },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.v12, paddingVertical: spacing.v10, marginBottom: spacing.sm,
  },
  searchInput: { ...typography.body, flex: 1, color: colors.ink },
  list: { maxHeight: 320 },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionName: { ...typography.sheetOption, color: colors.ink, flex: 1 },
  optionDial: { ...typography.sheetOption, color: colors.muted },
  optionActive: { color: colors.lave, fontWeight: '600' },
  groupSep: { height: 1, backgroundColor: colors.borderStrong, marginVertical: spacing.sm },
  noResult: { ...typography.body, color: colors.muted, paddingVertical: spacing.md },
});
