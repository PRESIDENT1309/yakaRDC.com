import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, fonts, breakpoints, ratios } from '../lib/theme';
import { useResponsive } from '../lib/responsive';
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
  const { isWide } = useResponsive();
  // 220 px de haut conviennent à la largeur d'un téléphone. Dans une colonne
  // plus large, la même hauteur ne laisserait d'une carte photographiée qu'un
  // bandeau illisible : la photo y suit alors le rapport des photos de contenu.
  const stylePhoto = [styles.photo, isWide ? styles.photoLarge : styles.photoEtroite];

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.corps}>
        {menu.sections.map(section => (
          <View key={section.title} style={styles.section}>
            {/* Niveau 3 : le titre de la feuille occupe déjà le niveau 2. */}
            <Text style={styles.sectionTitle} accessibilityRole="header" aria-level={3}>{section.title}</Text>
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
            <Text style={styles.sectionTitle} accessibilityRole="header" aria-level={3}>
              {menu.sections.length > 0 ? 'La carte en photo' : 'La carte'}
            </Text>
            <View style={{ gap: spacing.sm }}>
              {photoUrls.map((url, i) => {
                const rang = `Photo ${i + 1} sur ${photoUrls.length} de la carte`;
                // Sans visionneuse à ouvrir, la photo n'est pas un bouton :
                // l'annoncer comme tel promettrait une action qui n'existe pas.
                return onOpenPhoto ? (
                  <Pressable
                    key={url}
                    onPress={() => onOpenPhoto(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Agrandir : ${rang}`}
                  >
                    <Image source={{ uri: url }} style={stylePhoto} resizeMode="cover" />
                  </Pressable>
                ) : (
                  <Image key={url} source={{ uri: url }} style={stylePhoto} resizeMode="cover" accessibilityLabel={rang} />
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Sur grand écran, la feuille prend toute la largeur de la fenêtre : sans
  // limite, le prix se retrouverait à un mètre du plat qu'il concerne.
  corps: { paddingBottom: spacing.xl, width: '100%', maxWidth: breakpoints.panelMax, alignSelf: 'center' },
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
  description: { ...typography.caption, color: colors.muted, marginTop: spacing.v2, lineHeight: 17 },
  // `cardTitle` est en Playfair : sa graisse supérieure est une autre famille.
  price: { ...typography.cardTitle, fontFamily: fonts.displaySemiBold },
  photo: { width: '100%', borderRadius: radii.md, backgroundColor: colors.surfaceSunken },
  photoEtroite: { height: 220 },
  photoLarge: { aspectRatio: ratios.carte },
});
