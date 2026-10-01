import type { ReactNode } from 'react';
import { Modal, View, Text, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, typography, spacing, radii } from '../lib/theme';

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
  const content = (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} hitSlop={8}>
          <X size={20} color={colors.muted} />
        </Pressable>
      </View>
      {children}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.overlay} onPress={onClose} />
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.flex}>
          <Pressable style={styles.overlay} onPress={onClose} />
          {content}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.md + 4, paddingBottom: Platform.OS === 'ios' ? 34 : 20, maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: colors.borderStrong, borderRadius: radii.v4, alignSelf: 'center', marginTop: spacing.v12, marginBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  headerText: { flex: 1, marginRight: spacing.v12 },
  title: { ...typography.sheetTitle, color: colors.ink },
  subtitle: { ...typography.caption, color: colors.muted, marginTop: spacing.v2 },
});
