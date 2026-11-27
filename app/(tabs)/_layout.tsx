import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet, type ColorValue } from 'react-native';
import { Home, Search, BookOpen, CalendarCheck, User } from 'lucide-react-native';
import { colors, radii, spacing, typography, fonts } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import BarreBureau, { type Destination } from '../../components/BarreBureau';

// Barre à 5 destinations (Accueil, Recherche, Culture, Réservations, Profil).
// V1 : l'onglet Culture prend la place de Planning. L'écran `planner` reste
// dans le projet, avec ses tables Supabase, mais n'apparaît plus dans la barre
// (`href: null`) : le planning reviendra en V2, avec l'IA YakaRDC.
// Seule la présentation est affinée : hauteur, séparation avec le contenu,
// état actif (pastille discrète derrière l'icône plutôt qu'un simple
// changement de couleur), libellés en Manrope. Le mécanisme de navigation
// (Tabs d'expo-router) reste identique.

function TabIcon(Icon: typeof Home) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Icon color={color as string} size={20} strokeWidth={1.8} />
    </View>
  );
}

function tabLabel(title: string) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Text style={[styles.label, focused && styles.labelActive, { color }]}>{title}</Text>
  );
}

// Les mêmes cinq destinations, pour la barre du haut sur grand écran.
const DESTINATIONS: Destination[] = [
  { name: 'index', href: '/', label: 'Accueil', Icon: Home },
  { name: 'search', href: '/search', label: 'Recherche', Icon: Search },
  { name: 'culture', href: '/culture', label: 'Culture', Icon: BookOpen },
  { name: 'bookings', href: '/bookings', label: 'Réservations', Icon: CalendarCheck },
  { name: 'profile', href: '/profile', label: 'Profil', Icon: User },
];

export default function TabsLayout() {
  const { isDesktop } = useResponsive();

  return (
    <Tabs
      // Sur un ordinateur, la navigation passe en haut de page (voir
      // components/BarreBureau). La barre du bas, recentrée sur 460 px, n'était
      // qu'une interface de téléphone étirée.
      tabBar={isDesktop ? props => <BarreBureau {...props} destinations={DESTINATIONS} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isDesktop ? 'top' : 'bottom',
        tabBarActiveTintColor: colors.lave,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: colors.cream,
          height: Platform.OS === 'web' ? 68 : 62,
          paddingTop: spacing.v12,
          paddingHorizontal: spacing.v20,
          // Séparation nette avec le contenu qui défile en dessous, sans
          // dépendre d'un simple filet — se voit pendant le scroll aussi.
          shadowColor: colors.nuit,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Accueil', tabBarIcon: TabIcon(Home), tabBarLabel: tabLabel('Accueil') }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Recherche', tabBarIcon: TabIcon(Search), tabBarLabel: tabLabel('Recherche') }}
      />
      <Tabs.Screen
        name="culture"
        options={{ title: 'Culture', tabBarIcon: TabIcon(BookOpen), tabBarLabel: tabLabel('Culture') }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Réservations', tabBarIcon: TabIcon(CalendarCheck), tabBarLabel: tabLabel('Réservations') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: TabIcon(User), tabBarLabel: tabLabel('Profil') }}
      />
      {/* V2 : planning avec l'IA YakaRDC. Masqué de la barre, mais la route
          existe toujours, donc un lien direct ou un retour en arrière reste
          possible le jour où on le réactive (retirer `href: null`). */}
      <Tabs.Screen name="planner" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 34, height: 26, borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.laveSoft },
  // 11 px et non 10,5 : le plancher de l'échelle typographique.
  label: { ...typography.captionMd, marginTop: spacing.v2 },
  labelActive: { fontFamily: fonts.sansSemiBold },
});