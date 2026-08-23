import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing } from '../lib/theme';
import { formatMenuPrice } from '../lib/menu';
import type { Menu } from '../lib/menu';
import Sheet from './Sheet';

export interface MenuSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  menu: Menu;
  /** Photos de la carte — cohabitent avec les plats écrits */
  photoUrls: string[];
  onOpenPhoto?: (index: number) => void;
  accent?: string;
}

/**
 * La carte d'un établissement, en entier.
 *
 * Les deux modes de publication cohabitent volontairement : un restaurant
 * peut saisir ses plats et photographier sa carte des vins. Afficher l'un OU
 * l'autre l'obligerait à choisir, alors que les deux se complètent.
 */
export default function MenuSheet({
  visible, onClose, title, menu, photoUrls, onOpenPhoto, accent = colors.lave,
}: MenuSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {menu.sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item, i) => (
              <View key={`${item.label}-${i}`} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.label}>{item.label}</Text>
                  {!!item.description && (
                    <Text style={styles.description}>{item.description}</Text>
                  )}
                </View>
                {/* Un plat sans prix affiché reste lisible : la colonne de
                    droite disparaît plutôt que de montrer un tiret. */}
                {item.price != null && (
                  <Text style={[styles.price, { color: accent }]}>{formatMenuPrice(item)}</Text>
                )}
              </View>
            ))}
          </View>
        ))}

        {photoUrls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {menu.sections.length > 0 ? 'La carte en photo' : 'La carte'}
            </Text>
            <View style={{ gap: spacing.sm }}>
              {photoUrls.map((url, i) => (
                <Pressable key={url} onPress={() => onOpenPhoto?.(i)}>
                  <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.badgeSm, color: colors.faint,
    letterSpacing: 0.8, marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowText: { flex: 1 },
  label: { ...typography.cardTitle, color: colors.ink },
  description: { ...typography.caption, color: colors.muted, marginTop: 2, lineHeight: 17 },
  price: { ...typography.cardTitle, fontWeight: '600' },
  photo: {
    width: '100%', height: 220,
    borderRadius: radii.md, backgroundColor: colors.surfaceSunken,
  },
});
