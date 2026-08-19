import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing } from '../lib/theme';
import Button from './Button';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  // Action irréversible (suppression, refus) : le bouton de confirmation
  // passe en `danger` pour que la gravité soit lisible avant le clic.
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Dialogue de confirmation — remplace window.confirm sur le web, où les
// actions destructives passaient par une boîte navigateur : détachée de
// l'app, sans hiérarchie, et cliquée par réflexe. Ici la gravité est portée
// par la couleur et le libellé, pas par un « OK » générique.
//
// Centré, et non en feuille basse comme Sheet/BottomSheet : une confirmation
// interrompt volontairement le geste en cours, elle ne prolonge pas la page.
export default function ConfirmDialog({
  visible, title, message, confirmLabel, cancelLabel, destructive = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* Le contenu absorbe la pression : on ne ferme qu'en touchant le voile */}
        <Pressable style={styles.dialog} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                label={cancelLabel}
                variant="secondary"
                onPress={onCancel}
                color={colors.muted}
                softColor={colors.surfaceSunken}
              />
            </View>
            <View style={styles.action}>
              <Button
                label={confirmLabel}
                onPress={onConfirm}
                color={destructive ? colors.danger : colors.lave}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  dialog: {
    width: '100%', maxWidth: 380,
    backgroundColor: colors.cream, borderRadius: radii.lg, padding: spacing.lg,
  },
  title: { ...typography.sheetTitle, color: colors.ink },
  message: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  action: { flex: 1 },
});
