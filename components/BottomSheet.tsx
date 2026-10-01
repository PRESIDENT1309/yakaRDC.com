import { Modal, View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, typography, radii, spacing } from '../lib/theme';

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

// Source officielle pour toute feuille de sélection à choix unique —
// remplace FilterModal (Recherche) et la modale de sélection de ville
// (accueil). Styles repris tels quels de la modale de l'accueil (référence
// visuelle protégée) : poignée, titre en Playfair, options en Manrope.
export default function BottomSheet({ visible, title, options, selected, onSelect, onClose }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((opt) => (
              <Pressable key={opt} style={styles.option} onPress={() => { onSelect(opt); onClose(); }}>
                <Text style={[styles.optionText, selected === opt && styles.optionTextActive]}>{opt}</Text>
                {selected === opt && <Check size={16} color={colors.lave} strokeWidth={1.75} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.v20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: { width: 36, height: 4, backgroundColor: colors.borderStrong, borderRadius: radii.v4, alignSelf: 'center', marginBottom: 18 },
  title: { ...typography.sheetTitle, color: colors.ink, marginBottom: spacing.v12 },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.v12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionText: { ...typography.sheetOption, color: colors.ink },
  optionTextActive: { color: colors.lave, fontWeight: '600' },
});
