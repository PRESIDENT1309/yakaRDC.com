import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../lib/theme';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export default function CategoryPill({ label, active, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active ? styles.active : styles.inactive]}>
      <Text style={[styles.label, active ? styles.activeLabel : styles.inactiveLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill, marginRight: 8 },
  active: { backgroundColor: colors.laveSoft },
  inactive: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  label: { fontSize: 12 },
  activeLabel: { color: colors.lave, fontWeight: '500' },
  inactiveLabel: { color: colors.ink },
});
