import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { colors, typography, radii, spacing, fonts, cible } from '../lib/theme';
import { useZonesSures } from '../lib/zones';
import BoutonIcone from './BoutonIcone';

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
// (accueil). Poignée, titre en Playfair, options en Manrope.
//
// Trois corrections du 27/11/2026 :
//  - appuyer dans la feuille, à côté d'une option, la refermait : toute la
//    surface était le voile. La feuille absorbe désormais l'appui ;
//  - elle n'avait pas de bouton Fermer, contrairement à Sheet. Sans souris ni
//    geste de balayage (clavier, lecteur d'écran), on ne pouvait en sortir
//    qu'en choisissant une option ;
//  - chaque option annonce son état : la coche seule ne se lit pas.
export default function BottomSheet({ visible, title, options, selected, onSelect, onClose }: BottomSheetProps) {
  const { bas } = useZonesSures();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fond}>
        {/* Le voile est un voisin de la feuille, non son parent : un appui dans
            la feuille ne l'atteint pas. Il est retiré de la lecture vocale et
            de l'ordre de tabulation — le bouton Fermer joue ce rôle. */}
        <Pressable style={styles.overlay} onPress={onClose} accessible={false} focusable={false} aria-hidden importantForAccessibility="no" />
        <View style={[styles.sheet, { paddingBottom: bas + spacing.sm }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header" aria-level={2}>{title}</Text>
            <BoutonIcone
              label="Fermer"
              taille={32}
              onPress={onClose}
              icon={<X size={20} color={colors.muted} />}
            />
          </View>
          <ScrollView style={{ maxHeight: 360 }} accessibilityRole="radiogroup" accessibilityLabel={title}>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={styles.option}
                onPress={() => { onSelect(opt); onClose(); }}
                accessibilityRole="radio"
                aria-checked={selected === opt}
              >
                <Text style={[styles.optionText, selected === opt && styles.optionTextActive]}>{opt}</Text>
                {selected === opt && <Check size={16} color={colors.lave} strokeWidth={1.75} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, justifyContent: 'flex-end' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  // Sur un écran large, une feuille d'options étirée d'un bord à l'autre met la
  // coche à un mètre du libellé : elle garde la largeur d'une colonne de lecture.
  sheet: {
    backgroundColor: colors.cream, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg,
    padding: spacing.v20, width: '100%', maxWidth: 560, alignSelf: 'center',
  },
  handle: { width: 36, height: 4, backgroundColor: colors.borderStrong, borderRadius: radii.v4, alignSelf: 'center', marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.v12, marginBottom: spacing.v12 },
  title: { ...typography.sheetTitle, color: colors.ink, flex: 1 },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    minHeight: cible.min, paddingVertical: spacing.v12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionText: { ...typography.sheetOption, color: colors.ink },
  optionTextActive: { color: colors.lave, fontFamily: fonts.sansSemiBold },
});
