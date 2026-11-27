import type { ComponentProps, ComponentType } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import LogoYaka from './LogoYaka';
import { colors, typography, spacing, radii, breakpoints, fonts, cible } from '../lib/theme';
import { etatCourant } from '../lib/a11y';

type BarreProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export interface Destination {
  /** Nom de la route dans le groupe d'onglets (« index », « search »). */
  name: string;
  /** Adresse publique, pour que l'entrée soit un vrai lien sur le web. */
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

type Props = BarreProps & {
  destinations: Destination[];
  /** Précision à côté du nom de marque (« Espace partenaire »). */
  mention?: string;
};

/**
 * Navigation principale sur grand écran : une barre en haut de page.
 *
 * Jusqu'ici, la barre d'onglets du téléphone restait en bas de l'écran sur un
 * ordinateur, simplement recentrée sur 460 px. C'est le « mobile étiré » que le
 * design system proscrit : sur un écran de bureau, on cherche la navigation en
 * haut, et cinq icônes au pied d'une page de 1 000 px de haut passent pour un
 * élément décoratif.
 *
 * Elle se branche sur le même navigateur (`Tabs`) : seule la présentation
 * change, pas les routes ni l'état des onglets. Sous `breakpoints.desktop`, la
 * barre du bas habituelle reste en place.
 *
 * Chaque entrée est un lien (`<a href>`) : clic du milieu, « ouvrir dans un
 * nouvel onglet » et lecture par les moteurs fonctionnent. Le clic simple, lui,
 * passe par le navigateur d'onglets pour ne pas recharger la page.
 */
export default function BarreBureau({ state, navigation, destinations, mention }: Props) {
  const actif = state.routes[state.index]?.name;

  const versOnglet = (name: string) => (e?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; preventDefault?: () => void }) => {
    // Ctrl/Cmd/Maj + clic : on laisse le navigateur ouvrir le lien ailleurs.
    if (e?.metaKey || e?.ctrlKey || e?.shiftKey) return;
    e?.preventDefault?.();
    const route = state.routes.find(r => r.name === name);
    if (!route) return;
    const evenement = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!evenement.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  return (
    <View style={styles.barre} role="navigation" aria-label="Navigation principale">
      <View style={styles.rangee}>
        <Pressable
          style={styles.marque}
          accessibilityRole="link"
          accessibilityLabel="YakaRDC, accueil"
          onPress={versOnglet(destinations[0].name)}
          {...({ href: destinations[0].href } as object)}
        >
          <LogoYaka size={30} plateRadius={30} />
          <Text style={styles.nom}>YakaRDC</Text>
          {mention ? <Text style={styles.mention}>{mention}</Text> : null}
        </Pressable>

        <View style={styles.liens}>
          {destinations.map(({ name, href, label, Icon }) => {
            const courant = name === actif;
            return (
              <Pressable
                key={name}
                style={[styles.lien, courant && styles.lienActif]}
                accessibilityRole="link"
                onPress={versOnglet(name)}
                {...({ href } as object)}
                {...etatCourant(courant)}
              >
                <Icon size={17} color={courant ? colors.lave : colors.muted} strokeWidth={1.8} />
                <Text style={[styles.libelle, courant && styles.libelleActif]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: colors.border },
  rangee: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', maxWidth: breakpoints.contentMax, alignSelf: 'center',
    height: 64, paddingHorizontal: spacing.lg,
  },
  marque: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: cible.min },
  nom: { ...typography.brand, color: colors.ink },
  mention: { ...typography.captionMd, color: colors.faint, marginLeft: spacing.xs },
  liens: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lien: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: cible.min, paddingHorizontal: spacing.v12, borderRadius: radii.md,
  },
  // Même signe que sur téléphone, où l'onglet actif pose une pastille `laveSoft`
  // derrière son icône : ici elle s'étend à toute l'entrée.
  lienActif: { backgroundColor: colors.laveSoft },
  libelle: { ...typography.labelMd, color: colors.muted },
  libelleActif: { fontFamily: fonts.sansSemiBold, color: colors.lave },
});
