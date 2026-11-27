import type { ReactNode } from 'react';
import { Modal, View, Text, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, typography, spacing, radii, breakpoints } from '../lib/theme';
import { useZonesSures } from '../lib/zones';
import BoutonIcone from './BoutonIcone';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  // Désactivable pour un futur contenu sans champ texte — activé par défaut
  // car c'est le cas d'usage qui motive Sheet (formulaires de réservation,
  // d'avis…), à la différence de BottomSheet qui n'en a jamais eu besoin.
  avoidKeyboard?: boolean;
}

// Chrome partagé pour toute feuille à contenu libre (formulaire, avis…) —
// overlay, feuille, poignée, en-tête (titre/sous-titre/fermeture), gestion
// clavier. Ne contient AUCUNE logique de champ ni de sélection : ça reste le
// rôle de l'écran appelant. Pour une simple sélection à choix unique dans une
// liste, utiliser BottomSheet, pas Sheet — les deux composants coexistent
// volontairement, Sheet ne remplace pas BottomSheet.
export default function Sheet({ visible, onClose, title, subtitle, children, avoidKeyboard = true }: SheetProps) {
  // Le bas de la feuille suit la barre de geste réelle, au lieu d'un 34 fixe
  // pour iOS et d'un 20 pour tout le reste.
  const { bas } = useZonesSures();

  const content = (
    <View style={[styles.sheet, { paddingBottom: bas }]}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header" aria-level={2}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {/* La croix mesurait 20 px, élargie de 8 par `hitSlop` — que le web
            ignore. BoutonIcone porte la zone à 44 partout. */}
        <BoutonIcone label="Fermer" taille={32} onPress={onClose} icon={<X size={20} color={colors.muted} />} />
      </View>
      {children}
    </View>
  );

  const voile = (
    // Retiré de la lecture vocale et de la tabulation : le bouton Fermer de
    // l'en-tête fait déjà ce travail, inutile de l'annoncer deux fois.
    <Pressable style={styles.overlay} onPress={onClose} accessible={false} focusable={false} aria-hidden importantForAccessibility="no" />
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {voile}
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.flex}>
          {voile}
          {content}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.cream, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.v20, maxHeight: '90%',
    // Sur grand écran, la feuille garde la largeur d'un formulaire au lieu de
    // s'étirer d'un bord à l'autre, titre à gauche et croix à un mètre.
    width: '100%', maxWidth: breakpoints.panelMax, alignSelf: 'center',
  },
  handle: { width: 36, height: 4, backgroundColor: colors.borderStrong, borderRadius: radii.v4, alignSelf: 'center', marginTop: spacing.v12, marginBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  headerText: { flex: 1, marginRight: spacing.v12 },
  title: { ...typography.sheetTitle, color: colors.ink },
  subtitle: { ...typography.caption, color: colors.muted, marginTop: spacing.v2 },
});
